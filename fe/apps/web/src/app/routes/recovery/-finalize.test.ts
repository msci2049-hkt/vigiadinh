// Lô R6 nhóm D — hai bất biến của nút "Lấy lại ví".
//
// (1) KHÔNG chạm vân tay. `finalize_recovery` không đòi chữ ký người dùng nào
//     (contract lib.rs:378 — ai crank cũng được sau timelock; timelock +
//     threshold là người gác on-chain). Bắt người vừa mất máy chạm passkey ở
//     bước này là dựng một cửa GIẢ mà chính họ có thể không qua nổi. Test đo
//     bằng cách mock cả tầng kit + tầng ký rồi khẳng định KHÔNG hàm nào bị gọi.
//
// (2) Mỗi mã lỗi contract MỘT CÂU. Gộp thành "không gửi được" là bắt họ tự đoán
//     xem đang chờ thêm, bị chặn, hay đã xong từ lúc nào.
import { ApiError } from "@repo/core";
import { describe, expect, it, vi } from "vitest";

const connectWallet = vi.fn();
const getWalletKit = vi.fn(() => ({ connectWallet, credentials: { create: vi.fn() } }));
const signRecoveryEntries = vi.fn();

vi.mock("@/features/wallet/lib/kit", () => ({ getWalletKit }));
vi.mock("@/features/wallet/lib/sign-recovery-entries", () => ({ signRecoveryEntries }));

const post = vi.fn();
vi.mock("@/lib/api-client", () => ({ apiClient: { post } }));

const { finalizeRecovery } = await import("@/features/family/api/recovery-actions");
const { finalizeOutcome } = await import("@/lib/recovery-sign-outcome");

function contractError(code: string): ApiError {
  return new ApiError("boom", 409, { error: { code, message: code } });
}

describe("R6 — nút Lấy lại ví KHÔNG chạm vân tay", () => {
  it("gọi /api/recovery/finalize và KHÔNG chạm kit / không ký entry nào", async () => {
    post.mockReset();
    connectWallet.mockReset();
    signRecoveryEntries.mockReset();
    getWalletKit.mockClear();
    post.mockResolvedValue({ data: { method: "finalize_recovery", hash: "h", status: "SUCCESS" } });

    const result = await finalizeRecovery({ walletId: "01JWALLET0000000000000000" });

    expect(post).toHaveBeenCalledWith("/api/recovery/finalize", {
      wallet_id: "01JWALLET0000000000000000",
    });
    expect(result.hash).toBe("h");
    // Ba chốt chặn: không mở kit, không connect ví, không ký entry nào.
    expect(getWalletKit).not.toHaveBeenCalled();
    expect(connectWallet).not.toHaveBeenCalled();
    expect(signRecoveryEntries).not.toHaveBeenCalled();
  });

  it("KHÔNG gửi auth entry nào lên BE (body chỉ có wallet_id)", async () => {
    post.mockReset();
    post.mockResolvedValue({ data: { method: "finalize_recovery", hash: "h", status: "SUCCESS" } });
    await finalizeRecovery({ walletId: "01JWALLET0000000000000000" });
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["wallet_id"]);
    expect(body.signed_entries).toBeUndefined();
  });
});

describe("R6 — mỗi mã lỗi finalize một câu riêng", () => {
  it("TimelockNotElapsed = chưa tới giờ, KHÔNG phải lỗi", () => {
    expect(finalizeOutcome(contractError("CONTRACT_ERROR:TimelockNotElapsed"))).toEqual({
      kind: "tooEarly",
    });
  });

  it("AlreadyFinalized = TIN TỐT (máy khác bấm trước)", () => {
    expect(finalizeOutcome(contractError("CONTRACT_ERROR:AlreadyFinalized"))).toEqual({
      kind: "done",
    });
  });

  it("RecoveryCancelled / NoActiveRecovery = chủ ví đã chặn", () => {
    expect(finalizeOutcome(contractError("CONTRACT_ERROR:RecoveryCancelled"))).toEqual({
      kind: "stopped",
    });
    expect(finalizeOutcome(contractError("CONTRACT_ERROR:NoActiveRecovery"))).toEqual({
      kind: "stopped",
    });
  });

  it("ThresholdNotMet / RequestExpired / sai tài khoản — ba câu KHÁC NHAU", () => {
    const keys = [
      finalizeOutcome(contractError("CONTRACT_ERROR:ThresholdNotMet")),
      finalizeOutcome(contractError("CONTRACT_ERROR:RequestExpired")),
      finalizeOutcome(contractError("NOT_WALLET_MEMBER")),
    ].map((o) => (o.kind === "error" ? o.key : o.kind));
    expect(new Set(keys).size).toBe(3);
    expect(keys).toEqual([
      "recovery.finalize.errors.notEnoughVotes",
      "recovery.finalize.errors.expired",
      "recovery.finalize.errors.notYourWallet",
    ]);
  });

  it("lỗi lạ → 'chưa gửi được', KHÔNG nhận nhầm thành đã xong", () => {
    expect(finalizeOutcome(new Error("mạng rớt"))).toEqual({
      kind: "error",
      key: "recovery.finalize.errors.notSent",
    });
  });
});
