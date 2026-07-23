---
name: cluster-stateless
description: Giữ BE stateless để chạy đúng khi cluster nhiều process. Mọi state chia sẻ (rate-limit counter, SSE fan-out, lock, session cache, dedup, cache) phải qua Dragonfly/Postgres — KHÔNG để trong RAM một process. Cron phải leader-lock (redlock) nếu không chạy N lần. Dùng khi user gõ "chạy nhiều process / cluster / reusePort", "WEB_INSTANCES", "rate limit không đúng khi scale", "SSE không nhận ở process khác", "cron chạy nhiều lần / trùng", "biến global mất khi restart", "session/counter lưu trong RAM", "logout không có hiệu lực ngay", "state in-memory". Đọc TRƯỚC khi thêm bất kỳ biến module-level giữ dữ liệu người dùng.
---

# Cluster = stateless: mọi state qua Dragonfly

> **Luật vàng BE**: prod chạy `WEB_INSTANCES` process độc lập (`src/cluster.ts`: `Bun.spawn` N bản
> `dist/index.js`, share PORT qua SO_REUSEPORT). Hai process KHÔNG share bộ nhớ. Vì vậy **bất kỳ state
> nào giữ trong RAM một process là SAI** — process khác không thấy, restart là mất. Nguồn sự thật bền =
> **Postgres**; state chia sẻ nhanh = **Dragonfly** (Redis-compatible qua ioredis).

## Test 1 câu để biết có vi phạm không

> "Nếu request này rơi vào **process khác** (hoặc process vừa restart), kết quả có còn đúng không?"

Nếu không → state đó phải ra Dragonfly/Postgres. Ví dụ sai kinh điển: `const counter = new Map()` ở
module scope để đếm rate-limit / giữ session / cache — mỗi process một bản → đếm sai N lần, login lúc được
lúc không tùy process kernel route tới.

## Bản đồ state → nơi đặt (đều đã có hạ tầng trong repo)

| State | ĐÚNG (đặt ở) | Hàm/điểm thật trong repo |
|---|---|---|
| Rate-limit counter | Dragonfly (`RateLimiterRedis`) | `src/middlewares/rate-limit.ts` `rateLimit({points,duration,keyPrefix,keyResolver})`, store = `rateLimitConnection` |
| SSE realtime (push) | Dragonfly pub/sub | `src/lib/realtime.ts` `publishToUser(userId,event,data)` — **gọi được từ BẤT KỲ process/worker nào**; fan-out kênh `sse:user:{id}` |
| Distributed lock / cron leader | Dragonfly (redlock) | `src/lib/redlock.ts` `redlock.using([key], ttl, fn)` (`retryCount:0`) |
| Session lookup nhanh | Dragonfly secondaryStorage (prod) | `src/lib/auth.ts` `secondaryStorage` + `cookieCache{maxAge:300}` (dev = memory) |
| Job dedup / debounce | BullMQ trên Dragonfly | `jobId` business-identity, hoặc `deduplication` native (skill `bullmq-jobs`) |
| Cache đọc | Dragonfly cache-aside | skill `caching-patterns` |
| Nguồn sự thật (đơn, ví, user) | **Postgres** | `db` — KHÔNG cache tiền/stale (skill `postgres-drizzle-data`) |

**Hai loại state được phép ở RAM** (per-process, không chia sẻ): (1) SSE client registry của chính process
đó — `realtime-core.ts` giữ `Map<channel, Set<client>>`, cross-process đã đi qua pub/sub; (2) semaphore CPU
hash — `hash-guard.ts` cố ý per-process (trần box = `WEB_INSTANCES × HASH_MAX_CONCURRENT`). Hai cái này
stateless-safe vì KHÔNG mang trạng thái người dùng cần đồng bộ.

## Cron: leader-lock hoặc chạy N lần

Nhiều worker (hoặc dù chỉ 1 worker nhưng repeatable job) pick cùng tick → chạy trùng. Bắt buộc bọc:

```ts
// wrap handler cron — chỉ 1 node chạy mỗi tick, còn lại skip (retryCount:0 → không đợi)
await redlock.using([`cron:${name}`], 5 * 60_000, async () => { /* việc cron */ });
```

`attempts: 1` cho cron (idempotent, KHÔNG retry mù). Chi tiết: skill `new-cron` + `.claude/rules/bullmq.md`.

## Dragonfly khi đa-process = SPOF của đường đồng bộ

Mọi state chia sẻ nằm ở Dragonfly ⇒ Dragonfly chết = rate-limit, session-nhanh, queue, SSE gãy đồng loạt.
Vì vậy: `/ready` PHẢI kiểm Dragonfly (đã có), rate-limit `failOpen` cân nhắc theo route (auth = fail-closed),
và cân nhắc Dragonfly HA khi đa-process là production-critical. Chi tiết vận hành: `docs/SCALE-RUNBOOK.md`.

## GOTCHAS (đã trả giá thật)

- **Rate-limit/counter trong `Map` module-scope** = đếm per-process, sai khi `WEB_INSTANCES>1`. Luôn dùng
  `rateLimitConnection` (Dragonfly). Đây là lý do repo tách sẵn `rate-limit.ts` — đừng "đơn giản hóa" về Map.
- **Cookie-cache revocation window cross-process** (`.claude/rules/auth.md`): logout / ban / hạ quyền chỉ chắc
  có hiệu lực sau khi cookie-cache hết hạn (tới `maxAge` 5 phút) — N process không share cache in-memory. Route
  nhạy (logout-all, ban, hạ quyền, xóa tài khoản) → check **denylist Dragonfly** (`revoked:session:{id}`, TTL =
  `cookieCache.maxAge`) để thu hồi tức thời. Mặc định template KHÔNG bật (đánh đổi query DB) — bật khi cần.
- **BullMQ jobId chứa `:`** (BUG-007 BE): `Custom Id cannot contain :` — CHỈ lộ khi Redis sống (dev không có
  Redis thì im). Dùng `-` làm separator trong dedupKey (vd `welcome-${userId}`).
- **Queue name thiếu `{hashtag}`**: Dragonfly serialize Lua lên 1 thread → throughput thấp. `new
  Queue("{send-email}")` bắt buộc, enforce bởi `check:boundaries`. Xem `.claude/rules/bullmq.md`.
- **Dev token bật theo default → prod quên env = mạo danh** (MAJOR-3): mọi cờ "mở cửa" phải **fail-closed**
  (default off), bật tường minh qua env. Đừng để tiện-cho-dev thành lỗ hổng prod.
- **`publishToUser` từ worker vẫn tới client**: đừng nghĩ phải publish từ chính web process giữ SSE — pub/sub
  cross-process lo việc đó. Nhưng SSE là **at-most-once**: event phát lúc client rớt là MẤT → FE `onReconnect`
  phải `invalidateQueries` (refetch-bù). Xem skill FE `consume-sse`.
- **`reusePort` chỉ cân tải trên Linux** (SO_REUSEPORT). Dev macOS/Win chạy 1 process. Đừng debug "sao chỉ 1
  process nhận request" trên máy không-Linux.

## Cross-reference

`scaling-playbook` (bao nhiêu process/pool, PgBouncer, đo trước) · `postgres-drizzle-data` (Postgres = nguồn
sự thật) · `caching-patterns` · `bullmq-jobs` · skill `add-sse` / `new-cron` / `rate-limit-route` ·
`.claude/rules/auth.md` (revocation window) · `.claude/rules/bullmq.md` · `docs/SCALE-RUNBOOK.md`.
