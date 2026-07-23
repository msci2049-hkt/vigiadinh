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
