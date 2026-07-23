---
globs: src/jobs/**,src/workers/**,src/lib/redis.ts
description: BullMQ + Dragonfly patterns. Auto-loads when touching job/worker/redis files.
---

# Rule: BullMQ + Dragonfly

Áp dụng khi đụng vào `src/jobs/`, `src/workers/`, hoặc `src/lib/redis.ts`.

## Bắt buộc

### Queue name MUST có `{curly-braces}`

```ts
// ✅
new Queue("{send-email}", { connection: bullConnection });
// ❌ — Dragonfly serialize Lua script lên 1 thread → throughput thấp
new Queue("send-email", { connection: bullConnection });
```

Dragonfly phải khởi động với:
```
--cluster_mode=emulated --lock_on_hashtags
```

> **Đã enforce**: `bun run check:boundaries` (trong `validate` + pre-commit) FAIL nếu `new Queue/Worker/QueueEvents("name")` literal thiếu `{hashtag}`. Tên truyền bằng biến thì không kiểm được (gap). Xem `scripts/check-boundaries.ts`.

### 2 ioredis connection TÁCH biệt

```ts
// ✅
export const bullConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,   // BullMQ docs YÊU CẦU
  enableReadyCheck: false,
});
export const rateLimitConnection = new IORedis(env.REDIS_URL, {
  enableOfflineQueue: false,    // fail-fast khi Dragonfly down
});
```

Share 1 connection → `BullMQ: maxRetriesPerRequest must be null` HOẶC rate-limit hang.

### Queue options MUST có cleanup

```ts
defaultJobOptions: {
  attempts: 5,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },  // tránh Dragonfly đầy
  removeOnFail: { age: 7 * 24 * 3600 },
}
```

### Idempotent qua jobId

```ts
// dedupKey = jobId → enqueue trùng sẽ collapse trong window queue retention
await queue.add("name", data, { jobId: data.dedupKey });
```

`dedupKey` MUST là business identity (vd `welcome:${userId}`), KHÔNG chứa timestamp/random.

### Worker error handling

Phân biệt 2 loại error:
- **PERMANENT** (validation, sai email) → `await job.discard(); throw new Error("PERMANENT:...")`
- **TRANSIENT** (network, 5xx) → throw để BullMQ retry theo `attempts`

### Worker phải re-validate payload Zod

```ts
new Worker(name, async (job) => {
  const data = jobSchema.parse(job.data);  // payload có thể stale/tampered
  // ...
});
```

### Cron job

- `repeat: { pattern, tz: "Asia/Ho_Chi_Minh" }` — server có thể UTC.
- `attempts: 1` — cron MUST idempotent, KHÔNG retry mù.
- `redlock.using([key], 5*60_000, ...)` wrap handler — chống 2 worker pick cùng tick.

### Graceful shutdown

`src/workers/index.ts` MUST có:
```ts
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
```

`shutdown` → `Promise.all(workers.map(w => w.close()))` → `bullConnection.quit()`.

## Cấm tuyệt đối

- ❌ `lockDuration` mặc định 30s nhưng job dài hơn → tăng hoặc `job.extendLock(30_000)` định kỳ.
- ❌ Worker import HTTP code (`app.ts`, routes) — bundle phình to.
- ❌ Redlock cho payment-critical → dùng DB transaction + Postgres advisory lock.
- ❌ `attempts > 5` cho job có side-effect chưa idempotent.

## Khi sửa file ở đây, MUST verify

- [ ] Queue name có `{}`.
- [ ] Worker re-parse Zod.
- [ ] `removeOnComplete + removeOnFail` set.
- [ ] PERMANENT vs TRANSIENT phân biệt rõ.
- [ ] Workers index có SIGTERM/SIGINT.
