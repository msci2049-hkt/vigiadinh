/**
 * Thrown for any non-2xx response. Carries the HTTP status + parsed body so
 * callers (and TanStack Query's retry logic) can branch on it.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  // Explicit `| undefined` (not just `?`) so it stays assignable under
  // exactOptionalPropertyTypes when the header is absent.
  readonly retryAfterMs?: number | undefined;

  constructor(message: string, status: number, data: unknown, retryAfterMs?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Default 401 handler: hard redirect to /login preserving the return path. */
function defaultOnUnauthorized(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/login?redirect=${redirect}`);
}

// App-wide singleton (one per app bundle): apiClient 401s and SSE fatal 401/403
// share the same "session expired" handling.
let onUnauthorized: () => void = defaultOnUnauthorized;

/** Wire a router-aware handler (e.g. router.navigate) from the app layer. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/**
 * Trigger the same "session expired → /login" handling used for HTTP 401s, for
 * non-HTTP flows that detect a dead session too (e.g. SSE returning 401/403).
 */
export function notifyUnauthorized(): void {
  onUnauthorized();
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Auto-retries on 503, honoring `Retry-After` (no spamming). Default 2. */
  retry503?: number;
};

export interface ApiClientOptions {
  /** BE origin, e.g. `env.VITE_API_URL`. Absolute paths passed to calls skip it. */
  baseUrl: string;
}

export interface ApiClient {
  get: <T>(path: string, options?: RequestOptions) => Promise<T>;
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
  delete: <T>(path: string, options?: RequestOptions) => Promise<T>;
  /**
   * Set/clear an Authorization header attached to every request. Real apps use
   * the Better Auth cookie (credentials:'include'); dev-token demos (carbon)
   * attach `dev:<userId>[:role]` here from their identity store.
   */
  setAuthHeader: (value: string | null) => void;
}

/** Build a configured client. Each app creates ONE and re-exports it. */
export function createApiClient({ baseUrl }: ApiClientOptions): ApiClient {
  let authHeader: string | null = null;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, retry503 = 2, headers, ...rest } = options;
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

    const init: RequestInit = {
      ...rest,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };

    for (let attempt = 0; ; attempt += 1) {
      const res = await fetch(url, init);

      // Unauthenticated → BE returns 401 (not 404). Bounce to /login.
      if (res.status === 401) {
        onUnauthorized();
        throw new ApiError("Unauthorized", 401, await readBody(res));
      }

      // Overloaded → 503 + Retry-After. Back off instead of hammering.
      if (res.status === 503 && attempt < retry503) {
        const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
        await sleep(retryAfter ?? Math.min(1000 * 2 ** attempt, 8000));
        continue;
      }

      if (!res.ok) {
        const data = await readBody(res);
        const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
        throw new ApiError(`Request failed (${res.status})`, res.status, data, retryAfter);
      }

      return (await readBody(res)) as T;
    }
  }

  return {
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "GET" }),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "POST", body }),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "PUT", body }),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "PATCH", body }),
    delete: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: "DELETE" }),
    setAuthHeader: (value: string | null) => {
      authHeader = value;
    },
  };
}
