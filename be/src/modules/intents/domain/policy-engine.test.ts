// Test policy engine hermetic: từng reason code + bất biến versioning
// (đổi/thêm policy KHÔNG ảnh hưởng intent cũ) + không có đường "cancel".
// Lô policy 2026-07-29: CURRENT = v2 — suite v1 GHIM version 1 tường minh
// (intent cũ ghi policy_version=1 đánh giá lại phải ra đúng kết quả cũ).
import { describe, expect, it } from "bun:test";
import { CURRENT_POLICY_VERSION, evaluatePolicy, type PolicyContext } from "./policy-engine";

const base: PolicyContext = {
  amount: 5_000_000n,
  recipient: "GKNOWN",
  knownRecipients: ["GKNOWN"],
  blacklist: [],
  perTxLimit: 100_000_000n,
  dailyLimit: 500_000_000n,
  dailySpent: 0n,
  nightWatchDelay: false,
};

describe("policy engine v1 (GHIM version 1 — bất biến versioning)", () => {
  it("người quen + dưới ngưỡng → allow, có reason (P5: không boolean trần)", () => {
    const r = evaluatePolicy(base, 1);
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["known_recipient_under_limit"]);
    expect(r.policyVersion).toBe(1);
  });

  it("sổ đen thắng mọi thứ → require_guardian blacklisted_recipient", () => {
    const r = evaluatePolicy({ ...base, blacklist: ["GKNOWN"] }, 1);
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["blacklisted_recipient"]);
  });

  it("người lạ Ở V1 → require_guardian unknown_recipient (hành vi cũ giữ nguyên)", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER" }, 1);
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toContain("unknown_recipient");
  });

  it("vượt hạn mức 1 lần + hạn mức ngày → gom ĐỦ reasons", () => {
    const r = evaluatePolicy({ ...base, amount: 200_000_000n, dailySpent: 400_000_000n }, 1);
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toContain("over_tx_limit");
    expect(r.reasons).toContain("over_daily_limit");
  });

  it("version lạ → POLICY_VERSION_UNKNOWN (không âm thầm dùng bản mới)", () => {
    expect(() => evaluatePolicy(base, 99)).toThrow("POLICY_VERSION_UNKNOWN:99");
  });

  it("bất biến versioning: gọi đích danh v1 luôn cho cùng kết quả bất kể CURRENT là gì", () => {
    const oldIntent = evaluatePolicy({ ...base, recipient: "GSTRANGER" }, 1);
    expect(oldIntent.policyVersion).toBe(1);
    expect(oldIntent.decision).toBe("require_guardian");
    expect(oldIntent.reasons).toEqual(["unknown_recipient"]);
  });
});

describe("policy engine v2 (CURRENT — C1/C4: người lạ KHÔNG còn tự nó bắt duyệt)", () => {
  it("CURRENT là v2", () => {
    expect(CURRENT_POLICY_VERSION).toBe(2);
  });

  it("C1: người LẠ + dưới ngưỡng → ALLOW, reason unknown_recipient chỉ để cảnh báo", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER" });
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["unknown_recipient"]);
    expect(r.policyVersion).toBe(2);
  });

  it("người quen + dưới ngưỡng → allow known_recipient_under_limit", () => {
    const r = evaluatePolicy(base);
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["known_recipient_under_limit"]);
  });

  it("C4: người LẠ vượt per_tx → require_guardian", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER", amount: 200_000_000n });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_tx_limit"]);
  });

  it("C2: người QUEN (guardian) vượt per_tx nhưng dưới daily → ĐI THẲNG", () => {
    // "Gửi 5000 XLM cho guardian → đi thẳng" (§6 ca 4): per_tx chỉ áp cho địa
    // chỉ lạ; trần của người quen là daily + trần cứng on-chain.
    const r = evaluatePolicy({ ...base, amount: 200_000_000n });
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["known_recipient_under_limit"]);
  });

  it("C4: cộng dồn vượt daily → require_guardian over_daily_limit (cả người quen)", () => {
    const r = evaluatePolicy({ ...base, dailySpent: 496_000_000n });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_daily_limit"]);
  });

  it("C4: daily áp cho CẢ địa chỉ lạ — dưới per_tx nhưng vượt daily vẫn chặn", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER", dailySpent: 496_000_000n });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_daily_limit"]);
  });

  it("C4: sổ đen vẫn chặn tuyệt đối", () => {
    const r = evaluatePolicy({ ...base, blacklist: ["GKNOWN"] });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["blacklisted_recipient"]);
  });

  it("người LẠ + vượt ngưỡng → reasons CHỈ chứa ngưỡng (unknown không gate)", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER", amount: 200_000_000n });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_tx_limit"]);
  });

  it("night-watch vẫn chỉ TRÌ HOÃN — kể cả với người lạ", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER", nightWatchDelay: true });
    expect(r.decision).toBe("delay");
    expect(r.reasons).toEqual(["risk_delay"]);
  });

  it("intent phi thanh toán → require_guardian non_payment_review (giữ nguyên)", () => {
    const r = evaluatePolicy({ ...base, amount: null, recipient: null });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["non_payment_review"]);
  });
});
