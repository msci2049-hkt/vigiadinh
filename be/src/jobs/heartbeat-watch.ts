// Cron heartbeat thừa kế (PHA 4.3): mỗi giờ (phút 30) sweep plan active — leo
// thang nếu im lặng thêm kỳ (notify đúng đối tượng, debounce = chỉ khi tier tăng).
// Server chỉ GỢI Ý — mở claim là hành động on-chain của guardian (bất biến 2).
import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import { sweepHeartbeats } from "@/modules/inheritance";

export const HEARTBEAT_QUEUE = "{heartbeat-watch}";

export const heartbeatQueue = new Queue(HEARTBEAT_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function scheduleHeartbeatWatch(): Promise<void> {
  await heartbeatQueue.add(
    "sweep",
    {},
    { repeat: { pattern: "30 * * * *", tz: "UTC" }, jobId: "heartbeat-watch-cron" },
  );
}

export function createHeartbeatWorker(): Worker {
  return new Worker(
    HEARTBEAT_QUEUE,
    async () => {
      await redlock.using(["lock:heartbeat-watch"], 4 * 60_000, async () => {
        const escalations = await sweepHeartbeats(new Date());
        if (escalations.length > 0) {
          logger.info({ count: escalations.length }, "heartbeat.escalated");
        }
      });
    },
    { connection: bullConnection },
  );
}
