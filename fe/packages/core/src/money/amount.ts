// Module TIỀN dùng chung (PHA 7.1) — luật vàng skill vi-i18n-en-vi-zh §2:
//   1. Số on-chain đi suốt pipeline dưới dạng CHUỖI BigInt đã scale (Stellar:
//      7 chữ số thập phân — 1 XLM = 10^7 stroop). KHÔNG float ở bất kỳ đâu.
//   2. Format CHỈ ở lá cuối lúc render, locale TƯỜNG MINH (3 trục độc lập:
//      ngôn ngữ UI ≠ locale số ≠ tài sản — cấm suy cái này từ cái kia).
//   3. CẤM parse ngược chuỗi ĐÃ FORMAT. "180.000" đọc bằng en-US ra 180 — và đó
//      là lệnh chuyển tiền. Parser duy nhất ở đây nhận INPUT NGƯỜI GÕ kèm locale
//      tường minh của Ô NHẬP; không hàm nào trong module nhận output của format.

/** Chuỗi BigInt đã scale (vd "10000000" = 1 XLM với decimals=7). */
export type ScaledAmount = string;

/** Số chữ số thập phân chuẩn Stellar (stroop). */
export const STELLAR_DECIMALS = 7;

export type ParseAmountResult =
  | { ok: true; scaled: ScaledAmount }
  | { ok: false; error: "EMPTY" | "INVALID_CHARS" | "MULTIPLE_DECIMALS" | "TOO_MANY_DECIMALS" };

type Separators = { group: string; decimal: string };

// formatToParts mỗi lần gọi khá đắt — cache theo locale (số lượng locale hữu hạn).
const separatorCache = new Map<string, Separators>();

/** Dấu nghìn/thập phân THẬT của locale — hỏi Intl, không đoán theo bảng cứng. */
export function localeSeparators(locale: string): Separators {
  const cached = separatorCache.get(locale);
  if (cached) return cached;
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find((p) => p.type === "group")?.value ?? ",";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  const result = { group, decimal };
  separatorCache.set(locale, result);
  return result;
}

/**
 * Parse INPUT NGƯỜI GÕ trong ô nhập số → ScaledAmount, theo quy ước dấu của
 * `locale` TƯỜNG MINH (locale của ô nhập — thường là ngôn ngữ UI).
 * "1.000" với vi-VN = một nghìn; "1.000" với en-US = 1. Không bao giờ dùng
 * parseFloat/Number — đường số đi nguyên chữ số qua BigInt.
 */
export function parseAmountInput(
  raw: string,
  options: { locale: string; decimals?: number },
): ParseAmountResult {
  const decimals = options.decimals ?? STELLAR_DECIMALS;
  const { group, decimal } = localeSeparators(options.locale);
  // Bỏ khoảng trắng (kể cả NBSP/narrow NBSP mà một số locale dùng làm dấu nghìn).
  let text = raw.replace(/[\s  ]/g, "");
  if (text.length === 0) return { ok: false, error: "EMPTY" };
  // Gỡ dấu nghìn theo locale rồi đổi dấu thập phân về "." nội bộ.
  text = text.split(group).join("");
  text = text.split(decimal).join(".");
  if (!/^[0-9.]+$/.test(text)) return { ok: false, error: "INVALID_CHARS" };
  const pieces = text.split(".");
  if (pieces.length > 2) return { ok: false, error: "MULTIPLE_DECIMALS" };
  const intPart = pieces[0] ?? "";
  const fracPart = pieces[1] ?? "";
  if (intPart.length === 0 && fracPart.length === 0) return { ok: false, error: "EMPTY" };
  if (fracPart.length > decimals) return { ok: false, error: "TOO_MANY_DECIMALS" };
  const scaled =
    BigInt(intPart === "" ? "0" : intPart) * 10n ** BigInt(decimals) +
    BigInt(fracPart.padEnd(decimals, "0") || "0");
  return { ok: true, scaled: scaled.toString() };
}

export type FormatAmountOptions = {
  /** Locale số TƯỜNG MINH — bắt buộc, không default theo máy. */
  locale: string;
  decimals?: number;
  /** Số chữ số thập phân tối thiểu/tối đa khi hiển thị (mặc định 0..decimals, cắt số 0 thừa). */
  minFraction?: number;
  maxFraction?: number;
  /** Mã tài sản hiển thị kèm (vd "XLM") — theo TÀI SẢN, không theo locale UI. */
  code?: string;
};

/**
 * Format ScaledAmount để HIỂN THỊ ở lá cuối. BigInt-safe với mọi độ lớn
 * (không đi qua Number — phần nguyên format bằng Intl trên BigInt).
 * Output là CHUỖI CHO MẮT NGƯỜI — cấm parse lại, cấm đưa vào tính toán.
 */
export function formatAmount(scaled: ScaledAmount, options: FormatAmountOptions): string {
  const decimals = options.decimals ?? STELLAR_DECIMALS;
  const maxFraction = options.maxFraction ?? decimals;
  const minFraction = options.minFraction ?? 0;
  if (!/^-?[0-9]+$/.test(scaled)) throw new Error(`ScaledAmount không hợp lệ: ${scaled}`);

  const value = BigInt(scaled);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const intPart = abs / base;
  let frac = (abs % base).toString().padStart(decimals, "0").slice(0, maxFraction);
  while (frac.length > minFraction && frac.endsWith("0")) frac = frac.slice(0, -1);

  const intText = new Intl.NumberFormat(options.locale).format(intPart);
  const { decimal } = localeSeparators(options.locale);
  const number = `${negative ? "-" : ""}${intText}${frac.length > 0 ? decimal + frac : ""}`;
  // NBSP giữa số và mã tài sản — không gãy dòng giữa chừng.
  return options.code ? `${number} ${options.code}` : number;
}
