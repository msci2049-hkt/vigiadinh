// Lô R5 nhóm B — phân loại lỗi KÝ của luồng khôi phục, dùng chung ba màn
// approve / initiate / block-confirm. Trước lô này cả WALLET_NOT_CONNECTED
// (phiên ví hết — máy VẪN CÓ passkey) lẫn NO_ENTRY_FOR_WALLET (sai máy/sai
// tài khoản) đều trả "máy này không giữ chìa khoá bảo hộ" — người dùng phải
// đăng xuất oan trong khi chỉ cần chạm vân tay xin lại phiên.
//
// THUẦN, jsdom-safe: nhận diện WalletSignError qua err.name + err.message —
// KHÔNG import sign-wallet-entries (nó kéo theo kit, mà kit hash lúc import
// nên vỡ dưới jsdom — cùng lý do sep45-exchange phải tách file).
import { ApiError } from "@repo/core";

/** Mã lỗi trong envelope BE `{error:{code}}` — null nếu không phải ApiError. */
export function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const data = err.data as { error?: { code?: string } } | null;
  return data?.error?.code ?? null;
}

export type WalletSignCode = "WALLET_NOT_CONNECTED" | "NO_ENTRY_FOR_WALLET";

export function walletSignCode(err: unknown): WalletSignCode | null {
  if (!(err instanceof Error) || err.name !== "WalletSignError") return null;
  return err.message === "WALLET_NOT_CONNECTED" || err.message === "NO_ENTRY_FOR_WALLET"
    ? err.message
    : null;
}

/** Người dùng TỰ bấm huỷ hộp thoại passkey (WebAuthn NotAllowedError/AbortError,
 * hoặc huỷ chọn khoá lúc connect) → §4: KHÔNG render lỗi nào cả. */
export function isPasskeyCancelled(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "NotAllowedError" ||
      err.name === "AbortError" ||
      err.message === "WALLET_CONNECT_CANCELLED")
  );
}

/** Mã contract "lệnh đã đóng" — người khác đã chặn / không còn yêu cầu / đã xong. */
const CLOSED_CODES = new Set([
  "CONTRACT_ERROR:RecoveryCancelled",
  "CONTRACT_ERROR:NoActiveRecovery",
  "CONTRACT_ERROR:AlreadyFinalized",
]);

// ── Màn guardian BỎ PHIẾU (guardian/approve) ────────────────────────────────

export type ApproveOutcome =
  | { kind: "silent" } // huỷ hộp thoại passkey — không hiện gì
  | { kind: "reconfirm" } // phiên ví hết — nút "xác nhận lại bằng vân tay"
  | { kind: "recorded" } // AlreadyApproved — tích xanh, phiếu ĐÃ trên mạng
  | { kind: "closed" } // lệnh đã đóng — tin tốt, không phải lỗi
  | {
      kind: "error";
      key: "guardian.approve.errors.deviceKeyMissing" | "guardian.approve.errors.notSent";
    };

export function approveOutcome(err: unknown): ApproveOutcome {
  // B2: mã contract đọc TRƯỚC — nhánh sign-error không được che RecoveryCancelled.
  const code = apiErrorCode(err);
  if (code === "CONTRACT_ERROR:AlreadyApproved") return { kind: "recorded" };
  if (code && CLOSED_CODES.has(code)) return { kind: "closed" };
  const sign = walletSignCode(err);
  if (sign === "WALLET_NOT_CONNECTED") return { kind: "reconfirm" };
  if (sign === "NO_ENTRY_FOR_WALLET") {
    return { kind: "error", key: "guardian.approve.errors.deviceKeyMissing" };
  }
  if (isPasskeyCancelled(err)) return { kind: "silent" };
  return { kind: "error", key: "guardian.approve.errors.notSent" };
}

// ── Màn guardian MỞ khôi phục (guardian/initiate) ───────────────────────────

export type InitiateOutcome =
  | { kind: "silent" }
  | { kind: "reconfirm" }
  | {
      kind: "error";
      key:
        | "guardian.initiate.errors.mismatch"
        | "guardian.initiate.errors.alreadyOpen"
        | "guardian.initiate.errors.deviceKeyMissing"
        | "guardian.initiate.errors.notSent";
    };

export function initiateOutcome(err: unknown): InitiateOutcome {
  // Tráo khoá (chống-ký-mù) đứng đầu — cảnh báo an ninh không nhường ai.
  if (err instanceof Error && err.name === "SignerMismatchError") {
    return { kind: "error", key: "guardian.initiate.errors.mismatch" };
  }
  if (apiErrorCode(err) === "CONTRACT_ERROR:RecoveryInProgress") {
    return { kind: "error", key: "guardian.initiate.errors.alreadyOpen" };
  }
  const sign = walletSignCode(err);
  if (sign === "WALLET_NOT_CONNECTED") return { kind: "reconfirm" };
  if (sign === "NO_ENTRY_FOR_WALLET") {
    return { kind: "error", key: "guardian.initiate.errors.deviceKeyMissing" };
  }
  if (isPasskeyCancelled(err)) return { kind: "silent" };
  return { kind: "error", key: "guardian.initiate.errors.notSent" };
}

// ── Màn NGƯỜI XIN KHÔI PHỤC bấm "Lấy lại ví" (recovery/countdown) ────────────
//
// Lô R6. Khác ba màn trên ở một điểm quyết định: `finalize_recovery` KHÔNG đòi
// chữ ký người dùng nào (lib.rs:378 — ai crank cũng được sau timelock, timelock
// + threshold là người gác on-chain). Nên ở đây KHÔNG có nhánh sign-error, không
// có `reconfirm`, không chạm passkey. Mọi lỗi đều là mã contract hoặc mã cửa BE.
//
// Mỗi mã MỘT CÂU riêng: gộp chúng thành "không gửi được" là bắt người vừa mất
// máy tự đoán xem họ đang chờ thêm, bị chặn, hay đã xong từ lúc nào.

export type FinalizeOutcome =
  | { kind: "tooEarly" } // chưa hết khoảng chờ — đếm ngược vẫn chạy
  | { kind: "done" } // đã hoàn tất rồi (máy khác bấm trước)
  | { kind: "stopped" } // chủ ví đã chặn
  | {
      kind: "error";
      key:
        | "recovery.finalize.errors.notEnoughVotes"
        | "recovery.finalize.errors.expired"
        | "recovery.finalize.errors.notYourWallet"
        | "recovery.finalize.errors.notSent";
    };

export function finalizeOutcome(err: unknown): FinalizeOutcome {
  const code = apiErrorCode(err);
  switch (code) {
    case "CONTRACT_ERROR:TimelockNotElapsed":
      return { kind: "tooEarly" };
    case "CONTRACT_ERROR:AlreadyFinalized":
      return { kind: "done" };
    case "CONTRACT_ERROR:RecoveryCancelled":
    case "CONTRACT_ERROR:NoActiveRecovery":
      return { kind: "stopped" };
    case "CONTRACT_ERROR:ThresholdNotMet":
      return { kind: "error", key: "recovery.finalize.errors.notEnoughVotes" };
    case "CONTRACT_ERROR:RequestExpired":
      return { kind: "error", key: "recovery.finalize.errors.expired" };
    // Cửa BE: đăng nhập bằng tài khoản KHÔNG phải chủ ví (hay người bảo hộ) của
    // ví đó. Không phải lỗi hạ tầng — chỉ là sai tài khoản, và nói đúng thế.
    case "NOT_WALLET_MEMBER":
    case "WALLET_NOT_FOUND":
      return { kind: "error", key: "recovery.finalize.errors.notYourWallet" };
    default:
      return { kind: "error", key: "recovery.finalize.errors.notSent" };
  }
}

// ── Màn chủ ví CHẶN khôi phục (block/confirm) ───────────────────────────────

export type VetoOutcome =
  | { kind: "silent" }
  | { kind: "reconfirm" }
  | { kind: "stopped" } // đã có người chặn trước — tin tốt
  | { kind: "error"; key: "block.confirm.errors.tooLate" | "block.confirm.errors.notSent" };

export function vetoOutcome(err: unknown): VetoOutcome {
  const code = apiErrorCode(err);
  if (code === "CONTRACT_ERROR:RecoveryCancelled" || code === "CONTRACT_ERROR:NoActiveRecovery") {
    return { kind: "stopped" };
  }
  if (code === "CONTRACT_ERROR:AlreadyFinalized") {
    return { kind: "error", key: "block.confirm.errors.tooLate" };
  }
  const sign = walletSignCode(err);
  if (sign === "WALLET_NOT_CONNECTED") return { kind: "reconfirm" };
  // NO_ENTRY với màn chặn = ví đang connect KHÔNG phải ví bị tấn công — chưa
  // có gì được gửi, giữ ngôn ngữ "chưa gửi, thử lại an toàn".
  if (isPasskeyCancelled(err)) return { kind: "silent" };
  return { kind: "error", key: "block.confirm.errors.notSent" };
}
