// WHY: Worker process tách riêng HTTP — Bun process độc lập, scale ngang
// được. Sentry init (side-effect) cho process này luôn — exception ở worker
// MUST capture y như HTTP.
//
// Hiện chưa có worker nào — file sẵn structure để Phase sau add qua skill
// new-job (push instance vào array `workers` rồi BullMQ tự pick job).
import "@/lib/sentry";

import type { Worker } from "bullmq";
import { createHeartbeatWorker, scheduleHeartbeatWatch } from "@/jobs/heartbeat-watch";
import { createIndexerWorker, scheduleIndexerPoll } from "@/jobs/indexer-poll";
import { createIntentSweeperWorker, scheduleIntentSweeper } from "@/jobs/intent-sweeper";
import { createPresenceWorker, schedulePresencePing } from "@/jobs/presence-ping";
import { createTtlKeeperWorker, scheduleTtlKeeper } from "@/jobs/ttl-keeper";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";

const workers: Worker[] = [
  createIntentSweeperWorker(),
  createPresenceWorker(),
  createIndexerWorker(),
  createHeartbeatWorker(),
  createTtlKeeperWorker(),
];
// Lịch lặp đăng ký từ worker process (jobId cố định → gọi lại vô hại).
void scheduleIntentSweeper();
void schedulePresencePing();
void scheduleIndexerPoll();
void scheduleHeartbeatWatch();
void scheduleTtlKeeper();

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn({ signal }, "workers.shutdown.start");
  try {
    await Promise.all(workers.map((w) => w.close()));
    await bullConnection.quit();
    logger.warn({ signal }, "workers.shutdown.done");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "workers.shutdown.error");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

if (workers.length === 0) {
  logger.info("workers.ready: no workers registered yet — add via skill new-job");
} else {
  logger.info({ count: workers.length }, "workers.ready");
}
