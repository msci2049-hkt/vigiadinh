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

// Audit 2026-07-25 (§7) — connection THỨ BA, cho `secondaryStorage` của Better Auth.
//
// Trước phiên này auth dùng `bullConnection`. Đó là connection có
// `maxRetriesPerRequest: null` + offline queue BẬT, tức "xếp hàng và thử lại mãi mãi"
// — đúng cho worker nền, sai cho đường request. Mà session lookup chạy ở MỌI request
// (app.ts, middleware populate), nên Dragonfly chết một nhịp là mỗi request đang bay
// đều treo chờ chứ không lỗi ngay: connection dồn lại, process cạn tài nguyên, trong
// khi /ready vẫn báo 503 đúng. Chính file này đã cảnh báo cái bẫy đó ở dòng đầu —
// nó chỉ vào qua ngả `auth.ts` nên không ai thấy.
//
// KHÔNG gộp vào `rateLimitConnection`: cùng profile fail-fast nhưng khác lưu lượng
// hoàn toàn (mỗi request 1 lần đọc session), gộp thì rate-limit chờ sau hàng dài của
// auth. Đánh đổi đã cân: fail-fast nghĩa là Dragonfly chết → auth lỗi NGAY (5xx
// nhanh) thay vì treo. Với `secondaryStorage`, Better Auth coi đây là kho phiên chứ
// không phải cache, nên không có "miss rồi đọc DB" để rơi về — chết nhanh vẫn hơn
// chết chậm mà giữ tài nguyên.
export const authStoreConnection = new IORedis(env.REDIS_URL, {
  enableOfflineQueue: false,
});
authStoreConnection.on("error", (err) => logger.error({ err }, "redis.auth-store.error"));
authStoreConnection.on("connect", () => logger.info("redis.auth-store.connected"));
