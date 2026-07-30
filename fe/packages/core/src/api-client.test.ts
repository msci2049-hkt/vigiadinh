import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createApiClient,
  notifyUnauthorized,
  setUnauthorizedHandler,
} from "./api-client";

/** Minimal duck-typed Response (api-client only uses status/ok/headers.get/text). */
function res(status: number, body = "", headers: Record<string, string> = {}) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => lower[k.toLowerCase()] ?? null },
    text: async () => body,
  };
}

const JSON_HEADERS = { "content-type": "application/json" };

// Factory client under test (the base URL is irrelevant — fetch is stubbed).
const apiClient = createApiClient({ baseUrl: "http://be.test" });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiClient interceptor", () => {
  it("401 → fires the unauthorized handler and throws ApiError(401)", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res(401, JSON.stringify({ message: "nope" }), JSON_HEADERS)),
    );

    await expect(apiClient.get("/secure")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("notifyUnauthorized() runs the SAME handler (shared with SSE fatal path)", () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    notifyUnauthorized();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("503 → backs off honoring Retry-After, then succeeds on retry", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(503, "", { "Retry-After": "1" }))
      .mockResolvedValueOnce(res(200, JSON.stringify({ ok: true }), JSON_HEADERS));
    vi.stubGlobal("fetch", fetchMock);

    const pending = apiClient.get<{ ok: boolean }>("/health");
    await vi.advanceTimersByTimeAsync(1000); // flush the Retry-After backoff
    await expect(pending).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("4xx (not 401) → throws ApiError once, no retry", async () => {
    const fetchMock = vi.fn(async () => res(400, JSON.stringify({ message: "bad" }), JSON_HEADERS));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.get("/x")).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("network error → rejects (not swallowed)", async () => {
    const boom = new TypeError("network down");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw boom;
      }),
    );
    await expect(apiClient.get("/x")).rejects.toBe(boom);
  });

  it("exposes retryAfterMs on a non-retried 503 (retry503: 0)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res(503, "", { "Retry-After": "2" })),
    );
    await expect(apiClient.get("/x", { retry503: 0 })).rejects.toMatchObject({
      status: 503,
      retryAfterMs: 2000,
    });
  });
});

describe("401 handler contract (retry-once on revoked wallet Bearer)", () => {
  it("🔴 handler returns true → retries ONCE, rebuilt headers drop the cleared Bearer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        res(401, JSON.stringify({ error: { code: "WALLET_SESSION_REVOKED" } }), JSON_HEADERS),
      )
      .mockResolvedValueOnce(res(200, JSON.stringify({ ok: true }), JSON_HEADERS));
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ baseUrl: "http://be.test" });
    client.setAuthHeader("Bearer dead-wallet-jwt");
    setUnauthorizedHandler((error) => {
      const code = (error?.data as { error?: { code?: string } } | null)?.error?.code;
      if (code !== "WALLET_SESSION_REVOKED") return;
      client.setAuthHeader(null); // the app handler clears the dead token…
      return true; // …and asks for one retry (the cookie is still valid)
    });

    await expect(client.get<{ ok: boolean }>("/api/wallets")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
      .headers as Record<string, string>;
    const second = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1]
      .headers as Record<string, string>;
    expect(first.Authorization).toBe("Bearer dead-wallet-jwt");
    expect(second.Authorization).toBeUndefined();
  });

  it("🔴 handler returns void (401 code it doesn't own) → NO retry, throws once", async () => {
    const fetchMock = vi.fn(async () =>
      res(401, JSON.stringify({ error: { code: "UNAUTHENTICATED" } }), JSON_HEADERS),
    );
    vi.stubGlobal("fetch", fetchMock);
    const handler = vi.fn(() => undefined);
    setUnauthorizedHandler(handler);

    await expect(apiClient.get("/secure")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("handler keeps returning true but 401 persists → retries only ONCE then throws", async () => {
    const fetchMock = vi.fn(async () =>
      res(401, JSON.stringify({ error: { code: "WALLET_SESSION_REVOKED" } }), JSON_HEADERS),
    );
    vi.stubGlobal("fetch", fetchMock);
    setUnauthorizedHandler(() => true);

    await expect(apiClient.get("/secure")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("setAuthHeader (dev-token identity)", () => {
  it("attaches Authorization on every request and clears with null", async () => {
    const client = createApiClient({ baseUrl: "http://be.test" });
    const fetchMock = vi.fn(async () => res(200, JSON.stringify({ ok: true }), JSON_HEADERS));
    vi.stubGlobal("fetch", fetchMock);

    client.setAuthHeader("dev:u_tu");
    await client.get("/api/me");
    let headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
      .headers as Record<string, string>;
    expect(headers.Authorization).toBe("dev:u_tu");

    client.setAuthHeader(null);
    await client.get("/api/me");
    headers = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBeUndefined();
  });
});
