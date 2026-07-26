// Test /rpc proxy (checklist B5): pass-through OK · method lạ bị chặn ·
// rate-limit chạy · key không rò. Upstream MOCK qua globalThis.fetch (service
// đọc fetch lúc GỌI, không bind lúc import). Rate-limit cần Dragonfly →
// redisReachable() skip-nêu-lý-do (kỷ luật testing-be: skip ≠ pass).
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "@/env";
import { rateLimitConnection } from "@/lib/redis";
import { RPC_MAX_BODY_BYTES, RPC_RATE_LIMIT, rpcRoutes } from "./routes";

const UPSTREAM_URL = "https://upstream.rpc.test";
const TEST_KEY = "sk_test_rpc_key_1234567890";

const realFetch = globalThis.fetch;
const realRpcUrl = env.STELLAR_RPC_URL;
const realApiKey = env.STELLAR_RPC_API_KEY;
const mutableEnv = env as { STELLAR_RPC_URL: string; STELLAR_RPC_API_KEY?: string };

// Dragonfly có chạy không — rate-limit failOpen=false, thiếu store là 429 hết.
// KHÔNG ping ngay: rateLimitConnection có enableOfflineQueue=false, lệnh bắn
// trước khi socket 'ready' bị chối thẳng dù server đang sống → chờ ready (cap 3s).
async function redisReachable(): Promise<boolean> {
  if (rateLimitConnection.status === "ready") return true;
  const ready = new Promise<boolean>((resolve) => {
    rateLimitConnection.once("ready", () => resolve(true));
  });
  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), 3000);
  });
  return Promise.race([ready, timeout]);
}
const redisUp = await redisReachable();
const testIt = redisUp ? test : test.skip;
if (!redisUp) {
  console.warn("SKIP rpc routes test: cần Dragonfly (rate-limit failOpen=false) — fail-env");
}

/** Ghi lại call upstream gần nhất để assert forward đúng. */
type Captured = { url: string; init: RequestInit };
let captured: Captured | null = null;

function stubUpstream(handler: (url: string, init: RequestInit) => Response): void {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    captured = { url, init: init ?? {} };
    return handler(url, init ?? {});
  }) as typeof fetch;
}

const app = new Hono().route("/rpc", rpcRoutes);

// Mỗi test một xô rate-limit riêng (defaultKey đọc x-forwarded-for đầu tiên)
// để pass-through không ăn 429 lây từ test khác / lần chạy trước trong 60s.
let bucket = 0;
async function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  bucket += 1;
  return await app.request("/rpc", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.99.${Math.floor(bucket / 250)}.${bucket % 250}`,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeAll(() => {
  mutableEnv.STELLAR_RPC_URL = UPSTREAM_URL;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  captured = null;
  mutableEnv.STELLAR_RPC_API_KEY = realApiKey;
});

afterAll(() => {
  mutableEnv.STELLAR_RPC_URL = realRpcUrl;
});

describe("POST /rpc — pass-through", () => {
  testIt("method allowlist forward đúng 4 field chuẩn, trả nguyên văn body upstream", async () => {
    stubUpstream(() => Response.json({ jsonrpc: "2.0", id: 7, result: { status: "healthy" } }));
    const res = await post({
      jsonrpc: "2.0",
      id: 7,
      method: "getHealth",
      sneaky: "field-la-phai-bi-loai", // field ngoài chuẩn không được lên provider
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 7, result: { status: "healthy" } });
    expect(captured?.url).toBe(UPSTREAM_URL);
    expect(captured?.init.method).toBe("POST");
    const forwarded = JSON.parse(String(captured?.init.body));
    expect(forwarded).toEqual({ jsonrpc: "2.0", id: 7, method: "getHealth" });
  });

  testIt("params pass-through nguyên vẹn", async () => {
    stubUpstream(() => Response.json({ jsonrpc: "2.0", id: "a", result: {} }));
    await post({
      jsonrpc: "2.0",
      id: "a",
      method: "getTransaction",
      params: { hash: "deadbeef" },
    });
    const forwarded = JSON.parse(String(captured?.init.body));
    expect(forwarded.params).toEqual({ hash: "deadbeef" });
  });
});

describe("POST /rpc — chặn tại cửa (không forward)", () => {
  testIt("method ngoài allowlist → -32601, upstream KHÔNG được gọi", async () => {
    stubUpstream(() => Response.json({}));
    const res = await post({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { error: { code: number; message: string }; id: number };
    expect(body.error.code).toBe(-32601);
    expect(body.error.message).toBe("METHOD_NOT_ALLOWED");
    expect(body.id).toBe(1);
    expect(captured).toBeNull();
  });

  testIt("batch (mảng) → -32600 BATCH_UNSUPPORTED, không forward", async () => {
    stubUpstream(() => Response.json({}));
    const res = await post([{ jsonrpc: "2.0", id: 1, method: "getHealth" }]);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("BATCH_UNSUPPORTED");
    expect(captured).toBeNull();
  });

  testIt("JSON hỏng → -32700 PARSE_ERROR", async () => {
    stubUpstream(() => Response.json({}));
    const res = await post("{not-json");
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32700);
    expect(captured).toBeNull();
  });

  testIt("body vượt 512KB → 413", async () => {
    stubUpstream(() => Response.json({}));
    const res = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "getHealth",
      params: { pad: "x".repeat(RPC_MAX_BODY_BYTES) },
    });
    expect(res.status).toBe(413);
    expect(captured).toBeNull();
  });
});

describe("POST /rpc — key không rò (B3)", () => {
  testIt(
    "có STELLAR_RPC_API_KEY → upstream nhận Bearer; lỗi upstream KHÔNG chứa key/URL",
    async () => {
      mutableEnv.STELLAR_RPC_API_KEY = TEST_KEY;
      stubUpstream(() => new Response("boom", { status: 500 }));
      const res = await post({ jsonrpc: "2.0", id: 2, method: "getNetwork" });
      const headers = captured?.init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${TEST_KEY}`);
      const text = await res.text();
      expect(text).toContain("RPC_UPSTREAM_STATUS_500");
      expect(text).not.toContain(TEST_KEY);
      expect(text).not.toContain(UPSTREAM_URL);
    },
  );

  testIt("upstream chết mạng → -32000, response không chứa key/URL", async () => {
    mutableEnv.STELLAR_RPC_API_KEY = TEST_KEY;
    globalThis.fetch = (async () => {
      throw new TypeError(`Unable to connect to ${UPSTREAM_URL}?key=${TEST_KEY}`);
    }) as unknown as typeof fetch;
    const res = await post({ jsonrpc: "2.0", id: 3, method: "getFeeStats" });
    const text = await res.text();
    expect(text).toContain("RPC_UPSTREAM_UNREACHABLE");
    expect(text).not.toContain(TEST_KEY);
    expect(text).not.toContain(UPSTREAM_URL);
  });

  testIt("không set key → upstream KHÔNG nhận header Authorization", async () => {
    mutableEnv.STELLAR_RPC_API_KEY = undefined;
    stubUpstream(() => Response.json({ jsonrpc: "2.0", id: 4, result: {} }));
    await post({ jsonrpc: "2.0", id: 4, method: "getLatestLedger" });
    const headers = captured?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("POST /rpc — rate-limit (B2: 120 điểm / 60s, failOpen=false)", () => {
  testIt("điểm 121 trong cùng xô → 429 RATE_LIMITED", async () => {
    stubUpstream(() => Response.json({}));
    const ip = "10.98.0.1"; // xô CỐ ĐỊNH riêng cho test này
    let last: Response | null = null;
    for (let i = 0; i <= RPC_RATE_LIMIT.points; i++) {
      last = await app.request("/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
        // method lạ: bị chặn SAU rate-limit, không đụng upstream — vòng lặp rẻ.
        body: JSON.stringify({ jsonrpc: "2.0", id: i, method: "notAllowed" }),
      });
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get("Retry-After")).not.toBeNull();
  });
});

describe("CORS phủ /rpc (B4 — cùng khuôn app.use('*', cors) của app.ts)", () => {
  testIt("preflight OPTIONS + POST từ origin FE production nhận đúng ACAO", async () => {
    const FE_ORIGIN = "https://familyhaven.mscilabs.com";
    const corsApp = new Hono();
    corsApp.use("*", cors({ origin: [FE_ORIGIN], credentials: true }));
    corsApp.route("/rpc", rpcRoutes);

    const preflight = await corsApp.request("/rpc", {
      method: "OPTIONS",
      headers: {
        Origin: FE_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(FE_ORIGIN);

    stubUpstream(() => Response.json({ jsonrpc: "2.0", id: 9, result: {} }));
    const res = await corsApp.request("/rpc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: FE_ORIGIN,
        "x-forwarded-for": "10.97.0.1",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "getHealth" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(FE_ORIGIN);
  });
});
