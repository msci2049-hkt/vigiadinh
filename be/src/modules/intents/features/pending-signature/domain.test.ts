import { describe, expect, it } from "bun:test";
import { pendingSignatureView } from "./domain";

describe("pendingSignatureView — lệnh chờ CHÍNH chủ ví ký (lô vá L2)", () => {
  const row = {
    intentId: "01TEST0000000000000000INT1",
    walletId: "01TEST0000000000000000WLT1",
    walletAddress: "CAEDGA447G2JCTFPN2YNEGPGTCBMXYHCS324IOVC3A35KD7UNUZOQHBY",
    amount: 5_000_000_000n,
    recipient: "CCCHHBTWBNH5TQOELVTJFWININDXIXTR6LEEHBHATRPVCRUD5B2OGIPF",
    reasons: ["over_tx_limit", 42] as unknown,
    createdAt: new Date("2026-07-30T09:55:40Z"),
    expiresAt: new Date("2026-07-31T09:55:40Z"),
  };

  it("chốt key-list — thêm trường mới (vd challenge_hash, balance) là test này ĐỎ", () => {
    const view = pendingSignatureView(row);
    expect(Object.keys(view).sort()).toEqual([
      "amount",
      "created_at",
      "expires_at",
      "from",
      "intent_id",
      "reasons",
      "recipient",
      "wallet_id",
    ]);
  });

  it("recipient + from ĐẦY ĐỦ (khác view guardian) — thiếu là chống-ký-mù không chạy được", () => {
    const view = pendingSignatureView(row);
    expect(view.recipient).toBe(row.recipient);
    expect(view.from).toBe(row.walletAddress);
    expect(view.amount).toBe("5000000000");
    expect(view.reasons).toEqual(["over_tx_limit"]);
  });

  it("intent phi thanh toán (amount null) → amount null, không nổ", () => {
    const view = pendingSignatureView({ ...row, amount: null, recipient: null });
    expect(view.amount).toBeNull();
    expect(view.recipient).toBeNull();
  });

  it("reasons kiểu lạ (không phải mảng) → mảng rỗng", () => {
    expect(pendingSignatureView({ ...row, reasons: { evil: true } }).reasons).toEqual([]);
  });
});
