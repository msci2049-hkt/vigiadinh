// Test hermetic ngữ nghĩa đổi ngưỡng (B1/B2/E2) — chốt bằng test cái bẫy
// "giảm một cái, tăng một cái": PHẢI coi là nâng, phải chờ 24h.
import { describe, expect, it } from "bun:test";
import {
  assertValidLimits,
  classifyChange,
  DEFAULT_DAILY_STROOPS,
  DEFAULT_PER_TX_STROOPS,
  ONCHAIN_CAP_STROOPS,
} from "./spending-policy";

const current = { perTxLimit: DEFAULT_PER_TX_STROOPS, dailyLimit: DEFAULT_DAILY_STROOPS };

describe("classifyChange — 'nâng' = nới lỏng BẤT KỲ chiều nào", () => {
  it("hạ cả hai → lower (áp ngay)", () => {
    expect(
      classifyChange(current, { perTxLimit: 5_000_000_000n, dailyLimit: 50_000_000_000n }),
    ).toBe("lower");
  });

  it("nâng cả hai → raise (chờ 24h)", () => {
    expect(
      classifyChange(current, { perTxLimit: 50_000_000_000n, dailyLimit: 150_000_000_000n }),
    ).toBe("raise");
  });

  it("⚠️ giảm per_tx nhưng TĂNG daily → vẫn là raise", () => {
    expect(
      classifyChange(current, { perTxLimit: 5_000_000_000n, dailyLimit: 150_000_000_000n }),
    ).toBe("raise");
  });

  it("⚠️ tăng per_tx nhưng GIẢM daily → vẫn là raise", () => {
    expect(
      classifyChange(current, { perTxLimit: 20_000_000_000n, dailyLimit: 50_000_000_000n }),
    ).toBe("raise");
  });

  it("giữ nguyên → lower (không có gì nới ra)", () => {
    expect(classifyChange(current, { ...current })).toBe("lower");
  });
});

describe("assertValidLimits — E2", () => {
  it("hợp lệ: dưới trần, daily ≥ per_tx", () => {
    expect(() =>
      assertValidLimits({ perTxLimit: 10_000_000_000n, dailyLimit: 100_000_000_000n }),
    ).not.toThrow();
  });

  it("daily < per_tx → DAILY_BELOW_PER_TX", () => {
    expect(() =>
      assertValidLimits({ perTxLimit: 10_000_000_000n, dailyLimit: 9_000_000_000n }),
    ).toThrow("DAILY_BELOW_PER_TX");
  });

  it("vượt trần on-chain → ABOVE_ONCHAIN_CAP (per_tx)", () => {
    expect(() =>
      assertValidLimits({
        perTxLimit: ONCHAIN_CAP_STROOPS + 1n,
        dailyLimit: ONCHAIN_CAP_STROOPS + 1n,
      }),
    ).toThrow("ABOVE_ONCHAIN_CAP");
  });

  it("đúng bằng trần → hợp lệ (trần là ≤, không phải <)", () => {
    expect(() =>
      assertValidLimits({ perTxLimit: ONCHAIN_CAP_STROOPS, dailyLimit: ONCHAIN_CAP_STROOPS }),
    ).not.toThrow();
  });

  it("số âm/0 → BAD_LIMITS", () => {
    expect(() => assertValidLimits({ perTxLimit: 0n, dailyLimit: 10n })).toThrow("BAD_LIMITS");
  });
});
