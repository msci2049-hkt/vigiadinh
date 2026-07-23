// WHY: Wrap `rate-limiter-flexible` thành Hono middleware factory. Phải dùng
// `rateLimitConnection` (enableOfflineQueue=false) — KHÔNG share
// `bullConnection` vì bull yêu cầu `maxRetriesPerRequest=null` → request hang
// khi Dragonfly chậm. Theo .claude/rules/bullmq.md.
//
// Phân biệt 2 lỗi từ limiter.consume():
//  - RateLimiterRes  → exceeded, throw 429 RATE_LIMITED + Retry-After.
//  - Error           → store down (Dragonfly chết). failOpen=true (default)
//                      → log warn + allow; failOpen=false → 429
//                      RATE_LIMIT_STORE_DOWN (an toàn cho /api/auth/*).
import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { RateLimiterRedis, type RateLimiterRes } from "rate-limiter-flexible";
import { logger } from "@/lib/logger";
import { rateLimitConnection } from "@/lib/redis";

export type RateLimitOptions = {
  points: number;
  duration: number;
  blockDuration?: number;
  keyPrefix: string;
  keyResolver?: (c: Context) => string;
  failOpen?: boolean;
};

function defaultKey(c: Context): string {
  // Ưu tiên user.id (per-user quota chính xác). Fallback IP — cf-connecting-ip
  // do Cloudflare set (trusted), x-forwarded-for có thể spoof nếu không qua
  // proxy. Lấy IP đầu trong XFF (client gốc, không phải proxy chain).
  const userId = c.get("user")?.id;
  if (userId) return `u:${userId}`;
  const cf = c.req.header("cf-connecting-ip");
  if (cf) return `ip:${cf.trim()}`;
  const xff = c.req.header("x-forwarded-for");
  if (xff) return `ip:${xff.split(",")[0]?.trim() ?? "unknown"}`;
  return "ip:unknown";
}

function setHeaders(c: Context, limit: number, res: RateLimiterRes): void {
  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(Math.max(0, res.remainingPoints)));
  c.header("X-RateLimit-Reset", String(Math.ceil((Date.now() + res.msBeforeNext) / 1000)));
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const limiter = new RateLimiterRedis({
    storeClient: rateLimitConnection,
    keyPrefix: `rl:${opts.keyPrefix}`,
    points: opts.points,
    duration: opts.duration,
    blockDuration: opts.blockDuration ?? 0,
  });
  const resolveKey = opts.keyResolver ?? defaultKey;
  const failOpen = opts.failOpen ?? true;

  return async (c, next) => {
    const key = resolveKey(c);
    try {
      const res = await limiter.consume(key);
      setHeaders(c, opts.points, res);
      await next();
    } catch (err) {
      // Store down: Error instance từ ioredis. Exceeded: RateLimiterRes
      // (object, không phải Error).
      if (err instanceof Error) {
        logger.warn({ err, keyPrefix: opts.keyPrefix }, "rate-limit.store.down");
        if (failOpen) {
          await next();
          return;
        }
        throw new HTTPException(429, { message: "RATE_LIMIT_STORE_DOWN" });
      }
      const r = err as RateLimiterRes;
      setHeaders(c, opts.points, r);
      c.header("Retry-After", String(Math.ceil(r.msBeforeNext / 1000)));
      throw new HTTPException(429, { message: "RATE_LIMITED" });
    }
  };
}
