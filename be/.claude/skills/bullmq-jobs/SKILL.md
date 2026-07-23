---
name: bullmq-jobs
description: Quyết định & viết job nền BullMQ trên Dragonfly đúng cho template. Khi nào đẩy việc ra job, worker tách khỏi API, idempotency + dedup (jobId hoặc deduplication native throttle/debounce), backoff/DLQ, cron leader-lock, enqueue an toàn (safeAdd) khi Redis chưa sẵn. Dùng khi user gõ "tạo job / queue", "chạy nền", "gửi email nền", "cron / lặp lịch", "job chạy nhiều lần / trùng", "debounce job", "worker riêng", "job fail retry", "queue name hashtag", "BullMQ Dragonfly". Đọc TRƯỚC khi thêm queue/worker hay xử lý việc nặng trong request.
---

# BullMQ jobs: quyết định + dedup + cron

> **One-thing**: việc-có-thể-fail / nặng / chậm → job (retry, observability), KHÔNG làm sync trong request.
> Luật cơ học (queue name `{hashtag}`, 2 connection tách, removeOnComplete/Fail, SIGTERM) ở
> `.claude/rules/bullmq.md` — skill này lo *quyết định + dedup + cron*. Tạo job cơ học → `new-job` / `new-cron`.

## Khi nào đẩy ra job (vs eventBus vs sync)

| Việc | Cách | Vì |
|---|---|---|
| I/O có thể fail (email, gọi API ngoài, render) | **BullMQ** | retry/backoff/DLQ/observability |
| Side-effect **sync cùng-request** (invalidate cache, metric) | `eventBus.on` (sync, no I/O) | `.claude/rules/events.md` |
| Việc nhanh, thuộc chính request | làm luôn trong handler | không cần queue |

Worker chạy **process riêng** (`src/workers/index.ts`, compose profile `prod`) — KHÔNG import HTTP code
(app.ts/routes → bundle phình). Scale worker ×N khi job là bottleneck; cron đã dedup nên vẫn 1 lần.

## Enqueue an toàn: `safeAdd` (không treo request)

```ts
import { safeAdd } from "@/lib/enqueue";
const ok = await safeAdd(queue, "send-welcome", data, { jobId: `welcome-${userId}` });
if (!ok) { /* Redis chưa ready → fallback inline hoặc bỏ qua, KHÔNG treo */ }
```

`bullConnection` dùng `maxRetriesPerRequest:null` → `queue.add()` có thể **treo vô hạn** khi Dragonfly chưa
ready (dev không Redis). `safeAdd` guard theo `.status` → skip thay vì treo.

## Idempotency & dedup — chọn cơ chế

- **jobId = business identity** (`welcome-${userId}`) → enqueue trùng collapse trong window retention. KHÔNG
  chứa timestamp/random. ⚠️ jobId **KHÔNG chứa `:`** (BUG-007: `Custom Id cannot contain :`, chỉ lộ khi Redis
  sống) → dùng `-`.
- **`deduplication` native** (BullMQ 5.x, repo `^5.76.7` — web-verified 2026-07): thay SET NX tự chế.
  ```ts
  // Throttle: bỏ job trùng id trong ttl
  await queue.add("sync", data, { deduplication: { id: `sync-${userId}`, ttl: 5000 } });
  // Debounce: gộp burst, chạy bản mới nhất sau delay (extend+replace reset ttl)
  await queue.add("sync", data, { delay: 2000, deduplication: { id: `sync-${userId}`, ttl: 2000, extend: true, replace: true } });
  // keepLastIfActive: không chạy song song, requeue bản mới nhất khi job hiện tại xong (ttl bị bỏ qua)
  ```

## Worker: phân loại lỗi + re-validate

```ts
new Worker(name, async (job) => {
  const data = jobSchema.parse(job.data);        // payload có thể stale/tampered → re-parse Zod
  // TRANSIENT (network,5xx) → throw để retry theo attempts
  // PERMANENT (validation, sai email) → await job.discard(); throw new Error("PERMANENT:...")
}, { connection: bullConnection });
```

`removeOnComplete/removeOnFail` bắt buộc (tránh Dragonfly đầy). `attempts`≤5 cho job có side-effect chưa idempotent.

## Cron: leader-lock (nếu không chạy N lần)

```ts
// upsertJobScheduler (thay repeatable cũ) + redlock trong handler
await redlock.using([`cron:${name}`], 5 * 60_000, async () => { /* idempotent */ });
```

`attempts: 1` cho cron (KHÔNG retry mù), `tz: "Asia/Ho_Chi_Minh"`. Nhiều worker pick cùng tick → redlock để 1
chạy, còn lại skip. Xem `cluster-stateless` + skill `new-cron`.

## GOTCHAS

- **Queue name thiếu `{hashtag}`** → Dragonfly serialize Lua 1 thread, throughput thấp. Enforce `check:boundaries`.
- **Share 1 connection** bull + rate-limit → `maxRetriesPerRequest must be null` hoặc rate-limit hang. 2 connection
  tách (`bullConnection` + `rateLimitConnection`, `src/lib/redis.ts`).
- **lockDuration mặc định 30s** — job dài hơn → tăng hoặc `job.extendLock(30_000)` định kỳ (job bị coi là stalled).
- **Redlock cho payment = SAI** (efficiency ≠ correctness) → DB transaction + advisory lock (`postgres-drizzle-data`,
  `.claude/rules/payment.md`).
- **BullMQOtel** (khi thêm OTel) trace + metrics job nối Sentry/OTel — xem `observability-be`.

## Cross-reference

`.claude/rules/bullmq.md` · `.claude/rules/events.md` · `cluster-stateless` · `scaling-playbook` (scale worker) ·
`observability-be` · `email-delivery` · skill `new-job` / `new-cron`.
