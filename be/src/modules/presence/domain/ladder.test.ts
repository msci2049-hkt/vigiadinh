// Test ladder thuần (PHA 4.1) — audit checklist: "giả lập offline 4 ngày →
// cảnh báo đúng bậc" + biên 24h/72h + xác nhận tay 90 ngày + chống-lockout.
import { describe, expect, it } from "bun:test";
import {
  availableCount,
  canRemoveGuardian,
  type GuardianPresence,
  isAvailable,
  ladderStatus,
  manualConfirmOverdue,
  reserveStance,
} from "./ladder";

const NOW = new Date("2026-07-24T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

const guardian = (overrides: Partial<GuardianPresence>): GuardianPresence => ({
  status: "active",
  lastSeenAt: hoursAgo(1),
  lastManualConfirmAt: daysAgo(10),
  ...overrides,
});

describe("presence ladder", () => {
  it("thang 24/72h: ack 1h → active · 30h → slow · 4 NGÀY → offline", () => {
    expect(ladderStatus(hoursAgo(1), NOW)).toBe("active");
    expect(ladderStatus(hoursAgo(30), NOW)).toBe("slow");
    expect(ladderStatus(daysAgo(4), NOW)).toBe("offline"); // audit: offline 4 ngày → đúng bậc
    expect(ladderStatus(null, NOW)).toBe("offline");
  });

  it("biên chính xác: đúng 24h vẫn active, đúng 72h vẫn slow, quá là rơi bậc", () => {
    expect(ladderStatus(hoursAgo(24), NOW)).toBe("active");
    expect(ladderStatus(hoursAgo(24.01), NOW)).toBe("slow");
    expect(ladderStatus(hoursAgo(72), NOW)).toBe("slow");
    expect(ladderStatus(hoursAgo(72.01), NOW)).toBe("offline");
  });

  it("xác nhận tay: quá 90 ngày (hoặc chưa từng) = overdue", () => {
    expect(manualConfirmOverdue(daysAgo(89), NOW)).toBe(false);
    expect(manualConfirmOverdue(daysAgo(91), NOW)).toBe(true);
    expect(manualConfirmOverdue(null, NOW)).toBe(true);
  });

  it("máy sống ≠ người còn ký: ping đều mà 91 ngày không xác nhận tay → KHÔNG available", () => {
    expect(isAvailable(guardian({ lastManualConfirmAt: daysAgo(91) }), NOW)).toBe(false);
    expect(isAvailable(guardian({}), NOW)).toBe(true);
    expect(isAvailable(guardian({ status: "invited" }), NOW)).toBe(false);
    expect(isAvailable(guardian({ status: "removed" }), NOW)).toBe(false);
  });

  it("reserve stance: đủ dư = ok · bằng threshold = hết dự phòng · dưới = ĐỎ", () => {
    expect(reserveStance(3, 2)).toBe("ok");
    expect(reserveStance(2, 2)).toBe("no_reserve");
    expect(reserveStance(1, 2)).toBe("unrecoverable");
  });

  it("chống-lockout: available == threshold → CHẶN gỡ guardian available", () => {
    const guardians = [guardian({}), guardian({}), guardian({ lastSeenAt: daysAgo(4) })];
    expect(availableCount(guardians, NOW)).toBe(2);
    const removingAvailable = guardians[0];
    if (!removingAvailable) throw new Error("thiếu guardian");
    expect(
      canRemoveGuardian({ guardians, threshold: 2, removing: removingAvailable, now: NOW }),
    ).toBe(false);
  });

  it("gỡ guardian ĐÃ offline thì được — đó là thao tác sửa chữa", () => {
    const offline = guardian({ lastSeenAt: daysAgo(4) });
    const guardians = [guardian({}), guardian({}), offline];
    expect(canRemoveGuardian({ guardians, threshold: 2, removing: offline, now: NOW })).toBe(true);
  });

  it("còn dư mới cho gỡ guardian available", () => {
    const guardians = [guardian({}), guardian({}), guardian({})];
    const first = guardians[0];
    if (!first) throw new Error("thiếu guardian");
    expect(canRemoveGuardian({ guardians, threshold: 2, removing: first, now: NOW })).toBe(true);
  });
});
