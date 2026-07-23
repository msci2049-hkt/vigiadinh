# SKILL: Tạo BullMQ cron (repeatable job)

## Dùng khi nào

- Task định kỳ: cleanup, daily report, subscription check, payout.
- Nhiều worker instance → CHỈ 1 chạy tại 1 thời điểm.
- **KHÔNG** dùng cho job 1 lần → dùng `new-job`.

---

## Thứ tự làm

```
1. Setup Redlock 1 lần (shared cho mọi cron):
   src/lib/redlock.ts

2. Tạo 1 cron queue shared:
   src/jobs/cron/queue.ts

3. Khai báo cron trong registry:
   src/jobs/cron/jobs.ts
   → key + pattern + description.

4. Implement handler:
   src/jobs/cron/handlers/<key>.ts
   → handler thuần (không biết về cron infra).

5. Wire vào worker:
   src/jobs/cron/worker.ts
   → switch theo job.name, wrap redlock.using().

6. Call registerCronJobs() 1 lần lúc worker start.

7. Cập nhật CODE_BASE_MAP.md.
```

---

## File tạo ở đâu

```
src/lib/redlock.ts                            ← 1 lần, shared
src/jobs/cron/
├── queue.ts                                  ← cron Queue (chung)
├── jobs.ts                                   ← registry key+pattern
├── worker.ts                                 ← consumer + redlock wrap
└── handlers/
    └── <key>.ts                              ← 1 handler 1 file
```

---

## Code mẫu

### 1. `src/lib/redlock.ts`

```ts
/**
 * 1 Redlock instance shared cho mọi cron.
 *
 * Dùng 1 Dragonfly node — OK cho "efficiency lock" (cron dedup).
 * Đối với "correctness lock" (không bao giờ được chạy 2 lần dù trong
 * tích tắc) → phải dùng 5 node độc lập theo paper Redlock gốc.
 *
 * antirez (creator của Redis): "Redlock is for efficiency, not correctness."
 * → Payment/financial KHÔNG dùng Redlock. Dùng DB transaction + idempotency.
 *
 * redlock v5 export class qua default. ResourceLockedError là named export.
 */
import Redlock, { ResourceLockedError } from "redlock";
import { bullConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const redlock = new Redlock([bullConnection], {
  driftFactor: 0.01,
  retryCount: 0,                    // 0 = single attempt → cron skip nếu contention
  retryDelay: 200,
  retryJitter: 100,
  automaticExtensionThreshold: 500, // extend lock khi còn <500ms
});

export { ResourceLockedError };

redlock.on("error", (err) => {
  if (err instanceof ResourceLockedError) return;
  logger.error({ err }, "redlock.error");
});
```

### 2. `src/jobs/cron/queue.ts`

```ts
/**
 * Cron queue shared cho mọi cron job. Tên có {} cho Dragonfly multi-thread.
 * attempts: 1 → cron PHẢI idempotent, KHÔNG retry mù.
 */
import { Queue } from "bullmq";
import { bullConnection } from "@/lib/redis";

export const cronQueue = new Queue("{cron}", {
  connection: bullConnection,
  defaultJobOptions: {
    removeOnComplete: { age: 24 * 3600, count: 100 },
    removeOnFail: { age: 7 * 24 * 3600 },
    attempts: 1,
  },
});
```

### 3. `src/jobs/cron/jobs.ts`

```ts
/**
 * Registry tất cả cron jobs.
 *
 * Thêm cron mới:
 *  1) Thêm entry ở đây.
 *  2) Implement handler ở handlers/<key>.ts.
 *  3) Wire vào switch trong worker.ts.
 *
 * `key` đóng cả 2 vai: BullMQ repeatable id + Redlock resource name.
 */
export type CronKey =
  | "cleanup-sessions"
  | "subscription-check"
  | "daily-report";

export const cronJobs: ReadonlyArray<{
  key: CronKey;
  pattern: string; // crontab format
  description: string;
}> = [
  { key: "cleanup-sessions",   pattern: "0 3 * * *", description: "Xoá session hết hạn lúc 03:00 ICT" },
  { key: "subscription-check", pattern: "0 * * * *", description: "Check subscription hàng giờ" },
  { key: "daily-report",       pattern: "0 8 * * *", description: "Gửi báo cáo ngày lúc 08:00 ICT" },
];

// Server có thể UTC, nhưng cron phải fire theo giờ VN.
export const CRON_TIMEZONE = "Asia/Ho_Chi_Minh";
```

### 4. `src/jobs/cron/handlers/cleanup-sessions.ts`

```ts
/**
 * Handler thuần — không biết về Redlock/BullMQ.
 * Dễ test: import vào unit test gọi trực tiếp được.
 */
import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { session } from "@/db/schema/auth";
import { logger } from "@/lib/logger";

export async function cleanupSessions(): Promise<void> {
  const now = new Date();
  const result = await db.delete(session).where(lt(session.expiresAt, now));
  logger.info({ deleted: result.rowCount ?? 0 }, "cron.cleanup-sessions.done");
}
```

### 5. `src/jobs/cron/worker.ts`

```ts
/**
 * Worker cron với 2 lớp dedup:
 *  1) BullMQ jobId = cron key → re-register thay thế, không duplicate.
 *  2) redlock.using() → race rare khi 2 worker pick cùng tick.
 *
 * redlock.using() tự extend + release. AbortSignal abort nếu extension
 * fail → handler bail trước destructive write.
 */
import { Worker, type Job } from "bullmq";
import * as Sentry from "@sentry/bun";
import { bullConnection } from "@/lib/redis";
import { redlock, ResourceLockedError } from "@/lib/redlock";
import { logger } from "@/lib/logger";
import { cronQueue } from "./queue";
import { cronJobs, CRON_TIMEZONE, type CronKey } from "./jobs";
import { cleanupSessions } from "./handlers/cleanup-sessions";
import { checkSubscriptions } from "./handlers/subscription-check";
import { sendDailyReport } from "./handlers/daily-report";

const HANDLERS: Record<CronKey, () => Promise<void>> = {
  "cleanup-sessions": cleanupSessions,
  "subscription-check": checkSubscriptions,
  "daily-report": sendDailyReport,
};

/**
 * Đăng ký cron lúc start worker. Idempotent:
 *  - Xoá repeatables stale (đã rename/drop trong registry).
 *  - Add lại theo registry hiện tại.
 */
export async function registerCronJobs(): Promise<void> {
  const existing = await cronQueue.getRepeatableJobs();
  for (const r of existing) {
    if (!cronJobs.some((j) => j.key === r.name)) {
      await cronQueue.removeRepeatableByKey(r.key);
      logger.warn({ removed: r.name }, "cron.removed-stale");
    }
  }
  for (const j of cronJobs) {
    await cronQueue.add(j.key, {}, {
      jobId: j.key,
      repeat: { pattern: j.pattern, tz: CRON_TIMEZONE },
    });
    logger.info({ key: j.key, pattern: j.pattern, tz: CRON_TIMEZONE }, "cron.registered");
  }
}

export function createCronWorker(): Worker {
  return new Worker("{cron}", async (job: Job) => {
    const key = job.name as CronKey;
    const handler = HANDLERS[key];
    if (!handler) throw new Error(`UNKNOWN_CRON:${key}`);

    Sentry.addBreadcrumb({ category: "cron", message: key, level: "info" });
    const t0 = Date.now();

    try {
      // 5 phút lock; tự extend nếu handler dài.
      await redlock.using([`lock:cron:${key}`], 5 * 60_000, async (signal) => {
        await handler();
        if (signal.aborted) throw signal.error ?? new Error("LOCK_LOST");
      });
      logger.info({ key, durationMs: Date.now() - t0 }, "cron.ok");
    } catch (err) {
      if (err instanceof ResourceLockedError) {
        logger.warn({ key }, "cron.skipped-locked");
        return;
      }
      Sentry.captureException(err, { tags: { cron: key } });
      throw err;
    }
  }, { connection: bullConnection, concurrency: 1 });
}
```

### 6. Wire vào `src/workers/index.ts`

```ts
import { createCronWorker, registerCronJobs } from "@/jobs/cron/worker";

const workers = [
  createSendEmailWorker(),
  createCronWorker(),
];

await registerCronJobs(); // 1 lần lúc start
```

---

## Test

```bash
# 1. Chạy worker
bun run worker
# → log: cron.registered cho mỗi job.

# 2. Đổi pattern trong jobs.ts → restart
# → log: cron.removed-stale (cũ), cron.registered (mới).

# 3. Chạy 2 instance worker đồng thời
# → 1 instance log "cron.ok", instance kia log "cron.skipped-locked".

# 4. Verify timezone
date  # server UTC
# Cron pattern "0 8 * * *" → fire lúc 8h sáng VN = 1h UTC.
```

---

## Checklist cuối

- [ ] `src/lib/redlock.ts` — 1 instance shared.
- [ ] `src/jobs/cron/queue.ts` — queue tên `{cron}`. **Enforce**: `bun run check:boundaries`.
- [ ] Registry trong `src/jobs/cron/jobs.ts` — `tz: "Asia/Ho_Chi_Minh"`.
- [ ] Handler ở `handlers/<key>.ts` — không biết Redlock/BullMQ.
- [ ] Worker switch theo `job.name`, wrap `redlock.using()`.
- [ ] `registerCronJobs()` gọi 1 lần lúc start worker.
- [ ] 2 instance test: 1 chạy, 1 `cron.skipped-locked`.
- [ ] Đổi pattern → cron cũ removed.
- [ ] Sentry breadcrumb mỗi tick.
- [ ] File ≤ 300 dòng.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| Cron lệch giờ sau deploy | `tz` không set, server UTC | Luôn `tz: "Asia/Ho_Chi_Minh"`. |
| Repeatable job duplicate | `jobId` không stable | Dùng cron key làm `jobId`. |
| Repeatable jobs tích luỹ sau khi đổi pattern | Quên cleanup | `registerCronJobs()` xoá stale trước add. |
| Lock không release sau crash | Lock TTL 5 phút → max delay 5 phút | `using()` auto-release trên error. Đặt TTL hợp lý. |
| `using()` throw "unable to achieve quorum" | Lock đang được instance khác giữ + `retryCount=0` | OK cho strict mode. Tăng `retryCount` nếu cần retry. |
| Cron dùng cho payment-critical | Sai pattern: Redlock không phải correctness lock | Dùng DB transaction + Postgres advisory lock. |
| Handler dài hơn lockDuration | Lock hết hạn giữa chừng | `using()` auto-extend khi còn 500ms. Hoặc tăng TTL. |
| Cron không fire sau restart | 1st run chưa có repeatable | Bình thường — registerCronJobs sẽ add. Pattern crontab sai → test ở crontab.guru. |
