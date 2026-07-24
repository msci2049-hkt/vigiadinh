// Poll indexer (PHA 4.2): BullMQ lặp 30s — đọc checkpoint → getEvents → áp batch
// atomic (lõi modules/indexer). Queue {hashtag} · attempts 1 · redlock chống 2
// worker cùng poll (checkpoint là hàng rào thứ hai — batch atomic).
// INDEXER_CONTRACT_IDS trống → tick no-op (chưa deploy contract nghiệp vụ).
import { Queue, Worker } from "bullmq";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import { pollOnce, rpcEventSource } from "@/modules/indexer";

export const INDEXER_QUEUE = "{indexer-poll}";

export const indexerQueue = new Queue(INDEXER_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 24 * 3600 },
  },
});

export async function scheduleIndexerPoll(): Promise<void> {
  await indexerQueue.add("poll", {}, { repeat: { every: 30_000 }, jobId: "indexer-poll-cron" });
}

export function createIndexerWorker(): Worker {
  const contractIds = env.INDEXER_CONTRACT_IDS;
  const source =
    contractIds.length > 0 ? rpcEventSource({ rpcUrl: env.STELLAR_RPC_URL, contractIds }) : null;
  if (!source) {
    logger.info("indexer.disabled: INDEXER_CONTRACT_IDS trống — poll no-op");
  }
  return new Worker(
    INDEXER_QUEUE,
    async () => {
      if (!source) return;
      await redlock.using(["lock:indexer-poll"], 25_000, async () => {
        const applied = await pollOnce(source);
        if (applied > 0) logger.info({ applied }, "indexer.applied");
      });
    },
    { connection: bullConnection },
  );
}
