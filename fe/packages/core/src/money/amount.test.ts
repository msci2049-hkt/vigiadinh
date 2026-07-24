// Test module tiền (PHA 7.1) — hermetic, chạy Node Intl (full-icu có sẵn Node 20+).
// Tiêu chí DONE checklist: nhập "1.000" ở UI vi ra ĐÚNG MỘT NGHÌN ở mọi locale.
import { describe, expect, it } from "vitest";
import { formatAmount, localeSeparators, parseAmountInput, STELLAR_DECIMALS } from "./amount";

const ONE_THOUSAND = (1000n * 10n ** BigInt(STELLAR_DECIMALS)).toString(); // "10000000000"

describe("parseAmountInput — locale tường minh của Ô NHẬP", () => {
  it('DONE-gate: "1.000" gõ ở UI vi = MỘT NGHÌN (dấu chấm là dấu nghìn)', () => {
    const r = parseAmountInput("1.000", { locale: "vi-VN" });
    expect(r).toEqual({ ok: true, scaled: ONE_THOUSAND });
  });

  it('cùng chuỗi "1.000" gõ ở UI en-US = MỘT PHẨY KHÔNG (dấu chấm là thập phân)', () => {
    const r = parseAmountInput("1.000", { locale: "en-US" });
    expect(r).toEqual({ ok: true, scaled: (10n ** 7n).toString() });
  });

  it('vi: "1.234.567,89" — đủ dấu nghìn + phẩy thập phân', () => {
    const r = parseAmountInput("1.234.567,89", { locale: "vi-VN" });
    expect(r).toEqual({ ok: true, scaled: "12345678900000" });
  });

  it('en-US: "1,234,567.89" ra cùng giá trị với vi ở trên', () => {
    const r = parseAmountInput("1,234,567.89", { locale: "en-US" });
    expect(r).toEqual({ ok: true, scaled: "12345678900000" });
  });

  it("đường số nguyên chữ số — không mất chính xác kiểu float với số to", () => {
    // 90071992547.4099301 XLM — vượt 2^53 stroop nếu đi qua Number.
    const r = parseAmountInput("90,071,992,547.4099301", { locale: "en-US" });
    expect(r).toEqual({ ok: true, scaled: "900719925474099301" });
  });

  it("từ chối rõ ràng: rỗng · ký tự lạ · 2 dấu thập phân · quá 7 số lẻ", () => {
    expect(parseAmountInput("", { locale: "en-US" })).toEqual({ ok: false, error: "EMPTY" });
    expect(parseAmountInput("12a", { locale: "en-US" })).toEqual({
      ok: false,
      error: "INVALID_CHARS",
    });
    expect(parseAmountInput("-5", { locale: "en-US" })).toEqual({
      ok: false,
      error: "INVALID_CHARS", // số tiền gửi không âm — dấu trừ không có cửa
    });
    expect(parseAmountInput("1.2.3", { locale: "en-US" })).toEqual({
      ok: false,
      error: "MULTIPLE_DECIMALS",
    });
    expect(parseAmountInput("1.12345678", { locale: "en-US" })).toEqual({
      ok: false,
      error: "TOO_MANY_DECIMALS",
    });
  });

  it('".5" và "5." vẫn parse được (người gõ dở chừng hợp lệ)', () => {
    expect(parseAmountInput(".5", { locale: "en-US" })).toEqual({ ok: true, scaled: "5000000" });
    expect(parseAmountInput("5.", { locale: "en-US" })).toEqual({ ok: true, scaled: "50000000" });
  });
});

describe("formatAmount — chỉ ở lá, locale tường minh, BigInt-safe", () => {
  const amount = "1800000000000000"; // 180.000.000 đơn vị

  it("cùng số, ba locale ra ba mặt chữ", () => {
    expect(formatAmount(amount, { locale: "vi-VN" })).toBe("180.000.000");
    expect(formatAmount(amount, { locale: "en-US" })).toBe("180,000,000");
    // de-DE cùng quy ước chấm-nghìn với vi — đối chứng độc lập.
    expect(formatAmount(amount, { locale: "de-DE" })).toBe("180.000.000");
  });

  it("phần lẻ: cắt số 0 thừa, giữ minFraction, dấu thập phân đúng locale", () => {
    expect(formatAmount("15000000", { locale: "en-US" })).toBe("1.5");
    expect(formatAmount("15000000", { locale: "vi-VN" })).toBe("1,5");
    expect(formatAmount("10000000", { locale: "en-US" })).toBe("1");
    expect(formatAmount("10000000", { locale: "en-US", minFraction: 2 })).toBe("1.00");
    expect(formatAmount("12345678", { locale: "en-US", maxFraction: 2 })).toBe("1.23");
  });

  it("mã tài sản đi theo TÀI SẢN (nbsp), không theo locale UI", () => {
    expect(formatAmount("10000000", { locale: "vi-VN", code: "XLM" })).toBe("1 XLM");
  });

  it("BigInt-safe trên số vượt 2^53 stroop — không sai một chữ số", () => {
    expect(formatAmount("900719925474099301", { locale: "en-US" })).toBe("90,071,992,547.4099301");
  });

  it("scaled rác (đã format / có dấu) → throw, chặn parse-ngược lọt vào pipeline", () => {
    expect(() => formatAmount("1,5", { locale: "en-US" })).toThrow();
    expect(() => formatAmount("1.5", { locale: "en-US" })).toThrow();
  });
});

describe("localeSeparators — hỏi Intl, không đoán", () => {
  it("vi-VN: nghìn = chấm, thập phân = phẩy; en-US ngược lại", () => {
    expect(localeSeparators("vi-VN")).toEqual({ group: ".", decimal: "," });
    expect(localeSeparators("en-US")).toEqual({ group: ",", decimal: "." });
  });
});
