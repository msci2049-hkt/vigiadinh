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

/**
 * Khớp `MIN_GUARDIANS` của registry (`recovery-registry/src/lib.rs:69`):
 * `register_wallet` panic `#4 TooFewGuardians` dưới 3 người. Trước bản này,
 * recoverability chỉ so với `threshold` (mặc định 2) → mời đúng 2 người là
 * banner XANH "đã an toàn", nút Đăng ký mở, rồi contract chối ở bước cuối
 * wizard — ca thứ BA của lớp bug "TS cho qua giá trị mà chain sẽ chối".
 */
export const MIN_GUARDIANS = 3;

export type RecoverabilityView = {
  /** Số người bảo hộ đã lên chain. */
  available: number;
  threshold: number;
  /** Số người TỐI THIỂU phải lên chain = max(MIN_GUARDIANS, threshold). */
  required: number;
  /** Ví khôi phục được ngay bây giờ hay chưa. */
  recoverable: boolean;
  /** Còn thiếu bao nhiêu người nữa. */
  missing: number;
};

/**
 * Ví khôi phục được khi số người bảo hộ trên chain ≥ max(MIN_GUARDIANS, threshold).
 *
 * Hai con số là hai khái niệm — trộn chúng là nguồn của bug "0 trên 2":
 * - `required` (≥ MIN_GUARDIANS=3): số người phải NHẬN LỜI để register được;
 * - `threshold` (≥ 2): số người phải KÝ khi cần cứu ví.
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
  const required = Math.max(MIN_GUARDIANS, input.threshold);
  const missing = Math.max(0, required - available);
  return {
    available,
    threshold: input.threshold,
    required,
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

/** Shape response của trang nhận lời mời CÔNG KHAI — nguồn duy nhất. */
export type PublicInviteView = {
  label: string;
  status: InviteStatus;
  usable: boolean;
  reason?: "expired" | "used";
  owner_name?: string | null;
  expires_at: Date;
};

/**
 * Dựng response public từ một lời mời — THUẦN, để test hermetic chứng minh
 * đường public không rò gì (A-Q3): hàm chỉ NHẬN label/status/expiresAt +
 * ownerName, về mặt kiểu không có chỗ cho email/địa chỉ ví/số dư lọt ra.
 *
 * Hết hạn vs đã dùng là HAI câu khác nhau trên màn ("xin link mới" ≠ "báo
 * người mời") — `sent`/`expired` quá hạn là expired, còn lại là used.
 * owner_name CHỈ kèm khi link còn sống: link chết không cần biết thêm gì.
 */
export function publicInviteView(
  invite: { label: string; status: InviteStatus; expiresAt: Date },
  ownerName: string | null,
  now: Date,
): PublicInviteView {
  const usable = isUsable(invite, now);
  if (!usable) {
    const reason = invite.status === "sent" || invite.status === "expired" ? "expired" : "used";
    return {
      label: invite.label,
      status: invite.status,
      usable,
      reason,
      expires_at: invite.expiresAt,
    };
  }
  return {
    label: invite.label,
    status: invite.status,
    usable,
    owner_name: ownerName,
    expires_at: invite.expiresAt,
  };
}
