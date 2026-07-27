// WHY: tên app không phải nhãn trang trí — một chỗ trong đó là chữ hiện trong
// HỘP THOẠI VÂN TAY.
//
// `rpName` (features/wallet/lib/kit.ts) lấy thẳng `VITE_APP_NAME`, và đó là dòng
// chữ trình duyệt hiện lên khi hỏi người dùng chạm vân tay/Face ID để KÝ MỘT
// GIAO DỊCH TIỀN. Tên ở đó khác tên trên tab, khác tên dưới icon màn hình chính,
// khác tên của extension đang xin duyệt — người dùng có mọi lý do để nghi ngờ,
// đúng vào giây họ đang quyết định ký. Với người không rành máy tính (đối tượng
// của sản phẩm này) thì đó là lý do để dừng lại và không bao giờ quay lại.
//
// Đo được 2026-07-27: web ghi "FamilyHaven", extension ghi
// "FamilyWallet"/"VíGiaĐình"/"家庭钱包", Capacitor ghi "FamilyWallet". Bốn tên
// cho một sản phẩm. Không có test nào bắt được vì mỗi chỗ tự khai một hằng số.
//
// Test này khoá theo NGUYÊN TẮC, không theo giá trị: mọi chỗ hiển thị tên phải
// quy về CÙNG MỘT nguồn (`VITE_APP_NAME`), và những chỗ không đọc được env
// (extension, Capacitor — chạy ngoài Vite) phải khai đúng giá trị đó.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const APP_DIR = join(import.meta.dirname, "../..");
const REPO_ROOT = join(APP_DIR, "../../..");
const EXT_LOCALES = join(REPO_ROOT, "extension/_locales");

/** Nguồn sự thật DUY NHẤT. Đổi tên sản phẩm = đổi ở đây rồi chạy lại test. */
const BRAND = "FamilyHaven";

function envValue(file: string, key: string): string | undefined {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m?.[1] === key) return (m[2] ?? "").trim();
  }
  return undefined;
}

describe("web — mọi chỗ hiện tên đều quy về VITE_APP_NAME", () => {
  test(".env.example chốt đúng tên sản phẩm", () => {
    expect(envValue(join(APP_DIR, ".env.example"), "VITE_APP_NAME")).toBe(BRAND);
  });

  test("default của Zod cũng là tên sản phẩm (quên biến vẫn không ra tên template)", () => {
    // Từng là `.default("Mau Demo FE")` và nó đi thẳng vào rpName. Gate dist chặn
    // được ca build production, nhưng dev chạy local thì không ai chặn.
    const env = readFileSync(join(APP_DIR, "src/lib/env.ts"), "utf8");
    expect(env).toMatch(new RegExp(`VITE_APP_NAME:[\\s\\S]{0,80}?\\.default\\("${BRAND}"\\)`));
  });

  test("<title> và og:title dùng CÙNG token, không chỗ nào ghi cứng tên", () => {
    const html = readFileSync(join(APP_DIR, "index.html"), "utf8");
    expect(html).toMatch(/<title>%VITE_APP_NAME%<\/title>/);
    expect(html).toMatch(/property="og:title" content="%VITE_APP_NAME%"/);
    // Ghi cứng tên ở đây là cách cũ để hai thẻ lệch nhau (og:title từng ghi
    // "FamilyWallet" trong khi tab hiện "FamilyHaven").
    expect(html).not.toContain(`content="${BRAND}"`);
  });

  test("rpName đọc từ env, KHÔNG phải chuỗi tự khai", () => {
    const kit = readFileSync(join(APP_DIR, "src/features/wallet/lib/kit.ts"), "utf8");
    expect(kit).toMatch(/rpName:\s*env\.VITE_APP_NAME/);
  });
});

describe("ngoài Vite — extension và Capacitor không đọc được env, phải khai đúng", () => {
  const locales = readdirSync(EXT_LOCALES);

  test("có đủ locale của extension để kiểm", () => {
    expect(locales.length).toBeGreaterThan(0);
  });

  test.each(locales)("extension/_locales/%s — extName là tên sản phẩm", (locale) => {
    const messages = JSON.parse(
      readFileSync(join(EXT_LOCALES, locale, "messages.json"), "utf8"),
    ) as Record<string, { message: string }>;
    // Tên THƯƠNG HIỆU không dịch — web hiện `site.name` y hệt ở cả ba ngôn ngữ
    // (nó là biến env, không phải khoá i18n). Extension phải theo, nếu không thì
    // người dùng tiếng Việt thấy extension tên khác hẳn cái web họ đang mở.
    expect(messages.extName?.message).toBe(BRAND);
    // Câu "Mở <app>" cũng phải mang đúng tên đó, phần còn lại vẫn dịch bình thường.
    expect(messages.popupOpenApp?.message).toContain(BRAND);
  });

  test("capacitor appName — nhãn dưới icon trên màn hình chính máy điện thoại", () => {
    const cap = JSON.parse(readFileSync(join(APP_DIR, "capacitor.config.json"), "utf8"));
    expect(cap.appName).toBe(BRAND);
    // `appId` CỐ Ý không bị test này ràng buộc: nó là ĐỊNH DANH (kiểu reverse-DNS),
    // không phải tên hiển thị, và đổi sau khi đã lên store là gãy đường cập nhật
    // của mọi máy đã cài. Xem BLOCKERS B-EXT-1.
    expect(typeof cap.appId).toBe("string");
  });
});
