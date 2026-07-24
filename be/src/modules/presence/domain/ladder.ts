// Presence ladder (PHA 4.1, skill fw-guardian-presence + vi-backend-pipeline §5)
// — THUẦN function, mọi mốc thời gian truyền vào (test hermetic).
// Thang: ack ≤24h = active · 24–72h = slow · >72h = offline.
// "Máy sống ≠ người còn ký được": xác nhận TAY mỗi 90 ngày; quá hạn thì guardian
// KHÔNG được tính available dù ping máy vẫn đều.
// Riêng tư: trạng thái online CHỈ chủ ví thấy (repository đã scope owner).

export const ACTIVE_WINDOW_HOURS = 24;
export const SLOW_WINDOW_HOURS = 72;
export const MANUAL_CONFIRM_DAYS = 90;

export type LadderStatus = "active" | "slow" | "offline";

export function ladderStatus(lastAckAt: Date | null, now: Date): LadderStatus {
  if (!lastAckAt) return "offline";
  const hours = (now.getTime() - lastAckAt.getTime()) / 3_600_000;
  if (hours <= ACTIVE_WINDOW_HOURS) return "active";
  if (hours <= SLOW_WINDOW_HOURS) return "slow";
  return "offline";
}

export function manualConfirmOverdue(lastManualConfirmAt: Date | null, now: Date): boolean {
  if (!lastManualConfirmAt) return true;
  const days = (now.getTime() - lastManualConfirmAt.getTime()) / 86_400_000;
  return days > MANUAL_CONFIRM_DAYS;
}

export type GuardianPresence = {
  status: string; // giá trị DB: invited|active|slow|offline|removed
  lastSeenAt: Date | null;
  lastManualConfirmAt: Date | null;
};

/** Guardian còn "dùng được" để khôi phục: ladder active + xác nhận tay còn hạn.
 * invited/removed không bao giờ available. */
export function isAvailable(g: GuardianPresence, now: Date): boolean {
  if (g.status === "invited" || g.status === "removed") return false;
  return (
    ladderStatus(g.lastSeenAt, now) === "active" &&
    !manualConfirmOverdue(g.lastManualConfirmAt, now)
  );
}

export function availableCount(guardians: readonly GuardianPresence[], now: Date): number {
  return guardians.filter((g) => isAvailable(g, now)).length;
}

/** Trạng thái dự phòng của ví — UI đổi màu theo đây (skill §5). */
export type ReserveStance = "ok" | "no_reserve" | "unrecoverable";

export function reserveStance(available: number, threshold: number): ReserveStance {
  if (available < threshold) return "unrecoverable"; // đỏ: ví hiện KHÔNG khôi phục được
  if (available === threshold) return "no_reserve"; // vàng: hết dự phòng
  return "ok";
}

/**
 * Chống-lockout (checklist 4.1): đang unrecoverable/no-reserve mà gỡ thêm guardian
 * available là tự khoá cửa khôi phục → CHẶN. Gỡ guardian KHÔNG available (máy chết,
 * người đi vắng lâu) thì vẫn cho — đó chính là thao tác sửa chữa.
 */
export function canRemoveGuardian(input: {
  guardians: readonly GuardianPresence[];
  threshold: number;
  removing: GuardianPresence;
  now: Date;
}): boolean {
  const available = availableCount(input.guardians, input.now);
  if (!isAvailable(input.removing, input.now)) return true;
  return available - 1 >= input.threshold;
}
