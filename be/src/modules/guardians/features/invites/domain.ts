// Nghiệp vụ lời mời — THUẦN (không DB, không mạng), test hermetic.
//
// Câu hỏi trung tâm của wizard mức B: "ví này đã khôi phục được chưa?"
// Trả lời KHÔNG phải bằng số lời mời đã gửi, mà bằng số người bảo hộ ĐÃ LÊN CHAIN.
// Lời mời đã gửi mà chưa ai nhận thì không cứu được ai cả.

/** Trạng thái một lời mời — một chiều, không quay lui. */
export type InviteStatus = "sent" | "accepted" | "deployed" | "registered" | "expired";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Người bảo hộ CÓ THẬT trên chain = đã ký `add_guardian` xong. */
export function registeredCount(statuses: InviteStatus[]): number {
  return statuses.filter((s) => s === "registered").length;
}

export type RecoverabilityView = {
  /** Số người bảo hộ đã lên chain. */
  available: number;
  threshold: number;
  /** Ví khôi phục được ngay bây giờ hay chưa. */
  recoverable: boolean;
  /** Còn thiếu bao nhiêu người nữa. */
  missing: number;
};

/**
 * Ví khôi phục được khi số người bảo hộ trên chain ≥ ngưỡng.
 *
 * Đây là con số phải hiện ở hub kèm cảnh báo khi chưa đủ — người dùng tưởng
 * mình an toàn vì "đã mời 3 người" trong khi chưa ai nhận lời là kịch bản tệ
 * nhất: họ chỉ phát hiện lúc mất máy, tức là lúc không sửa được nữa.
 */
export function recoverability(input: {
  statuses: InviteStatus[];
  threshold: number;
}): RecoverabilityView {
  const available = registeredCount(input.statuses);
  const missing = Math.max(0, input.threshold - available);
  return {
    available,
    threshold: input.threshold,
    recoverable: missing === 0,
    missing,
  };
}

/**
 * Lời mời còn dùng được không — DÙNG MỘT LẦN.
 *
 * Audit 2026-07-25 (P0-5): bản cũ chỉ loại `expired` và `registered`, nên sau
 * khi người thân đã nhận lời (`deployed`) thì LINK VẪN SỐNG. Bất cứ ai có link
 * — chuyển tiếp trong nhóm chat, xem lỏm màn hình, máy dùng chung — chỉ cần
 * đăng nhập rồi gọi lại `accept` với địa chỉ của MÌNH là ghi đè
 * `guardian_address`. Chủ ví sau đó bấm "thêm người bảo hộ" trên một dòng vẫn
 * mang tên "Mẹ" và tự tay ký cho kẻ lạ vào làm người bảo hộ.
 *
 * `accepted`/`deployed` đều là ĐÃ DÙNG. Cần mời lại thì tạo lời mời mới.
 */
export function isUsable(invite: { status: InviteStatus; expiresAt: Date }, now: Date): boolean {
  if (invite.status !== "sent") return false;
  return invite.expiresAt.getTime() > now.getTime();
}
