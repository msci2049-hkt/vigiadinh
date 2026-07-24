// Sweeper TTL pipeline (A4, PHA 3.3): BullMQ repeatable 5 phút quét intent +
// approval quá expires_at → expired (đường system.expire của state machine).
// - Queue name PHẢI có {hashtag} (Dragonfly, rule bullmq.md).
// - Cron: attempts=1 (idempotent tự nhiên — quét lại tick sau), redlock chống
//   2 worker cùng tick, mỗi lượt quét ghi audit số lượng (repo lo per-intent).
import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import { sweepExpired } from "@/modules/intents/infra/intents.repository";

export const INTENT_SWEEPER_QUEUE = "{intent-sweeper}";

export const intentSweeperQueue = new Queue(INTENT_SWEEPER_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/** Đăng ký lịch lặp — gọi MỘT lần từ worker boot (jobId cố định = dedup). */
export async function scheduleIntentSweeper(): Promise<void> {
  await intentSweeperQueue.add(
    "sweep",
    {},
    {
      repeat: { pattern: "*/5 * * * *", tz: "Asia/Ho_Chi_Minh" },
      jobId: "intent-sweeper-cron",
    },
  );
}

export function createIntentSweeperWorker(): Worker {
  return new Worker(
    INTENT_SWEEPER_QUEUE,
    async () => {
      await redlock.using(["lock:intent-sweeper"], 4 * 60_000, async () => {
        const expiredCount = await sweepExpired(new Date());
        if (expiredCount > 0) {
          logger.info({ expiredCount }, "intent-sweeper.swept");
        }
      });
    },
    { connection: bullConnection },
  );
}
