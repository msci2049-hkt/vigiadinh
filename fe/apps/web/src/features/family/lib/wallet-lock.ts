// "Ví này gửi tiền ra ngoài được chưa?" — THUẦN, test hermetic.
//
// Vì sao tồn tại (sự cố 29/07): chủ ví có 1.000 XLM bấm Gửi 50 XLM, đi hết form
// → màn xác nhận → rồi chết bằng một câu chung chung, không hỏi vân tay, không
// nói lý do. Nguyên nhân thật nằm ở đầu chuỗi: ví 0 người bảo hộ ⇒ chưa
// `register_wallet` được (contract panic #4 TooFewGuardians dưới 3 người) ⇒ ví phí
// từ chối trả gas (`WALLET_NOT_REGISTERED_FOR_SPONSORSHIP`). Thông tin đó đã nằm
// sẵn trên máy người dùng TỪ TRƯỚC KHI họ gõ số tiền — chỉ là không ai hỏi.
//
// Hai điều kiện, HAI bước tiếp theo KHÁC NHAU — trộn là chỉ sai đường người dùng:
//   1. chưa đủ người nhận lời  → phải MỜI THÊM (available < required)
//   2. đủ người rồi mà ví chưa đăng ký lên registry → phải HOÀN TẤT bước cuối
//
// FAIL-OPEN có chủ đích: thiếu dữ liệu (query đang chạy / chain 502) thì KHÔNG
// khoá. Khoá nhầm một ví lành là chặn người dùng khỏi tiền của họ dựa trên phỏng
// đoán; để lọt thì lưới thứ hai (map lỗi 403 ở màn gửi) vẫn nói đúng câu.
import { MIN_GUARDIANS } from "@/lib/auth-entry-guard";
import type { Recoverability } from "../api/invites";

export type WalletLockStep = "invite" | "register";

export type WalletLock =
  | { locked: false }
  | {
      locked: true;
      step: WalletLockStep;
      /** Số người bảo hộ ĐÃ lên chain. */
      available: number;
      /** Số người tối thiểu phải lên chain = max(3, threshold). */
      required: number;
      missing: number;
    };

const UNLOCKED: WalletLock = { locked: false };

export function walletSendLock(input: {
  /** `recoverability` từ GET /api/guardians/invites/wallet/:id — undefined = chưa biết. */
  recoverability?: Recoverability | undefined;
  /** `registered` từ GET /api/recovery/chain-truth/:id — undefined = chưa biết/không đọc được. */
  registeredOnchain?: boolean | undefined;
}): WalletLock {
  const r = input.recoverability;
  // Chưa biết số người → không khoá, và cũng không bịa ra con số "0/3" để hiện.
  if (!r) return UNLOCKED;

  // Cùng công thức fallback với RecoverabilityBanner: BE bản cũ chưa trả `required`.
  const required = r.required ?? Math.max(MIN_GUARDIANS, r.threshold);
  const available = r.available;
  const missing = r.missing || Math.max(0, required - available);

  if (!r.recoverable) return { locked: true, step: "invite", available, required, missing };
  // Đủ người rồi: chỉ khoá khi CHAIN nói thẳng là chưa đăng ký. `undefined`
  // (chain-truth 502 / chưa gọi) KHÔNG được coi là "chưa đăng ký".
  if (input.registeredOnchain === false) {
    return { locked: true, step: "register", available, required, missing };
  }
  return UNLOCKED;
}
