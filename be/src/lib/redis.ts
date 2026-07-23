// WHY: BullMQ và rate-limiter có yêu cầu ioredis khác nhau — share 1 connection
// → "maxRetriesPerRequest must be null" HOẶC rate-limit hang khi Dragonfly
// flap. Tách 2 instance riêng, cùng REDIS_URL.
//
// Theo .claude/rules/bullmq.md.
import IORedis from "ioredis";
import { env } from "@/env";
import { logger } from "@/lib/logger";

// BullMQ docs YÊU CẦU: maxRetriesPerRequest=null (worker phải retry vô hạn,
// không fail-fast), enableReadyCheck=false (Dragonfly không hỗ trợ INFO đầy đủ).
export const bullConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
bullConnection.on("error", (err) => logger.error({ err }, "redis.bull.error"));
bullConnection.on("connect", () => logger.info("redis.bull.connected"));

// Rate-limit: enableOfflineQueue=false → fail-fast khi Redis down, không xếp
// hàng command (sẽ làm request HTTP hang). Cho phép middleware fallback (vd
// allow request đi qua nếu rate-limit store chết).
export const rateLimitConnection = new IORedis(env.REDIS_URL, {
  enableOfflineQueue: false,
});
rateLimitConnection.on("error", (err) => logger.error({ err }, "redis.rate-limit.error"));
rateLimitConnection.on("connect", () => logger.info("redis.rate-limit.connected"));
