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

  // Trước lô R1 ca này dùng `recovery.vetoed` + "zh-Hans" làm ví dụ "chưa dịch"
  // — rồi R1 dịch zh cho recovery.* và test đỏ, dù CƠ CHẾ fallback không đổi
  // một dòng nào. Đo bằng một locale KHÔNG nằm trong bộ sản phẩm (vi/en/zh) thì
  // test nói về cơ chế, không nói về độ phủ bản dịch tại một thời điểm.
  it("locale ngoài bộ sản phẩm → fallback en", () => {
    const r = renderNotification("recovery.vetoed", "ja-JP", {});
    expect(r.locale).toBe("en");
    expect(r.body).toContain("BLOCKED");
  });

  it("region code vẫn khớp về ngôn ngữ gốc: zh-Hans → zh (không rơi xuống en)", () => {
    const r = renderNotification("recovery.vetoed", "zh-Hans", {});
    expect(r.locale).toBe("zh");
    expect(r.title).toBe("已阻止一次恢复申请");
  });

  it("template lạ → bản generic theo locale, KHÔNG throw", () => {
    const r = renderNotification("khong.ton.tai", "vi", {});
    expect(r.title).toBe("Cập nhật ví");
  });

  it("params thiếu biến plural → generic, không chết worker", () => {
    const r = renderNotification("approval.requested", "en", {});
    expect(r.title).toBe("Wallet update");
  });

  // Lô R1: recovery.* lên đủ 3 locale như approval.* — trước đó chỉ en+vi, nên
  // người dùng zh nhận cảnh báo an ninh bằng tiếng Anh.
  it("MỌI template recovery render đủ BA thứ tiếng, không rơi xuống generic", () => {
    const GENERIC_TITLES = ["Cập nhật ví", "Wallet update", "钱包动态"];
    for (const key of [
      "recovery.device_requested",
      "recovery.initiated",
      "recovery.approved",
      "recovery.finalized",
      "recovery.vetoed",
    ]) {
      for (const locale of ["vi", "en", "zh"]) {
        const r = renderNotification(key, locale, {});
        expect(r.locale).toBe(locale); // có bản dịch THẬT, không fallback en
        expect(r.title.length).toBeGreaterThan(0);
        expect(GENERIC_TITLES).not.toContain(r.title);
      }
    }
  });

  // R4 nhóm C: template email tra ví — link điền sẵn địa chỉ phải sống sót
  // nguyên vẹn qua ICU ở CẢ BA locale (địa chỉ chỉ đi qua hộp thư, không qua HTTP).
  it("recovery.wallet_lookup: đủ 3 locale, link giữ nguyên dạng find-wallet?address=", () => {
    const link = `https://familyhaven.example/recovery/find-wallet?address=C${"A".repeat(55)}`;
    for (const locale of ["vi", "en", "zh"]) {
      const r = renderNotification("recovery.wallet_lookup", locale, { link });
      expect(r.locale).toBe(locale);
      expect(r.body).toContain(link);
    }
  });

  it("chuỗi người thường — không lộ jargon kỹ thuật", () => {
    for (const key of [
      "inheritance.suggest_claim",
      "presence.guardian_offline",
      "recovery.device_requested",
      "recovery.initiated",
      "recovery.approved",
      "recovery.finalized",
      "recovery.vetoed",
    ]) {
      // zh có mặt ở đây để bắt jargon LỌT NGUYÊN tiếng Anh vào bản dịch mới.
      for (const locale of ["vi", "en", "zh"]) {
        const r = renderNotification(key, locale, { days: 3, guardianName: "undefined" });
        const text = `${r.title} ${r.body}`.toLowerCase();
        for (const jargon of ["guardian", "threshold", "timelock", "veto", "heartbeat"]) {
          expect(text).not.toContain(jargon);
        }
      }
    }
  });
});
