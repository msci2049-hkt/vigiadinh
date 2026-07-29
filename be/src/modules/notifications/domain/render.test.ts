// Test render ICU theo locale người nhận (PHA 4.3) — vi/en, plural, select,
// fallback en, template lạ không throw.
import { describe, expect, it } from "bun:test";
import { renderNotification } from "./render";

describe("notification renderer (ICU theo locale người nhận)", () => {
  it("cùng template, hai locale ra hai thứ tiếng", () => {
    const vi = renderNotification("recovery.vetoed", "vi", {});
    const en = renderNotification("recovery.vetoed", "en", {});
    expect(vi.body).toContain("CHẶN");
    expect(en.body).toContain("BLOCKED");
  });

  it("ICU plural chạy đúng: 1 hour / 15 hours (en) — template approval.requested LÔ 1", () => {
    const base = { ownerName: "Huy", amount: "10", recipient: "CDBX…3PBT" };
    expect(renderNotification("approval.requested", "en", { ...base, hours: 1 }).body).toContain(
      "1 hour",
    );
    const many = renderNotification("approval.requested", "en", { ...base, hours: 15 }).body;
    expect(many).toContain("15 hours");
    expect(many).toContain("Huy");
    expect(many).toContain("10 XLM");
    expect(many).toContain("CDBX…3PBT");
  });

  it("approval.requested có đủ 3 locale, ownerName unknown → chuỗi trung tính theo locale", () => {
    const params = { ownerName: "unknown", amount: "10", recipient: "CDBX…3PBT", hours: 24 };
    expect(renderNotification("approval.requested", "vi", params).body).toContain("Một người thân");
    expect(renderNotification("approval.requested", "zh", params).body).toContain("一位家人");
    expect(renderNotification("approval.requested", "zh", params).locale).toBe("zh");
  });

  it("ICU select: có tên hiện tên, không tên hiện chung chung", () => {
    const named = renderNotification("presence.guardian_offline", "vi", { guardianName: "Mẹ" });
    expect(named.body).toContain("Mẹ");
    const anon = renderNotification("presence.guardian_offline", "vi", {
      guardianName: "undefined",
    });
    expect(anon.body).toContain("Một người thân");
  });

  it("locale không có bản dịch → fallback en (vd zh chưa dịch)", () => {
    const r = renderNotification("recovery.vetoed", "zh-Hans", {});
    expect(r.locale).toBe("en");
    expect(r.body).toContain("BLOCKED");
  });

  it("template lạ → bản generic theo locale, KHÔNG throw", () => {
    const r = renderNotification("khong.ton.tai", "vi", {});
    expect(r.title).toBe("Cập nhật ví");
  });

  it("params thiếu biến plural → generic, không chết worker", () => {
    const r = renderNotification("approval.requested", "en", {});
    expect(r.title).toBe("Wallet update");
  });

  it("template recovery mới (PHA 5.2) render đủ hai thứ tiếng", () => {
    for (const key of ["recovery.initiated", "recovery.approved", "recovery.finalized"]) {
      const vi = renderNotification(key, "vi", {});
      const en = renderNotification(key, "en", {});
      expect(vi.title.length).toBeGreaterThan(0);
      expect(en.title.length).toBeGreaterThan(0);
      expect(vi.title).not.toBe("Cập nhật ví"); // không rơi xuống generic
      expect(en.title).not.toBe("Wallet update");
    }
  });

  it("chuỗi người thường — không lộ jargon kỹ thuật", () => {
    for (const key of [
      "inheritance.suggest_claim",
      "presence.guardian_offline",
      "recovery.initiated",
      "recovery.approved",
      "recovery.finalized",
    ]) {
      for (const locale of ["vi", "en"]) {
        const r = renderNotification(key, locale, { days: 3, guardianName: "undefined" });
        const text = `${r.title} ${r.body}`.toLowerCase();
        for (const jargon of ["guardian", "threshold", "timelock", "veto", "heartbeat"]) {
          expect(text).not.toContain(jargon);
        }
      }
    }
  });
});
