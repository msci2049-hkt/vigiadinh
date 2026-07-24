import { describe, expect, it } from "vitest";
import { evaluateRecoveryWarnings } from "./recovery-warnings";

const base = { startedAt: "2026-07-24T14:00:00Z", approvals: 3, riskScore: null };

describe("evaluateRecoveryWarnings (rule thuần, không AI)", () => {
  it("newKey LUÔN có (khôi phục luôn cài khoá mới)", () => {
    const w = evaluateRecoveryWarnings(base, { now: new Date("2026-07-24T15:00:00Z") });
    expect(w).toContain("guardian.approveWarning.rules.newKey");
  });

  it("giờ bất thường: mở lúc 02:00 local kích unusualHour", () => {
    // Dùng giờ local của máy chạy test — dựng startedAt = 02:00 local hôm nay.
    const started = new Date();
    started.setHours(2, 0, 0, 0);
    const w = evaluateRecoveryWarnings(
      { ...base, startedAt: started.toISOString() },
      { now: new Date(started.getTime() + 60_000) },
    );
    expect(w).toContain("guardian.approveWarning.rules.unusualHour");
  });

  it("giờ ban ngày KHÔNG kích unusualHour", () => {
    const started = new Date();
    started.setHours(14, 0, 0, 0);
    const w = evaluateRecoveryWarnings(
      { ...base, startedAt: started.toISOString() },
      { now: new Date(started.getTime() + 60_000) },
    );
    expect(w).not.toContain("guardian.approveWarning.rules.unusualHour");
  });

  it("mới mở (<30') + ít phiếu kích veryRecent", () => {
    const started = new Date();
    started.setHours(14, 0, 0, 0);
    const w = evaluateRecoveryWarnings(
      { ...base, startedAt: started.toISOString(), approvals: 1 },
      { now: new Date(started.getTime() + 5 * 60_000) },
    );
    expect(w).toContain("guardian.approveWarning.rules.veryRecent");
  });

  it("mở lâu rồi KHÔNG kích veryRecent", () => {
    const started = new Date();
    started.setHours(14, 0, 0, 0);
    const w = evaluateRecoveryWarnings(
      { ...base, startedAt: started.toISOString(), approvals: 1 },
      { now: new Date(started.getTime() + 60 * 60_000) },
    );
    expect(w).not.toContain("guardian.approveWarning.rules.veryRecent");
  });

  it("riskScore server >=60 kích flagged; null thì không", () => {
    const now = new Date("2026-07-24T15:00:00Z");
    expect(evaluateRecoveryWarnings({ ...base, riskScore: 75 }, { now })).toContain(
      "guardian.approveWarning.rules.flagged",
    );
    expect(evaluateRecoveryWarnings({ ...base, riskScore: null }, { now })).not.toContain(
      "guardian.approveWarning.rules.flagged",
    );
  });
});
