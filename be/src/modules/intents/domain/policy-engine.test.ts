// Test policy engine hermetic: từng reason code + bất biến versioning
// (đổi/thêm policy KHÔNG ảnh hưởng intent cũ) + không có đường "cancel".
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

describe("policy engine v1", () => {
  it("người quen + dưới ngưỡng → allow, có reason (P5: không boolean trần)", () => {
    const r = evaluatePolicy(base);
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["known_recipient_under_limit"]);
    expect(r.policyVersion).toBe(CURRENT_POLICY_VERSION);
  });

  it("sổ đen thắng mọi thứ → require_guardian blacklisted_recipient", () => {
    const r = evaluatePolicy({ ...base, blacklist: ["GKNOWN"] });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["blacklisted_recipient"]);
  });

  it("người lạ → require_guardian unknown_recipient", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER" });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toContain("unknown_recipient");
  });

  it("vượt hạn mức 1 lần + hạn mức ngày → gom ĐỦ reasons", () => {
    const r = evaluatePolicy({
      ...base,
      amount: 200_000_000n,
      dailySpent: 400_000_000n,
    });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toContain("over_tx_limit");
    expect(r.reasons).toContain("over_daily_limit");
  });

  it("night-watch chỉ TRÌ HOÃN người quen dưới ngưỡng — không bao giờ cancel", () => {
    const r = evaluatePolicy({ ...base, nightWatchDelay: true });
    expect(r.decision).toBe("delay");
    expect(r.reasons).toEqual(["risk_delay"]);
  });

  it("intent phi thanh toán → require_guardian non_payment_review", () => {
    const r = evaluatePolicy({ ...base, amount: null, recipient: null });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["non_payment_review"]);
  });

  it("version lạ → POLICY_VERSION_UNKNOWN (không âm thầm dùng bản mới)", () => {
    expect(() => evaluatePolicy(base, 99)).toThrow("POLICY_VERSION_UNKNOWN:99");
  });

  it("bất biến versioning: gọi đích danh v1 luôn cho cùng kết quả bất kể CURRENT là gì", () => {
    // Intent cũ ghi policy_version=1 → đánh giá lại PHẢI bằng engine v1.
    // (Thêm v2 vào registry là THÊM key mới — test này khoá hành vi v1.)
    const oldIntent = evaluatePolicy({ ...base, recipient: "GSTRANGER" }, 1);
    expect(oldIntent.policyVersion).toBe(1);
    expect(oldIntent.decision).toBe("require_guardian");
    expect(oldIntent.reasons).toEqual(["unknown_recipient"]);
  });
});
