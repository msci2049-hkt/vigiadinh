// WHY: `/.well-known/webauthn` là thứ hỏng IM LẶNG — chế độ hỏng tệ nhất.
//
// Đo thật trên production 2026-07-27:
//   curl -I https://familyhaven.mscilabs.com/.well-known/webauthn
//   → HTTP 200, content-type: text/html
// Mã 200, nên mọi phép kiểm dựa trên status code đều báo XANH. Nhưng nội dung là
// `index.html`: catch-all `/*  /index.html  200` của `_redirects` nuốt mọi đường
// chưa có file. Trình duyệt chờ JSON, nhận HTML, bỏ qua — Related Origin Requests
// không bao giờ nối được passkey của web với origin extension, và không ai biết.
//
// Ba điều test này khoá, tất cả đều là ca "xanh mà sai":
//   1. File CÓ THẬT và là JSON hợp lệ (không phải HTML).
//   2. `origins` chứa ĐÚNG id extension DẪN XUẤT TỪ `extension/manifest.json` —
//      không phải một chuỗi chép tay. Id extension = 16 byte đầu của SHA-256 khoá
//      công khai, ánh xạ sang a–p. Manifest có trường `key` nên id được GHIM; sửa
//      `key` mà quên sửa file này là passkey chết, nên chỗ nối phải được TÍNH lại
//      chứ không phải tin vào một hằng số.
//   3. MỌI file trong `.well-known/` có luật Content-Type tường minh trong
//      `_headers`. File không phần mở rộng bị Cloudflare đoán thành
//      `application/octet-stream` (đo thật: apple-app-site-association).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const PUBLIC_DIR = join(import.meta.dirname, "../../public");
const WELL_KNOWN_DIR = join(PUBLIC_DIR, ".well-known");
// Với sang `extension/` là CỐ Ý: id extension do manifest bên đó quyết định, và
// đúng cái lệch giữa hai thư mục này là thứ làm passkey không nối được.
const EXT_MANIFEST = join(import.meta.dirname, "../../../../../extension/manifest.json");

const SITE_ORIGIN = "https://familyhaven.mscilabs.com";

/** Id extension Chrome = 16 byte đầu SHA-256(DER public key), mỗi nibble → 'a'+n. */
function extensionIdFromKey(base64Key: string): string {
  const digest = createHash("sha256").update(Buffer.from(base64Key, "base64")).digest();
  let id = "";
  for (let i = 0; i < 16; i++) {
    const byte = digest[i] as number;
    id += String.fromCharCode(97 + (byte >> 4));
    id += String.fromCharCode(97 + (byte & 0x0f));
  }
  return id;
}

/** `_headers` của Cloudflare Pages: dòng không thụt = pattern, dòng thụt = header. */
function parseHeaders(text: string): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
    if (/^\s/.test(raw)) {
      current?.push(raw.trim());
    } else {
      current = [];
      rules.set(raw.trim(), current);
    }
  }
  return rules;
}

describe(".well-known/webauthn — Related Origin Requests", () => {
  const raw = readFileSync(join(WELL_KNOWN_DIR, "webauthn"), "utf8");

  test("là JSON hợp lệ, không phải index.html", () => {
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw).not.toMatch(/<!doctype html>/i);
  });

  test("origins chứa chính domain web", () => {
    expect(JSON.parse(raw).origins).toContain(SITE_ORIGIN);
  });

  test("origins chứa id extension DẪN XUẤT từ extension/manifest.json", () => {
    const manifest = JSON.parse(readFileSync(EXT_MANIFEST, "utf8"));
    // Không có `key` thì id do Chrome sinh theo đường dẫn thư mục → đổi mỗi máy,
    // và không cách nào ghim vào file này. Đó là lỗi cấu hình, không phải tuỳ chọn.
    expect(typeof manifest.key).toBe("string");
    expect(JSON.parse(raw).origins).toContain(
      `chrome-extension://${extensionIdFromKey(manifest.key)}`,
    );
  });
});

describe("_headers — content-type của .well-known/ (mã 200 không đủ)", () => {
  const rules = parseHeaders(readFileSync(join(PUBLIC_DIR, "_headers"), "utf8"));

  test.each(readdirSync(WELL_KNOWN_DIR))("%s có luật Content-Type tường minh", (name) => {
    const headers = rules.get(`/.well-known/${name}`);
    expect(headers, `thiếu khối luật /.well-known/${name} trong _headers`).toBeDefined();
    expect(headers?.some((h) => /^Content-Type:/i.test(h))).toBe(true);
  });

  test("webauthn phục vụ dưới dạng application/json", () => {
    expect(rules.get("/.well-known/webauthn")).toContain("Content-Type: application/json");
  });
});

describe("_redirects — catch-all SPA không được nuốt .well-known/", () => {
  const lines = readFileSync(join(PUBLIC_DIR, "_redirects"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));

  test("luật .well-known đứng TRƯỚC catch-all (Pages khớp từ trên xuống)", () => {
    const wellKnown = lines.findIndex((l) => l.startsWith("/.well-known/*"));
    const catchAll = lines.findIndex((l) => l.startsWith("/*"));
    expect(wellKnown).toBeGreaterThanOrEqual(0);
    expect(catchAll).toBeGreaterThanOrEqual(0);
    expect(wellKnown).toBeLessThan(catchAll);
  });

  test("đường .well-known thiếu file trả 404 THẬT, không phải 200 + index.html", () => {
    const rule = lines.find((l) => l.startsWith("/.well-known/*"));
    expect(rule?.split(/\s+/).at(-1)).toBe("404");
  });

  test("đích của luật 404 tồn tại trong public/", () => {
    const target = lines.find((l) => l.startsWith("/.well-known/*"))?.split(/\s+/)[1];
    expect(readdirSync(PUBLIC_DIR)).toContain(target?.replace(/^\//, ""));
  });
});
