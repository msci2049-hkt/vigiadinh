import { describe, expect, it } from "bun:test";
import { pendingApprovalView } from "./domain";

describe("pendingApprovalView — phiếu chờ sang chiều guardian KHÔNG rò dữ liệu (LÔ 1)", () => {
  const row = {
    approvalId: "01TEST0000000000000000APR1",
    intentId: "01TEST0000000000000000INT1",
    walletId: "01TEST0000000000000000WLT1",
    ownerName: "Huy",
    amount: 100_000_000n,
    recipient: "CDBXNYQ53HHEF6GPGR4IDT2NWZVBMUB66D7N2SDMSDT7EGWUKKAR3PBT",
    reasons: ["unknown_recipient", 42] as unknown,
    expiresAt: new Date("2026-07-30T00:00:00Z"),
  };

  it("chốt key-list — thêm trường mới (vd challenge_hash) là test này ĐỎ, buộc người sửa tự trả lời 'trường này có an toàn không'", () => {
    const view = pendingApprovalView(row);
    expect(Object.keys(view).sort()).toEqual([
      "amount",
      "approval_id",
      "expires_at",
      "intent_id",
      "owner_name",
      "reasons",
      "recipient_short",
      "wallet_id",
    ]);
  });

  it("recipient RÚT GỌN (không lộ địa chỉ đầy đủ), amount là chuỗi stroops, reasons chỉ giữ string", () => {
    const view = pendingApprovalView(row);
    expect(view.recipient_short).toBe("CDBX…3PBT");
    expect(view.recipient_short.length).toBeLessThan(12);
    expect(view.amount).toBe("100000000");
    expect(view.reasons).toEqual(["unknown_recipient"]);
  });

  it("reasons kiểu lạ (không phải mảng) → mảng rỗng, không nổ", () => {
    expect(pendingApprovalView({ ...row, reasons: { evil: true } }).reasons).toEqual([]);
  });
});
