# SKILL: Rate limit route

## Dùng khi nào

- Chống brute-force `/api/auth/*` (5 req/15 min per IP).
- Quota API per user (1000 req/h).
- Burst protection cho endpoint đắt (LLM, image processing, send email).

---

## Thứ tự làm

```
1. Tách 2 ioredis connection tới Dragonfly trong src/lib/redis.ts:
   - bullConnection: maxRetriesPerRequest=null (BullMQ yêu cầu)
   - rateLimitConnection: enableOfflineQueue=false (fail-fast)

2. Tạo factory rateLimit({...}) trong src/middlewares/rate-limit.ts.

3. Mount theo nhóm route trong src/app.ts (hoặc trong từng module).

4. Curl test: spam endpoint đến khi 429, kiểm tra Retry-After.
```

---

## File tạo ở đâu

- `src/lib/redis.ts`
- `src/middlewares/rate-limit.ts`

---

## Code mẫu

### 1. `src/lib/redis.ts`

```ts
/**
 * HAI ioredis connection tới Dragonfly:
 *
 *  - bullConnection:
 *      maxRetriesPerRequest=null (BullMQ docs YÊU CẦU).
 *  - rateLimitConnection:
 *      enableOfflineQueue=false (fail-fast khi Dragonfly down).
 *
 * Dùng chung 1 connection sẽ vỡ 1 trong 2. Cả 2 trỏ cùng node Dragonfly.
 */
import IORedis from "ioredis";
import { env } from "@/env";
import { logger } from "@/lib/logger";

export const bullConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const rateLimitConnection = new IORedis(env.REDIS_URL, {
  enableOfflineQueue: false,
});

rateLimitConnection.on("error", (err) => {
  logger.error({ err }, "redis.rate-limit.error");
});

bullConnection.on("error", (err) => {
  logger.error({ err }, "redis.bull.error");
});
```

### 2. `src/middlewares/rate-limit.ts`

```ts
/**
 * Hono middleware factory wrap rate-limiter-flexible (RateLimiterRedis).
 *
 * Drop-in với Dragonfly: rate-limiter-flexible chỉ dùng EVAL/EVALSHA + INCR,
 * Dragonfly implement đầy đủ.
 *
 * 2 chế độ:
 *  - failOpen: true (mặc định) — Dragonfly down → cho qua + log warn.
 *               Dùng cho /api/* bình thường.
 *  - failOpen: false — Dragonfly down → 429.
 *               Dùng cho /api/auth/* (an toàn hơn cho brute-force).
 */
import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { RateLimiterRedis, type RateLimiterRes } from "rate-limiter-flexible";
import { rateLimitConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";

export type RateLimitOptions = {
  points: number;            // số request
  duration: number;          // trong bao lâu (giây)
  blockDuration?: number;    // block thêm bao lâu sau khi exceed (giây)
  keyPrefix: string;         // unique per limiter
  keyResolver?: (c: Context) => string;
  failOpen?: boolean;        // default true
};

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
      // Phân biệt: store error vs rate exceeded.
      if (err instanceof Error) {
        // Dragonfly down hoặc script error.
        logger.error({ err, key, keyPrefix: opts.keyPrefix }, "rate-limit.store-error");
        if (failOpen) return next();
        throw new HTTPException(429, { message: "RATE_LIMIT_STORE_DOWN" });
      }
      // err là RateLimiterRes (exceeded).
      const res = err as RateLimiterRes;
      const retrySec = Math.ceil(res.msBeforeNext / 1000) || 1;
      c.header("Retry-After", String(retrySec));
      setHeaders(c, opts.points, res);
      throw new HTTPException(429, { message: "RATE_LIMITED" });
    }
  };
}

function defaultKey(c: Context): string {
  // Ưu tiên userId (per-user limit), fallback IP.
  const user = c.get("user");
  if (user?.id) return `u:${user.id}`;

  // Cloudflare → cf-connecting-ip. Behind LB → x-forwarded-for đầu.
  const ip = c.req.header("cf-connecting-ip")
    ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  return `ip:${ip}`;
}

function setHeaders(c: Context, points: number, res: RateLimiterRes): void {
  c.header("X-RateLimit-Limit", String(points));
  c.header("X-RateLimit-Remaining", String(Math.max(0, res.remainingPoints)));
  c.header("X-RateLimit-Reset",
    new Date(Date.now() + res.msBeforeNext).toISOString());
}
```

### 3. Mount trong `src/app.ts`

```ts
import { rateLimit } from "@/middlewares/rate-limit";

// Auth: fail-CLOSED. 5 req / 15 phút / IP, block thêm 15 phút sau khi exceed.
app.use("/api/auth/sign-in/*",
  rateLimit({
    keyPrefix: "auth-signin",
    points: 5,
    duration: 15 * 60,
    blockDuration: 15 * 60,
    failOpen: false,
  }));

app.use("/api/auth/sign-up/*",
  rateLimit({
    keyPrefix: "auth-signup",
    points: 3,
    duration: 60 * 60,
    failOpen: false,
  }));

// API chung: fail-OPEN. 1000 req / giờ / user.
app.use("/api/*",
  rateLimit({
    keyPrefix: "api",
    points: 1000,
    duration: 60 * 60,
  }));

// Endpoint đắt: 5 req / phút / user.
app.use("/api/generate-image",
  rateLimit({
    keyPrefix: "gen-img",
    points: 5,
    duration: 60,
  }));
```

---

## Curl test (BẮT BUỘC)

```bash
# Spam sign-in 6 lần → lần 6 trả 429
for i in {1..7}; do
  curl -i -X POST http://localhost:3000/api/auth/sign-in/email \
    -H "Content-Type: application/json" \
    -d '{"email":"x@y.com","password":"wrong"}' 2>&1 | head -1
done
# Lần 1-5: HTTP/1.1 401 (sai pass)
# Lần 6+: HTTP/1.1 429 với Retry-After: 900

# Kiểm tra header
curl -i http://localhost:3000/api/posts -b cookie.txt 2>&1 | grep -i ratelimit
# X-RateLimit-Limit: 1000
# X-RateLimit-Remaining: 999
# X-RateLimit-Reset: 2026-05-12T13:30:00.000Z

# Dừng Dragonfly → /api/* vẫn 200 (fail-open) + log warn
# Auth endpoint trả 429 RATE_LIMIT_STORE_DOWN (fail-closed)
```

---

## Checklist cuối

- [ ] 2 ioredis connection riêng cho Bull + rate-limit.
- [ ] Auth endpoint `failOpen: false`. Còn lại default `true`.
- [ ] Header `Retry-After`, `X-RateLimit-*` đầy đủ.
- [ ] Curl test spam → 429 đúng sau số lần `points`.
- [ ] Khi Dragonfly down: auth 429, API qua được.
- [ ] Log warn khi store error (Sentry sẽ catch).
- [ ] File ≤ 300 dòng.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| `BullMQ: maxRetriesPerRequest must be null` | Share connection giữa Bull + rate-limiter | Tách 2 connection trong `src/lib/redis.ts`. |
| Rate limit không hoạt động sau deploy | LB → mọi request cùng 1 IP | Dùng `cf-connecting-ip` hoặc parse `x-forwarded-for` đầu. |
| 429 cho user hợp lệ | Window quá ngắn | Tăng `points` hoặc đổi granularity (user thay vì IP). |
| `Retry-After: 0` | `msBeforeNext < 1000ms` | `Math.ceil(... / 1000) \|\| 1`. |
| Per-user limit dùng IP | `defaultKey` fallback IP khi không login | OK cho route public. Cần per-user → đặt `requireAuth` TRƯỚC `rateLimit`. |
| Block kéo dài sau khi đúng password | `blockDuration` set quá lâu | Cân nhắc giảm xuống còn 5-15 phút. |
| Dragonfly down → app sập theo | Quên `enableOfflineQueue: false` | Thêm option, kèm `failOpen: true` cho route bình thường. |
| Rate limit bị bypass qua header spoof | `x-forwarded-for` user gửi được | Đặt trước LB/CDN trim header này, hoặc dùng `cf-connecting-ip` (Cloudflare set, không spoof được). |
