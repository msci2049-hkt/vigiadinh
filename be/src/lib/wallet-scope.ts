// Scope VÍ của session — hệ quả trực tiếp của "passkey là chìa khoá thật".
//
// Session sinh từ passkey (sep45/exchange) mang `activeWalletId` = ví ĐÃ ký.
// Tài khoản có 2 ví: passkey ví A chứng minh sở hữu VÍ A, không chứng minh gì về
// ví B — nếu session đó hành động được trên B thì cửa đổi đã nới quyền ngoài ý
// muốn. Helper này là MỘT chỗ trả lời "session này được đụng ví X không".
//
// Hai luật đọc kỹ trước khi gọi:
// 1. NULL/undefined scope = session email/OTP → KHÔNG scope (hành vi cũ — email
//    đăng nhập vốn thấy mọi ví của user; lô này không đổi điều đó).
// 2. Chỉ áp cho hành động CỦA CHỦ VÍ trên một ví cụ thể. Hành động của GUARDIAN
//    trên ví NGƯỜI KHÁC (duyệt intent, bỏ phiếu khôi phục) đi đường bảng approval
//    riêng — cấm gắn scope vào đó: guardian scope theo ví-danh-tính của chính họ
//    thì mọi cửa duyệt sẽ chết oan.
import { HTTPException } from "hono/http-exception";

/** Hình session tối thiểu helper cần — khớp record Better Auth sau additionalFields. */
export type WalletScopedSession = { activeWalletId?: string | null } | null | undefined;

export function walletScopeAllows(session: WalletScopedSession, walletId: string): boolean {
  const scope = session?.activeWalletId;
  return !scope || scope === walletId;
}

/**
 * Ném 403 khi session bị scope vào ví khác. Mã lỗi riêng (không phải NOT_OWNER):
 * người này LÀ chủ ví, chỉ đang cầm nhầm chìa — FE dịch thành "ký bằng khoá của
 * ví này để thao tác trên nó".
 */
export function assertWalletScope(session: WalletScopedSession, walletId: string): void {
  if (!walletScopeAllows(session, walletId)) {
    throw new HTTPException(403, { message: "WALLET_OUT_OF_SCOPE" });
  }
}
