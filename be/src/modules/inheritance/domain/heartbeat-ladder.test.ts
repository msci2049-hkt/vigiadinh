// Test thang heartbeat thuần (PHA 4.3).
import { describe, expect, it } from "bun:test";
import { heartbeatTier, tierTemplate } from "./heartbeat-ladder";

const NOW = new Date("2026-07-24T12:00:00Z");
const PERIOD = 30 * 86_400; // 30 ngày
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe("heartbeat ladder", () => {
  it("thang theo số kỳ im lặng: 0 → 1 → 2 → 3, trần ở 3", () => {
    expect(heartbeatTier(daysAgo(10), PERIOD, NOW)).toBe(0);
    expect(heartbeatTier(daysAgo(31), PERIOD, NOW)).toBe(1); // 1 kỳ: nhắc owner
    expect(heartbeatTier(daysAgo(61), PERIOD, NOW)).toBe(2); // 2 kỳ: hỏi người thân
    expect(heartbeatTier(daysAgo(95), PERIOD, NOW)).toBe(3); // đủ silence: gợi ý claim
    expect(heartbeatTier(daysAgo(365), PERIOD, NOW)).toBe(3); // không leo quá 3
  });

  it("tier → đúng template + đúng đối tượng; tier 0 im lặng", () => {
    expect(tierTemplate(0)).toBeNull();
    expect(tierTemplate(1)).toEqual({ template: "heartbeat.reminder", audience: "owner" });
    expect(tierTemplate(2)).toEqual({
      template: "heartbeat.guardian_check",
      audience: "guardians",
    });
    expect(tierTemplate(3)).toEqual({
      template: "inheritance.suggest_claim",
      audience: "guardians",
    });
  });
});
