// Test policy engine hermetic: từng reason code + bất biến versioning
// (đổi/thêm policy KHÔNG ảnh hưởng intent cũ) + không có đường "cancel".
// Lô policy 2026-07-29: v2 — suite v1 GHIM version 1 tường minh.
// Lô vá cửa hậu 2026-07-30: CURRENT = v3 — suite v2 GHIM version 2 tường minh
// (intent cũ ghi policy_version=2 đánh giá lại phải ra ĐÚNG kết quả cũ, kể cả
// khi kết quả cũ đó chính là cửa hậu ta vừa đóng — đó là ý nghĩa của versioning).
import { describe, expect, it } from "bun:test";
import { CURRENT_POLICY_VERSION, evaluatePolicy, type PolicyContext } from "./policy-engine";

/** `GKNOWN` = địa chỉ ĐÃ TỪNG GỬI, KHÔNG phải guardian. Bản cũ của fixture này
 * để `knownRecipients: ["GKNOWN"]` rồi đặt tên ca test là "người QUEN (guardian)"
 * — chính chỗ lẫn tên đó khoá ngữ nghĩa sai suốt một lô. Guardian nay có tập
 * riêng `guardianAddresses` và fixture giữ nó RỖNG để mọi ca "người quen" dưới
 * đây là người quen thật: từng nhận tiền, chưa ký cam kết gì. */
const base: PolicyContext = {
  amount: 5_000_000n,
  recipient: "GKNOWN",
  knownRecipients: ["GKNOWN"],
  guardianAddresses: [],
  blacklist: [],
  perTxLimit: 100_000_000n,
  dailyLimit: 500_000_000n,
  dailySpent: 0n,
  nightWatchDelay: false,
};

/** Ví có guardian on-chain `GGUARD` — tập miễn `per_tx` DUY NHẤT của v3. */
const withGuardian: PolicyContext = {
  ...base,
  recipient: "GGUARD",
  guardianAddresses: ["GGUARD"],
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

describe("policy engine v2 (GHIM version 2 — bất biến versioning)", () => {
  it("C1: người LẠ + dưới ngưỡng → ALLOW, reason unknown_recipient chỉ để cảnh báo", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER" }, 2);
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["unknown_recipient"]);
    expect(r.policyVersion).toBe(2);
  });

  it("người quen + dưới ngưỡng → allow known_recipient_under_limit", () => {
    const r = evaluatePolicy(base, 2);
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["known_recipient_under_limit"]);
  });

  it("C4: người LẠ vượt per_tx → require_guardian", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER", amount: 200_000_000n }, 2);
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_tx_limit"]);
  });

  it("CỬA HẬU CỦA v2 GIỮ NGUYÊN: địa chỉ TỪNG GỬI vượt per_tx vẫn đi thẳng", () => {
    // Đây CHÍNH LÀ lỗ v3 đóng lại. Ca này cố ý còn xanh: intent cũ ghi
    // policy_version=2 đánh giá lại phải ra đúng kết quả nó đã ra ngày hôm đó —
    // sửa engine cũ cho "đẹp" là làm sai lịch sử. Ví MỚI không đi qua đây nữa
    // (CURRENT = 3), xem ca đối xứng trong suite v3.
    const r = evaluatePolicy({ ...base, amount: 200_000_000n }, 2);
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["known_recipient_under_limit"]);
  });

  it("C4: cộng dồn vượt daily → require_guardian over_daily_limit (cả người quen)", () => {
    const r = evaluatePolicy({ ...base, dailySpent: 496_000_000n }, 2);
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_daily_limit"]);
  });

  it("C4: daily áp cho CẢ địa chỉ lạ — dưới per_tx nhưng vượt daily vẫn chặn", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER", dailySpent: 496_000_000n }, 2);
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_daily_limit"]);
  });

  it("C4: sổ đen vẫn chặn tuyệt đối", () => {
    const r = evaluatePolicy({ ...base, blacklist: ["GKNOWN"] }, 2);
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["blacklisted_recipient"]);
  });

  it("night-watch vẫn chỉ TRÌ HOÃN — kể cả với người lạ", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER", nightWatchDelay: true }, 2);
    expect(r.decision).toBe("delay");
    expect(r.reasons).toEqual(["risk_delay"]);
  });

  it("intent phi thanh toán → require_guardian non_payment_review", () => {
    const r = evaluatePolicy({ ...base, amount: null, recipient: null }, 2);
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["non_payment_review"]);
  });

  it("v2 KHÔNG đọc guardianAddresses — thêm field không đổi hành vi bản cũ", () => {
    const a = evaluatePolicy({ ...base, recipient: "GSTRANGER", amount: 200_000_000n }, 2);
    const b = evaluatePolicy(
      { ...base, recipient: "GSTRANGER", amount: 200_000_000n, guardianAddresses: ["GSTRANGER"] },
      2,
    );
    expect(b).toEqual(a);
    expect(b.decision).toBe("require_guardian");
  });
});

describe("policy engine v3 (CURRENT — per_tx áp MỌI địa chỉ, chỉ guardian miễn)", () => {
  it("CURRENT là v3", () => {
    expect(CURRENT_POLICY_VERSION).toBe(3);
  });

  it("🔴 CỬA HẬU ĐÃ ĐÓNG: địa chỉ TỪNG GỬI vượt per_tx → require_guardian", () => {
    // Ca khai thác thật trên ví 01KYRQ07WM… (2026-07-30 16:58→16:59): gửi 100
    // XLM cho địa chỉ lạ → settled → 52 giây sau gửi 600 XLM cho CHÍNH nó (3×
    // per_tx 200) vẫn đi thẳng. `GKNOWN` ở đây đúng là địa chỉ đã settled đó.
    const r = evaluatePolicy({ ...base, amount: 200_000_000n });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_tx_limit"]);
    expect(r.policyVersion).toBe(3);
  });

  it("guardian vượt per_tx, dưới daily → ĐI THẲNG (miễn trừ DUY NHẤT)", () => {
    const r = evaluatePolicy({ ...withGuardian, amount: 200_000_000n });
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["known_recipient_under_limit"]);
  });

  it("guardian vượt daily → require_guardian (daily KHÔNG nới cho ai)", () => {
    const r = evaluatePolicy({ ...withGuardian, amount: 200_000_000n, dailySpent: 400_000_000n });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_daily_limit"]);
  });

  it("guardian ĐÃ GỠ (không còn trong guardianAddresses) → mất miễn trừ ngay", () => {
    // guardianOnchainKeysForWallet lọc status != 'removed' → gỡ người bảo hộ là
    // địa chỉ họ rơi khỏi tập miễn trừ ở lần đánh giá kế tiếp, không có độ trễ.
    const r = evaluatePolicy({ ...withGuardian, guardianAddresses: [], amount: 200_000_000n });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_tx_limit"]);
  });

  it("địa chỉ LẠ + dưới per_tx → allow + cảnh báo mềm (dùng hằng ngày không kẹt)", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER" });
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["unknown_recipient"]);
  });

  it("địa chỉ TỪNG GỬI + dưới per_tx → allow, reason known (chữ mềm vẫn khác)", () => {
    const r = evaluatePolicy(base);
    expect(r.decision).toBe("allow");
    expect(r.reasons).toEqual(["known_recipient_under_limit"]);
  });

  it("địa chỉ LẠ vượt per_tx → require_guardian (không đổi so với v2)", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER", amount: 200_000_000n });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["over_tx_limit"]);
  });

  it("vượt CẢ HAI ngưỡng → gom đủ reasons", () => {
    const r = evaluatePolicy({ ...base, amount: 200_000_000n, dailySpent: 400_000_000n });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toContain("over_tx_limit");
    expect(r.reasons).toContain("over_daily_limit");
  });

  it("sổ đen thắng tất cả — kể cả guardian", () => {
    const r = evaluatePolicy({ ...withGuardian, blacklist: ["GGUARD"] });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["blacklisted_recipient"]);
  });

  it("night-watch vẫn chỉ TRÌ HOÃN, KHÔNG cancel", () => {
    const r = evaluatePolicy({ ...base, recipient: "GSTRANGER", nightWatchDelay: true });
    expect(r.decision).toBe("delay");
    expect(r.reasons).toEqual(["risk_delay"]);
  });

  it("intent phi thanh toán → require_guardian non_payment_review", () => {
    const r = evaluatePolicy({ ...base, amount: null, recipient: null });
    expect(r.decision).toBe("require_guardian");
    expect(r.reasons).toEqual(["non_payment_review"]);
  });

  it("ví chưa đặt per_tx (null) → không có cổng per_tx, daily vẫn chặn", () => {
    const r = evaluatePolicy({ ...base, perTxLimit: null, amount: 400_000_000n });
    expect(r.decision).toBe("allow");
    const over = evaluatePolicy({ ...base, perTxLimit: null, amount: 600_000_000n });
    expect(over.decision).toBe("require_guardian");
    expect(over.reasons).toEqual(["over_daily_limit"]);
  });
});
