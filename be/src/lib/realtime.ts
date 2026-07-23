// WHY: SSE fan-out cross-process qua Dragonfly pub/sub. 2 ioredis connection
// RIÊNG (publish + subscribe) — KHÔNG tái dùng bullConnection/rateLimitConnection:
// connection ở SUBSCRIBE mode KHÔNG chạy được lệnh thường (rule bullmq.md), và
// bull/rate-limit có yêu cầu option khác. publishToUser gọi được từ BẤT KỲ
// process/worker nào (web instance khác, BullMQ worker) → client của user nhận.
import IORedis from "ioredis";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { createRealtime, type RealtimeTransport } from "@/lib/realtime-core";

export type { SseClient } from "@/lib/realtime-core";

// Publish: lệnh thường, fail-fast khi Dragonfly down (enableOfflineQueue=false →
// reject ngay, catch + log thay vì xếp hàng phình bộ nhớ).
const pub = new IORedis(env.REDIS_URL, { enableReadyCheck: false, enableOfflineQueue: false });
// Subscribe: ở lại subscriber-mode, ioredis tự re-subscribe sau reconnect.
const sub = new IORedis(env.REDIS_URL, { enableReadyCheck: false, maxRetriesPerRequest: null });
pub.on("error", (err) => logger.error({ err }, "realtime.pub.error"));
sub.on("error", (err) => logger.error({ err }, "realtime.sub.error"));

const ioTransport: RealtimeTransport = {
  publish: (channel, payload) => {
    pub
      .publish(channel, payload)
      .catch((err) => logger.error({ err, channel }, "realtime.publish.failed"));
  },
  subscribe: (channel) => {
    sub
      .subscribe(channel)
      .catch((err) => logger.error({ err, channel }, "realtime.subscribe.failed"));
  },
  unsubscribe: (channel) => {
    sub
      .unsubscribe(channel)
      .catch((err) => logger.error({ err, channel }, "realtime.unsubscribe.failed"));
  },
  onMessage: (handler) => {
    sub.on("message", handler);
  },
};

export const realtime = createRealtime(ioTransport);
export const publishToUser = realtime.publishToUser;
export const addClient = realtime.addClient;

// Gọi trong graceful shutdown (src/index.ts) để đóng 2 connection sạch.
export async function closeRealtime(): Promise<void> {
  await Promise.allSettled([pub.quit(), sub.quit()]);
}
