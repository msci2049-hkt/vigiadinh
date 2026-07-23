// WHY: Redlock dùng cho EFFICIENCY (cron dedup, 2 worker đừng pick cùng tick),
// KHÔNG cho correctness (payment, balance update). Theo antirez:
// "Redlock is for efficiency, not correctness."
//
// retryCount=0: cron skip nếu contention thay vì đợi → tick sau pick lại.
// Đợi = giữ Redis connection + có thể chạy job kép khi lock expire giữa chừng.
//
// automaticExtensionThreshold=500ms: tự gia hạn lock khi còn 500ms nữa hết hạn
// — đủ buffer cho GC pause/network jitter mà không quá thường (mỗi extend tốn
// 1 RTT Redis).
import Redlock, { ResourceLockedError } from "redlock";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";

export const redlock = new Redlock([bullConnection], {
  driftFactor: 0.01,
  retryCount: 0,
  retryDelay: 200,
  retryJitter: 100,
  automaticExtensionThreshold: 500,
});

redlock.on("error", (err) => {
  // Contention là expected (cron node khác đang giữ lock) — không phải lỗi.
  if (err instanceof ResourceLockedError) return;
  logger.error({ err }, "redlock.error");
});

// Re-export để worker import từ @/lib/redlock thay vì package "redlock" —
// consistency, dễ swap implementation sau.
export { ResourceLockedError };
