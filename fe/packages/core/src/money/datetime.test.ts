// Test ngày giờ + timelock (PHA 7.1) — timezone + locale người xem tường minh.
import { describe, expect, it } from "vitest";
import { formatCountdown, formatDateTime, timelockView } from "./datetime";

const T0 = new Date("2026-07-24T12:00:00Z");

describe("formatDateTime — timezone người xem", () => {
  it("cùng mốc UTC, hai timezone ra hai giờ khác nhau", () => {
    const hanoi = formatDateTime(T0, { locale: "vi-VN", timeZone: "Asia/Ho_Chi_Minh" });
    const ny = formatDateTime(T0, { locale: "en-US", timeZone: "America/New_York" });
    expect(hanoi).toContain("19:00");
    expect(ny).toContain("8:00");
  });
});

describe("formatCountdown — localize bằng Intl unit, tối đa 2 đơn vị", () => {
  it("2 ngày 4 giờ theo từng tiếng", () => {
    const ms = 2 * 86_400_000 + 4 * 3_600_000 + 30 * 60_000;
    expect(formatCountdown(ms, "en-US")).toBe("2 days 4 hours");
    expect(formatCountdown(ms, "vi-VN")).toBe("2 ngày 4 giờ");
  });

  it("dưới 1 phút rơi xuống giây; hết giờ = chuỗi rỗng", () => {
    expect(formatCountdown(42_000, "en-US")).toBe("42 seconds");
    expect(formatCountdown(0, "en-US")).toBe("");
    expect(formatCountdown(-5, "en-US")).toBe("");
  });
});

describe("timelockView — CẢ đếm ngược LẪN mốc tuyệt đối (luật i18n §2)", () => {
  it("chưa hết: có countdown + absolute; hết: expired, countdown rỗng, absolute còn", () => {
    const deadline = new Date(T0.getTime() + 6 * 3_600_000);
    const active = timelockView(deadline, {
      locale: "vi-VN",
      timeZone: "Asia/Ho_Chi_Minh",
      now: T0,
    });
    expect(active.expired).toBe(false);
    expect(active.countdown).toBe("6 giờ");
    expect(active.absolute.length).toBeGreaterThan(0);

    const done = timelockView(T0, {
      locale: "vi-VN",
      timeZone: "Asia/Ho_Chi_Minh",
      now: new Date(T0.getTime() + 1),
    });
    expect(done.expired).toBe(true);
    expect(done.countdown).toBe("");
    expect(done.absolute.length).toBeGreaterThan(0);
  });
});
