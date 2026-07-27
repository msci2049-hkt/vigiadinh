// WHY: CSP trong apps/web/public/_headers pin inline script của index.html bằng
// sha256 thay vì 'unsafe-inline'. Hash lệch = trình duyệt CHẶN script đó =
// FOUC/theme hỏng ở production, và triệu chứng chỉ hiện trên bản deploy thật
// (dev server không áp _headers). Script này vừa TÍNH lại hash, vừa KIỂM tra
// hash đang nằm trong _headers có còn khớp không.
//
//   node scripts/csp-script-hash.mjs          # kiểm, exit 1 nếu lệch
//   node scripts/csp-script-hash.mjs --write   # cập nhật _headers tại chỗ
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "apps/web/index.html");
const headersPath = join(root, "apps/web/public/_headers");

const html = readFileSync(htmlPath, "utf8");
// Chỉ script KHÔNG có thuộc tính src mới là inline (script module có src thì
// CSP gác bằng 'self', không cần hash).
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => m[1],
);

if (inline.length === 0) {
  console.error("❌ Không tìm thấy inline script nào trong index.html — CSP có thể bỏ hash đi.");
  process.exit(1);
}

const hashes = inline.map((body) => `sha256-${createHash("sha256").update(body).digest("base64")}`);

const headers = readFileSync(headersPath, "utf8");
const present = [...headers.matchAll(/'(sha256-[A-Za-z0-9+/=]+)'/g)].map((m) => m[1]);

const missing = hashes.filter((h) => !present.includes(h));
const stale = present.filter((h) => !hashes.includes(h));

if (process.argv.includes("--write")) {
  let next = headers;
  for (const [i, old] of stale.entries()) {
    const replacement = hashes[i] ?? hashes[0];
    if (replacement) next = next.replaceAll(old, replacement);
  }
  writeFileSync(headersPath, next);
  console.log(
    `✅ _headers cập nhật: ${stale.join(", ") || "(không có gì cũ)"} → ${hashes.join(", ")}`,
  );
  process.exit(0);
}

if (missing.length > 0 || stale.length > 0) {
  console.error("❌ CSP script-hash LỆCH so với index.html:");
  for (const h of missing) console.error(`   thiếu trong _headers: '${h}'`);
  for (const h of stale) console.error(`   thừa/cũ trong _headers: '${h}'`);
  console.error("   Sửa: node scripts/csp-script-hash.mjs --write");
  console.error("   (KHÔNG được 'sửa' bằng cách thêm 'unsafe-inline' vào script-src.)");
  process.exit(1);
}

console.log(
  `✅ CSP script-hash khớp index.html (${hashes.length} inline script): ${hashes.join(", ")}`,
);
