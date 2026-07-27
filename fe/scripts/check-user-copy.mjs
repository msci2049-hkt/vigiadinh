/**
 * Static guard (D-052): copy hiển thị cho USER không được chứa rác template.
 *
 * Bài học thật: chuỗi "Cần BE chạy ở localhost:3000" (i18n sót từ boilerplate)
 * hiện trên trang login PROD nhiều tuần — nó KHÔNG phải lỗi cấu hình nhưng đánh
 * lừa chẩn đoán, tốn nhiều lượt debug nhầm hướng.
 *
 * Phạm vi: CHỈ copy hiển thị cho user — file i18n (apps/[asterisk]/src/locales/**.json),
 * index.html, và src/config/site.ts (branding). KHÔNG áp cho code/config/dev docs
 * (env.ts, README, comments… là chỗ hợp lệ cho localhost/TODO).
 * Ngoại lệ chính đáng → allowlist THEO GIÁ TRỊ kèm reason.
 * Chạy trong `pnpm validate` và CI.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

/** Giá trị được phép xuất hiện trong copy — MỖI entry phải có reason. */
const VALUE_ALLOWLIST = [
  {
    value: "you@example.com",
    reason: "Placeholder của input email — RFC 2606 dành riêng example.com cho mục đích minh hoạ.",
  },
];

const TOKENS = [
  { re: /localhost/i, label: "localhost" },
  { re: /127\.0\.0\.1/, label: "127.0.0.1" },
  { re: /example\.(com|org|net)/i, label: "example.com" },
  { re: /\bTODO\b/, label: "TODO" },
  { re: /\bFIXME\b/, label: "FIXME" },
  { re: /lorem/i, label: "lorem" },
  { re: /\byour app\b/i, label: '"Your App"' },
  { re: /\bmy app\b/i, label: '"My App"' },
  { re: /mau[ -]demo/i, label: "tên template gốc (Mau Demo)" },
  // ---- Trang mẫu "khoe stack" (thêm 2026-07-27, sau khi nó LÊN PRODUCTION) ----
  // Guard này vốn ĐÃ quét locales JSON, nhưng danh sách token chỉ có localhost/TODO/
  // "Mau Demo" nên trang chủ template lọt qua nhiều tuần: chuỗi hiển thị của nó là
  // "FE mẫu React 19 + Vite — cắm thẳng BE Bun + Hono" và 6 thẻ tên thư viện, nằm
  // trong `home.*` của common.json. Grep theo tên biến hay theo "Mau Demo" đều KHÔNG
  // khớp. Bài học: bắt theo CHUỖI NGƯỜI DÙNG NHÌN THẤY, và bắt cả tiếng Việt.
  // Copy sản phẩm nói chuyện với người thường thì không có lý do gì nhắc tên thư viện.
  { re: /FE mẫu|mẫu React/i, label: 'copy template ("FE mẫu")' },
  { re: /cắm thẳng/i, label: 'copy template ("cắm thẳng BE…")' },
  { re: /TanStack/i, label: "tên thư viện trong copy (TanStack)" },
  { re: /shadcn/i, label: "tên thư viện trong copy (shadcn)" },
  { re: /tailwind/i, label: "tên thư viện trong copy (Tailwind)" },
  { re: /better auth/i, label: "tên thư viện trong copy (Better Auth)" },
  { re: /\bRHF\b/i, label: "tên thư viện trong copy (RHF)" },
];

/** Copy hiển thị cho user: locales JSON + index.html + site.ts của mỗi app. */
function collectUserCopyFiles() {
  const files = [];
  const appsDir = join(ROOT, "apps");
  if (!existsSync(appsDir)) return files;
  for (const app of readdirSync(appsDir)) {
    const appDir = join(appsDir, app);
    if (!statSync(appDir).isDirectory()) continue;
    const localesDir = join(appDir, "src", "locales");
    if (existsSync(localesDir)) {
      for (const lang of readdirSync(localesDir)) {
        const langDir = join(localesDir, lang);
        if (!statSync(langDir).isDirectory()) continue;
        for (const f of readdirSync(langDir)) {
          if (f.endsWith(".json")) files.push(join(langDir, f));
        }
      }
    }
    for (const extra of ["index.html", join("src", "config", "site.ts")]) {
      const p = join(appDir, extra);
      if (existsSync(p)) files.push(p);
    }
  }
  return files;
}

function main() {
  const violations = [];

  for (const file of collectUserCopyFiles()) {
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((rawLine, i) => {
      let line = rawLine;
      for (const allowed of VALUE_ALLOWLIST) {
        line = line.replaceAll(allowed.value, "");
      }
      for (const token of TOKENS) {
        if (token.re.test(line)) {
          violations.push({ file: rel, line: i + 1, token: token.label, snippet: rawLine.trim() });
        }
      }
    });
  }

  if (violations.length > 0) {
    console.error(`\n❌ Rác template trong copy hiển thị cho user (${violations.length}):\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  [${v.token}]`);
      console.error(`    ${v.snippet.slice(0, 120)}`);
    }
    console.error(
      "\n  Copy user-facing không được chứa localhost/example/TODO/tên template — nó đánh lừa",
    );
    console.error(
      "  chẩn đoán khi lên PROD. Ngoại lệ chính đáng → VALUE_ALLOWLIST trong scripts/check-user-copy.mjs KÈM reason.\n",
    );
    process.exit(1);
  }

  console.log("✅ User copy OK — không còn rác template trong copy hiển thị.");
}

main();
