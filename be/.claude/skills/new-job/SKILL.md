# SKILL: Tạo BullMQ job

## Dùng khi nào

- Task nặng/IO: send email, gọi API ngoài, render PDF, billing.
- Cần retry tự động + exponential backoff.
- Cần idempotency (same input → chỉ chạy 1 lần).
- **KHÔNG** dùng cho task định kỳ → dùng `new-cron`.

---

## Thứ tự làm

```
1. Đọc CODE_BASE_MAP — job đã có chưa?

2. Tạo folder src/jobs/<tên-job>/

3. Tạo 3 file theo thứ tự:
   a. schema.ts   (Zod schema payload)
   b. queue.ts    (Queue + enqueue<X>() function)
   c. worker.ts   (Worker processor)

4. Wire vào src/workers/index.ts (graceful shutdown).

5. Cấu hình Dragonfly đúng:
   - Queue name phải có {curly-braces}
   - Dragonfly khởi động với:
     --cluster_mode=emulated --lock_on_hashtags

6. Curl/script test enqueue + verify worker xử lý.

7. Cập nhật CODE_BASE_MAP.md.
```

---

## File tạo ở đâu

```
src/jobs/<tên-job>/
├── schema.ts   ← Zod payload (single source of truth)
├── queue.ts    ← Queue + enqueue function
└── worker.ts   ← Worker processor (file riêng, không import HTTP)

src/workers/index.ts    ← Entry: gom worker + graceful shutdown
```

---

## Code mẫu — Job `send-email`

### 1. `src/jobs/send-email/schema.ts`

```ts
/**
 * Zod schema = single source of truth cho payload.
 * - Phải JSON-serializable (BullMQ lưu data dạng JSON).
 * - dedupKey = jobId BullMQ → enqueue trùng sẽ collapse.
 */
import { z } from "zod";

export const sendEmailJobSchema = z.object({
  to: z.string().email(),
  templateId: z.enum(["welcome", "reset-password", "magic-link"]),
  vars: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  dedupKey: z.string().min(1).max(120),
});

export type SendEmailJob = z.infer<typeof sendEmailJobSchema>;
```

### 2. `src/jobs/send-email/queue.ts`

```ts
/**
 * Queue name BẮT BUỘC bọc {curly-braces} cho Dragonfly multi-threading.
 *
 * Trích Dragonfly docs:
 *   "If you can use hashtags in your queue names (e.g., {queue1}),
 *    add --cluster_mode=emulated --lock_on_hashtags. This enhances
 *    performance of BullMQ workloads."
 *
 * Không có {} → mọi Lua script serialize lên 1 thread (slow).
 */
import { Queue } from "bullmq";
import { bullConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { sendEmailJobSchema, type SendEmailJob } from "./schema";

export const sendEmailQueue = new Queue<SendEmailJob>("{send-email}", {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 }, // 1, 2, 4, 8, 16 giây
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function enqueueSendEmail(input: SendEmailJob): Promise<string> {
  const data = sendEmailJobSchema.parse(input); // validate trước khi push

  // jobId = dedupKey: BullMQ ignore add() lần 2 nếu job cũ vẫn còn trong queue
  // (đảm bảo removeOnComplete để job cũ được xoá đúng lúc).
  const job = await sendEmailQueue.add("send", data, {
    jobId: data.dedupKey,
    priority: data.templateId === "reset-password" ? 1 : 10, // 1 = cao nhất
  });

  logger.info({ jobId: job.id, templateId: data.templateId }, "email.enqueued");
  return job.id!;
}
```

### 3. `src/jobs/send-email/worker.ts`

```ts
/**
 * Worker tách RIÊNG khỏi Queue để bundle HTTP không phải import
 * Resend/sharp/etc — chỉ worker mới cần.
 *
 * Domain error handling:
 *  - PERMANENT (validation, sai email) → job.discard(), KHÔNG retry.
 *  - TRANSIENT (network, 5xx) → throw để BullMQ retry theo `attempts`.
 */
import { Worker, type Job } from "bullmq";
import * as Sentry from "@sentry/bun";
import { bullConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { resend } from "@/lib/resend";
import { renderEmail } from "@/services/email/render";
import { sendEmailJobSchema, type SendEmailJob } from "./schema";

export function createSendEmailWorker(): Worker<SendEmailJob> {
  return new Worker<SendEmailJob>(
    "{send-email}",
    async (job: Job<SendEmailJob>) => {
      // Re-validate ở consumer side — data có thể stale/tampered.
      const data = sendEmailJobSchema.parse(job.data);

      const { html, text, subject } = await renderEmail({
        templateId: data.templateId,
        locale: "vi",
        props: data.vars as never, // narrow ở renderEmail
      });

      const { error } = await resend.emails.send({
        from: "noreply@example.com",
        to: data.to,
        subject,
        html,
        text,
        headers: { "X-Entity-Ref-ID": data.dedupKey }, // defence-in-depth dedup
      });

      if (error) {
        if (error.name === "validation_error") {
          await job.discard();
          throw new Error(`PERMANENT:${error.message}`);
        }
        throw new Error(`TRANSIENT:${error.message}`);
      }

      return { templateId: data.templateId };
    },
    {
      connection: bullConnection,
      concurrency: 10,
      lockDuration: 30_000, // job dài hơn → tăng hoặc gọi job.extendLock()
    },
  )
    .on("failed", (job, err) => {
      logger.error(
        { jobId: job?.id, attempts: job?.attemptsMade, err: err.message },
        "email.failed",
      );
      Sentry.captureException(err, { tags: { jobId: job?.id } });
    })
    .on("completed", (job, ret) => {
      logger.info({ jobId: job.id, ret }, "email.completed");
    });
}
```

### 4. `src/workers/index.ts` (entry worker process)

```ts
/**
 * Entry-point: spin up workers + graceful shutdown.
 *
 * Bun implement Node process API → SIGTERM/SIGINT hoạt động bình thường.
 * worker.close() chờ active job xong (không timeout — set lockDuration đủ rộng).
 */
import { createSendEmailWorker } from "@/jobs/send-email/worker";
import { bullConnection } from "@/lib/redis";
import { logger } from "@/lib/logger";

const workers = [
  createSendEmailWorker(),
  // createSomeOtherWorker(),
];

async function shutdown(signal: string): Promise<void> {
  logger.warn({ signal }, "workers.shutdown.start");
  await Promise.all(workers.map((w) => w.close()));
  await bullConnection.quit();
  logger.warn({ signal }, "workers.shutdown.done");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

logger.info({ workers: workers.length }, "workers.ready");
```

### 5. `package.json` script

```json
{
  "scripts": {
    "worker": "APP_ROLE=worker bun src/workers/index.ts"
  }
}
```

---

## Curl/script test

```bash
# 1. Chạy worker
bun run worker
# → logs "workers.ready { workers: 1 }"

# 2. Trigger enqueue qua API hoặc script:
bun --eval "
  import('./src/jobs/send-email/queue').then(async ({ enqueueSendEmail }) => {
    await enqueueSendEmail({
      to: 'test@example.com',
      templateId: 'welcome',
      vars: { name: 'Test' },
      dedupKey: 'welcome:user_123',
    });
    console.log('enqueued');
  });
"

# 3. Lần 2 cùng dedupKey → KHÔNG chạy lại
# → log "email.enqueued" 2 lần nhưng worker chỉ chạy 1 lần.

# 4. Force throw → retry 5 lần với backoff 1/2/4/8/16s
# 5. SIGTERM worker → log shutdown.start → drain → shutdown.done
```

---

## Checklist cuối

- [ ] Queue name có `{curly-braces}`. **Enforce**: `bun run check:boundaries` FAIL nếu thiếu.
- [ ] Dragonfly chạy với `--cluster_mode=emulated --lock_on_hashtags`.
- [ ] 3 file: schema, queue, worker — không lẫn vào nhau.
- [ ] `enqueue<X>()` parse Zod trước khi push.
- [ ] Worker re-parse Zod ở consumer side.
- [ ] `jobId = dedupKey` → idempotent.
- [ ] `removeOnComplete + removeOnFail` set → không phình Dragonfly.
- [ ] `attempts + backoff` cho transient error.
- [ ] Phân biệt PERMANENT (`job.discard()`) vs TRANSIENT (throw).
- [ ] Workers entry có `process.on("SIGTERM/SIGINT")` graceful shutdown.
- [ ] File ≤ 300 dòng.
- [ ] CODE_BASE_MAP cập nhật.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| `BullMQ: maxRetriesPerRequest must be null` | ioredis options sai | `maxRetriesPerRequest: null` cho `bullConnection`. |
| Job stuck "delayed" mãi | `jobId` trùng job đang processing | Đảm bảo `removeOnComplete`; tránh `jobId` cho job có lặp. |
| Throughput thấp dù concurrency cao | Queue name không có `{}` | Đổi `{queue-name}` + Dragonfly flag. |
| Worker bị mark "stalled" | `lockDuration` < thời gian job thực | Tăng `lockDuration` hoặc `await job.extendLock(30_000)` định kỳ. |
| Retry vô hạn permanent error | Mọi throw đều trigger retry | Phân biệt PERMANENT/TRANSIENT, dùng `job.discard()`. |
| Worker crash khi Dragonfly restart | `enableReadyCheck: true` chặn reconnect | `enableReadyCheck: false`. |
| Job không xoá sau hoàn thành | Quên `removeOnComplete` | Set `{ age: 24*3600, count: 1000 }`. |
| Worker import code HTTP server | Bundle worker lớn không cần thiết | Tách worker file, chỉ import service + lib. |
| Graceful shutdown timeout | Job đang chạy quá lâu | Tăng `lockDuration` hoặc redesign job ngắn hơn. |
| `Cannot parse` ở consumer | Payload schema thay đổi, job cũ vẫn còn | Migrate dần: hỗ trợ cả 2 schema 1 thời gian. |
