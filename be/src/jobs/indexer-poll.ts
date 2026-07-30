// Poll indexer (PHA 4.2): BullMQ lặp 30s — đọc checkpoint → getEvents → áp batch
// atomic (lõi modules/indexer). Queue {hashtag} · attempts 1 · redlock chống 2
// worker cùng poll (checkpoint là hàng rào thứ hai — batch atomic).
// INDEXER_CONTRACT_IDS trống → tick no-op (chưa deploy contract nghiệp vụ).
import { Queue, Worker } from "bullmq";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import {
  DEFAULT_STREAM,
  type EventSource,
  getCheckpoint,
  pollOnce,
  rpcEventSource,
} from "@/modules/indexer";

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

/**
 * MỘT vòng poll + TIẾNG NÓI khi nó chết.
 *
 * Sự cố 2026-07-30: vòng poll chết đứng 48 phút, 96 job failed liên tiếp, và
 * KHÔNG MỘT DÒNG LOG ứng dụng nào — nguyên nhân (`cannot serialize BigInt`) chỉ
 * moi ra được từ `failedReason` trong BullMQ. Fail-closed thì đúng, nhưng CÂM là
 * lỗi riêng của nó: checkpoint không nhích nên vòng sau đập lại đúng event độc,
 * mà không ai biết là đang có chuyện gì.
 *
 * Log kèm checkpoint ĐANG xử lý — không có con số đó thì "indexer lỗi" là câu vô
 * dụng, có nó thì chỉ cần một truy vấn getEvents là dựng lại được ca lỗi.
 * Tách khỏi worker để test được mà không cần Redis/redlock.
 */
export async function runIndexerPollTick(
  source: EventSource,
  streamId: string = DEFAULT_STREAM,
): Promise<number> {
  const checkpoint = await getCheckpoint(streamId);
  try {
    const applied = await pollOnce(source, streamId);
    if (applied > 0) logger.info({ applied, fromLedger: checkpoint.ledgerSeq }, "indexer.applied");
    return applied;
  } catch (err) {
    logger.error(
      { err, reason: err instanceof Error ? err.message : String(err), checkpoint },
      "indexer.poll-failed",
    );
    // Ném lại: BullMQ vẫn phải đánh dấu failed (fail-closed, không nuốt lỗi).
    // `attempts: 1` GIỮ NGUYÊN — cron 30s CHÍNH LÀ cơ chế thử lại, còn retry
    // trong cùng tick chỉ đập vào đúng event độc thêm 4 lần rồi tranh redlock với
    // tick kế tiếp (luật .claude/rules/bullmq.md: cron idempotent, không retry mù).
    throw err;
  }
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
      // `entered` phân biệt hai kiểu chết khác nhau hoàn toàn: KHÔNG lấy được lock
      // (worker khác đang poll — bình thường) vs đã vào tới vòng poll rồi mới chết
      // (runIndexerPollTick đã tự log kèm checkpoint). Gộp một câu là mất thông tin.
      let entered = false;
      try {
        await redlock.using(["lock:indexer-poll"], 25_000, async () => {
          entered = true;
          await runIndexerPollTick(source);
        });
      } catch (err) {
        if (!entered) {
          logger.error(
            { err, reason: err instanceof Error ? err.message : String(err) },
            "indexer.lock-failed",
          );
        }
        throw err;
      }
    },
    { connection: bullConnection },
  );
}
