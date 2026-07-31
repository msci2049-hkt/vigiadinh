// Lô R5 §4 — xin lại phiên ví khi WALLET_NOT_CONNECTED, ĐÚNG MỘT LẦN:
//   bấm nút → login SEP-45 (một chạm vân tay: challenge → ký → /api/sep45/token
//   → /api/auth/sep45/exchange, tất cả trong connectAndLogin) → thử ký lại MỘT
//   lần → vẫn hỏng thì mới hiện thông báo.
// 🔴 Không tự chạy ngầm (WebAuthn đòi cử chỉ người dùng) và KHÔNG lặp — vòng
// lặp xin phiên là cách chắc nhất khoá người dùng khỏi ví của họ.
// THUẦN + login tiêm được → test đếm được số lần gọi (jsdom-safe, không kit).
import { isPasskeyCancelled } from "./recovery-sign-outcome";

export type ReconfirmOutcome = "retried" | "cancelled" | "failed";

export async function runSessionReconfirm(input: {
  login: () => Promise<unknown>;
  retry: () => void;
}): Promise<ReconfirmOutcome> {
  try {
    await input.login();
  } catch (err) {
    // Người dùng tự huỷ hộp thoại → không đốt lượt, không hiện lỗi (§4).
    return isPasskeyCancelled(err) ? "cancelled" : "failed";
  }
  input.retry(); // thử ký lại MỘT lần — kết quả hiển thị qua mutation state
  return "retried";
}
