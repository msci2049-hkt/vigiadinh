// Lô R7 nhóm D — đồng hồ chờ phải CHẠY, và phải dừng đúng lúc.
//
// Trước lô này các màn chờ hiện một con số tĩnh dựng lúc render rồi đứng im.
// Người đang chờ xem ví mình có bị chiếm không đọc một con số đứng yên là đọc
// "app treo rồi".
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { formatClock, LiveCountdown } from "./live-countdown";

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

describe("formatClock", () => {
  it("HH : MM : SS, đủ hai chữ số", () => {
    expect(formatClock(0)).toBe("00 : 00 : 00");
    expect(formatClock(1000)).toBe("00 : 00 : 01");
    expect(formatClock(61_000)).toBe("00 : 01 : 01");
    expect(formatClock((15 * 3600 + 21 * 60 + 4) * 1000)).toBe("15 : 21 : 04");
  });

  it("🔴 quá 24 giờ KHÔNG cuộn về 0 — 25 giờ phải đọc là 25, không phải 1", () => {
    // Cửa sổ chặn dài tới 3 ngày. Hiện "01 : 00 : 00" cho 25 giờ là nói dối theo
    // hướng nguy hiểm nhất: người ta tưởng chỉ còn một tiếng.
    expect(formatClock(25 * 3600 * 1000)).toBe("25 : 00 : 00");
    expect(formatClock(72 * 3600 * 1000)).toBe("72 : 00 : 00");
  });

  it("hết giờ / âm / rác → 00 : 00 : 00, không ra chữ số âm", () => {
    expect(formatClock(-5000)).toBe("00 : 00 : 00");
    expect(formatClock(Number.NaN)).toBe("00 : 00 : 00");
  });
});

describe("LiveCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-31T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const deadlineIn = (secs: number) => new Date(Date.now() + secs * 1000).toISOString();

  it("🔴 tick TỪNG GIÂY — không phải số tĩnh", () => {
    render(<LiveCountdown deadline={deadlineIn(3600)} />);
    const clock = () => screen.getByTestId("live-countdown").textContent ?? "";
    expect(clock()).toContain("01 : 00 : 00");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(clock()).toContain("00 : 59 : 59");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(clock()).toContain("00 : 59 : 54");
  });

  it("🔴 D5 — hết giờ thì DỪNG ở 00 : 00 : 00 và đổi câu, không chạy tiếp về âm", () => {
    render(<LiveCountdown deadline={deadlineIn(2)} />);
    const node = () => screen.getByTestId("live-countdown");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(node().textContent).toContain("00 : 00 : 00");
    expect(node().getAttribute("data-expired")).toBe("true");
    expect(screen.getByText(i18n.t("fw:countdown.windowClosed"))).toBeTruthy();

    // Trôi thêm một phút nữa: vẫn 00:00:00, không âm.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(node().textContent).toContain("00 : 00 : 00");
  });

  it("còn giờ thì hiện nhãn được truyền vào, KHÔNG hiện câu đã-hết", () => {
    render(<LiveCountdown deadline={deadlineIn(120)} label="Còn lại để chặn" />);
    expect(screen.getByText("Còn lại để chặn")).toBeTruthy();
    expect(screen.queryByText(i18n.t("fw:countdown.windowClosed"))).toBeNull();
    expect(screen.getByTestId("live-countdown").getAttribute("data-expired")).toBe("false");
  });
});
