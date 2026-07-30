import { describe, expect, it } from "bun:test";
import { intentSignalsView } from "./domain";

const RECIPIENT = "CAEDGA447G2JCTFPN2YNEGPGTCBMXYHCS324IOVC3A35KD7UNUZOQHBY";

function baseInput() {
  return {
    amount: 6_700_000_000n, // 670 XLM
    recipient: RECIPIENT,
    policyDecision: "require_guardian" as string | null,
    velocity: { txCount: 3, total: 13_200_000_000n },
    recipientSettledCount: 0,
    baseline: { avgAmount: "2233333333.33", n: 6 },
  };
}

describe("intentSignalsView — lớp 2 nói bằng số, không rò gì khác (lô R2)", () => {
  it("chốt danh sách key — thêm trường mới vào response tín hiệu là test này ĐỎ", () => {
    const view = intentSignalsView(baseInput());
    expect(Object.keys(view).sort()).toEqual(
      [
        "amount",
        "policyOutcome",
        "ratioToAvg",
        "recipientSettledCount",
        "requiresGuardian",
        "totalLastHour",
        "txCountLastHour",
        "recipient",
      ].sort(),
    );
  });

  it("KHÔNG số dư, KHÔNG lịch sử — tín hiệu về GIAO DỊCH, không phải về ví", () => {
    const view = intentSignalsView(baseInput());
    const keys = Object.keys(view);
    for (const banned of ["balance", "balances", "history", "activity", "avgAmount", "baseline"]) {
      expect(keys).not.toContain(banned);
    }
  });

  it("bigint → CHUỖI, JSON.stringify không throw (bài học indexer 48 phút)", () => {
    const view = intentSignalsView(baseInput());
    expect(view.amount).toBe("6700000000");
    expect(view.totalLastHour).toBe("13200000000");
    expect(() => JSON.stringify(view)).not.toThrow();
  });

  it("recipient trả ĐỦ 56 ký tự — guardian phải đối chiếu được", () => {
    const view = intentSignalsView(baseInput());
    expect(view.recipient).toBe(RECIPIENT);
    expect(view.recipient).toHaveLength(56);
  });

  it("ratioToAvg: 670 XLM trên nền trung bình ~223 XLM → 3.0", () => {
    expect(intentSignalsView(baseInput()).ratioToAvg).toBe(3);
  });

  it("ratioToAvg = null khi n < 3 — ví mới chưa có 'mức thường ngày', không bịa tỉ lệ", () => {
    const input = { ...baseInput(), baseline: { avgAmount: "100.0", n: 2 } };
    expect(intentSignalsView(input).ratioToAvg).toBeNull();
  });

  it("ratioToAvg = null khi avg rỗng/0/rác — không chia cho 0, không NaN lọt ra JSON", () => {
    for (const avgAmount of [null, "0", "not-a-number"]) {
      const input = { ...baseInput(), baseline: { avgAmount, n: 5 } };
      expect(intentSignalsView(input).ratioToAvg).toBeNull();
    }
  });

  it("policy require_guardian → awaiting_guardian + requiresGuardian (ĐỌC từ intent, không đánh giá lại)", () => {
    const view = intentSignalsView(baseInput());
    expect(view.policyOutcome).toBe("awaiting_guardian");
    expect(view.requiresGuardian).toBe(true);
  });

  it("policy allow / delay / chưa ghi → direct, requiresGuardian=false", () => {
    for (const policyDecision of ["allow", "delay", null]) {
      const view = intentSignalsView({ ...baseInput(), policyDecision });
      expect(view.policyOutcome).toBe("direct");
      expect(view.requiresGuardian).toBe(false);
    }
  });
});
