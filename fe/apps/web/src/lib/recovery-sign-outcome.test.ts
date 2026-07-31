// Lô R5 nhóm B — khoá taxonomy lỗi ký:
// 1. WALLET_NOT_CONNECTED (phiên ví hết) ≠ NO_ENTRY_FOR_WALLET (sai máy) —
//    trước lô này cả hai cùng ra "máy này không giữ chìa khoá bảo hộ".
// 2. ApiError mã RecoveryCancelled KHÔNG bị nhánh sign-error nuốt → tin tốt "đã đóng".
// 3. AlreadyApproved = THÀNH CÔNG (contract đếm người mở là phiếu đầu tiên).
// 4. Người dùng tự huỷ hộp thoại passkey → không render gì.
import { ApiError } from "@repo/core";
import { describe, expect, it } from "vitest";
import {
  approveOutcome,
  initiateOutcome,
  isPasskeyCancelled,
  vetoOutcome,
  walletSignCode,
} from "./recovery-sign-outcome";

/** Mô phỏng đúng contract của WalletSignError (name + message) — không import
 * sign-wallet-entries vì nó kéo kit (hash lúc import, vỡ jsdom). */
function signError(code: "WALLET_NOT_CONNECTED" | "NO_ENTRY_FOR_WALLET"): Error {
  const err = new Error(code);
  err.name = "WalletSignError";
  return err;
}

function contractError(code: string): ApiError {
  return new ApiError(code, 409, { error: { code } });
}

function passkeyCancel(): Error {
  const err = new Error("The operation either timed out or was not allowed.");
  err.name = "NotAllowedError";
  return err;
}

describe("walletSignCode — tách đúng hai mã", () => {
  it("WALLET_NOT_CONNECTED và NO_ENTRY_FOR_WALLET ra hai mã KHÁC nhau", () => {
    expect(walletSignCode(signError("WALLET_NOT_CONNECTED"))).toBe("WALLET_NOT_CONNECTED");
    expect(walletSignCode(signError("NO_ENTRY_FOR_WALLET"))).toBe("NO_ENTRY_FOR_WALLET");
  });
  it("lỗi khác → null", () => {
    expect(walletSignCode(new Error("boom"))).toBeNull();
    expect(walletSignCode(contractError("CONTRACT_ERROR:RecoveryCancelled"))).toBeNull();
  });
});

describe("approveOutcome (guardian/approve)", () => {
  it("WALLET_NOT_CONNECTED → reconfirm (KHÔNG phải deviceKeyMissing)", () => {
    expect(approveOutcome(signError("WALLET_NOT_CONNECTED"))).toEqual({ kind: "reconfirm" });
  });
  it("NO_ENTRY_FOR_WALLET → vẫn deviceKeyMissing", () => {
    expect(approveOutcome(signError("NO_ENTRY_FOR_WALLET"))).toEqual({
      kind: "error",
      key: "guardian.approve.errors.deviceKeyMissing",
    });
  });
  it("🔴 ApiError RecoveryCancelled KHÔNG bị nhánh sign-error nuốt → closed (tin tốt)", () => {
    for (const code of [
      "CONTRACT_ERROR:RecoveryCancelled",
      "CONTRACT_ERROR:NoActiveRecovery",
      "CONTRACT_ERROR:AlreadyFinalized",
    ]) {
      expect(approveOutcome(contractError(code))).toEqual({ kind: "closed" });
    }
  });
  it("AlreadyApproved → recorded (biến thể THÀNH CÔNG, không phải lỗi)", () => {
    expect(approveOutcome(contractError("CONTRACT_ERROR:AlreadyApproved"))).toEqual({
      kind: "recorded",
    });
  });
  it("người dùng huỷ hộp thoại passkey → silent, không render lỗi", () => {
    expect(approveOutcome(passkeyCancel())).toEqual({ kind: "silent" });
  });
  it("lỗi lạ → notSent (chưa gì đến mạng, thử lại an toàn)", () => {
    expect(approveOutcome(new Error("network down"))).toEqual({
      kind: "error",
      key: "guardian.approve.errors.notSent",
    });
  });
});

describe("initiateOutcome (guardian/initiate) — cùng cách phân loại", () => {
  it("WALLET_NOT_CONNECTED → reconfirm; NO_ENTRY → deviceKeyMissing", () => {
    expect(initiateOutcome(signError("WALLET_NOT_CONNECTED"))).toEqual({ kind: "reconfirm" });
    expect(initiateOutcome(signError("NO_ENTRY_FOR_WALLET"))).toEqual({
      kind: "error",
      key: "guardian.initiate.errors.deviceKeyMissing",
    });
  });
  it("tráo khoá (SignerMismatchError) vẫn đứng đầu — cảnh báo an ninh", () => {
    const err = new Error("SIGNER_MISMATCH");
    err.name = "SignerMismatchError";
    expect(initiateOutcome(err)).toEqual({
      kind: "error",
      key: "guardian.initiate.errors.mismatch",
    });
  });
  it("RecoveryInProgress → alreadyOpen; huỷ passkey → silent", () => {
    expect(initiateOutcome(contractError("CONTRACT_ERROR:RecoveryInProgress"))).toEqual({
      kind: "error",
      key: "guardian.initiate.errors.alreadyOpen",
    });
    expect(initiateOutcome(passkeyCancel())).toEqual({ kind: "silent" });
  });
});

describe("vetoOutcome (block/confirm) — cùng cách phân loại", () => {
  it("WALLET_NOT_CONNECTED → reconfirm (trước đây là walletLocked bắt mở ví tay)", () => {
    expect(vetoOutcome(signError("WALLET_NOT_CONNECTED"))).toEqual({ kind: "reconfirm" });
  });
  it("đã có người chặn trước → stopped (tin tốt); AlreadyFinalized → tooLate", () => {
    expect(vetoOutcome(contractError("CONTRACT_ERROR:RecoveryCancelled"))).toEqual({
      kind: "stopped",
    });
    expect(vetoOutcome(contractError("CONTRACT_ERROR:NoActiveRecovery"))).toEqual({
      kind: "stopped",
    });
    expect(vetoOutcome(contractError("CONTRACT_ERROR:AlreadyFinalized"))).toEqual({
      kind: "error",
      key: "block.confirm.errors.tooLate",
    });
  });
  it("huỷ passkey → silent; NO_ENTRY/lỗi lạ → notSent", () => {
    expect(vetoOutcome(passkeyCancel())).toEqual({ kind: "silent" });
    expect(vetoOutcome(signError("NO_ENTRY_FOR_WALLET"))).toEqual({
      kind: "error",
      key: "block.confirm.errors.notSent",
    });
  });
});

describe("isPasskeyCancelled", () => {
  it("NotAllowedError / AbortError / WALLET_CONNECT_CANCELLED → true", () => {
    expect(isPasskeyCancelled(passkeyCancel())).toBe(true);
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(isPasskeyCancelled(abort)).toBe(true);
    expect(isPasskeyCancelled(new Error("WALLET_CONNECT_CANCELLED"))).toBe(true);
  });
  it("lỗi thường → false", () => {
    expect(isPasskeyCancelled(new Error("boom"))).toBe(false);
  });
});
