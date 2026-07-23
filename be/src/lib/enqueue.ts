// WHY: Enqueue BullMQ AN TOÀN. bullConnection dùng maxRetriesPerRequest=null →
// nếu Dragonfly chưa "ready" (dev không có Redis), queue.add() có thể TREO chờ
// kết nối vô hạn → treo request HTTP. Guard theo `.status` để fail-fast (skip),
// KHÔNG treo. Trả false khi bỏ qua/lỗi → caller quyết fallback (vd chạy inline).
import * as Sentry from "@sentry/bun";
import type { JobsOptions, Queue } from "bullmq";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";

export async function safeAdd<T extends object>(
  queue: Queue,
  name: string,
  data: T,
  opts?: JobsOptions,
): Promise<boolean> {
  if (bullConnection.status !== "ready") {
    logger.warn({ queue: queue.name }, "enqueue.skip.redis-not-ready");
    return false;
  }
  try {
    await queue.add(name, data, opts);
    return true;
  } catch (err) {
    Sentry.captureException(err, { tags: { enqueue: queue.name } });
    logger.error({ err, queue: queue.name }, "enqueue.failed");
    return false;
  }
}
