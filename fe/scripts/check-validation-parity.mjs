/**
 * Static guard (D-052): FE KHÔNG được hardcode giá trị số cho quy tắc validate
 * mà BE sở hữu (min/max length, OTP length, size limit…).
 *
 * Class lỗi "hai nguồn sự thật": FE tự đặt ngưỡng (vd password min 8) trong khi
 * BE enforce ngưỡng khác (minPasswordLength 12) → user qua được form, bị chặn ở
 * tầng sau với thông báo khó hiểu. BE là nguồn sự thật DUY NHẤT — FE đọc ngưỡng
 * runtime qua GET /api/config/validation (xem apps/web/src/lib/validation-limits.ts).
 *
 * Guard quét mọi file .ts/.tsx có import zod trong apps/[asterisk]/src + packages/[asterisk]/src và
 * FAIL khi gặp .min(N) / .max(N) / .length(N) với N ≥ 2, hoặc quantifier \d{N}
 * trong .regex(...). N = 0/1 được phép (ngữ nghĩa "required"/"non-negative",
 * không phải ngưỡng nghiệp vụ). Ngoại lệ chính đáng → ALLOWLIST kèm reason.
 * Chạy trong `pnpm validate` và CI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

/** File được phép chứa ngưỡng số — MỖI entry phải có reason. */
const ALLOWLIST = [
  {
    file: "apps/web/src/lib/validation-limits.ts",
    reason:
      "Fallback DUY NHẤT khi GET /api/config/validation chưa reachable — đồng bộ theo contract §8 CLAUDE.md.",
  },
  {
    file: "apps/carbon/src/config/field-limits.ts",
    reason:
      "Demo carbon: mirror BE src/modules/{admin,plot}/dto.ts trong 1 file duy nhất — cả hai lớp demo xoá cùng nhau khi degit.",
  },
];

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", "e2e", "test"]);
const SKIP_FILE_RE = /(\.test\.(ts|tsx)|routeTree\.gen\.ts|\.d\.ts)$/;
// .min(N)/.max(N)/.length(N) — loại trừ Math.min/Math.max qua lookbehind.
const CHAIN_RE = /(?<!Math)\.(min|max|length)\(\s*(\d[\d_]*)\s*[,)]/g;
// Quantifier cứng kiểu /^\d{6}$/ bên trong .regex(...) (OTP length…).
const REGEX_QUANT_RE = /\.regex\([^)]*\\d\{(\d+)\}/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry) && !SKIP_FILE_RE.test(entry)) {
      yield full;
    }
  }
}

function collectSourceFiles() {
  const files = [];
  for (const group of ["apps", "packages"]) {
    const groupDir = join(ROOT, group);
    let entries;
    try {
      entries = readdirSync(groupDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const srcDir = join(groupDir, entry, "src");
      try {
        if (!statSync(srcDir).isDirectory()) continue;
      } catch {
        continue;
      }
      files.push(...walk(srcDir));
    }
  }
  return files;
}

function main() {
  const violations = [];

  for (const file of collectSourceFiles()) {
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    const allowed = ALLOWLIST.find((a) => a.file === rel);
    if (allowed) continue;

    const source = readFileSync(file, "utf8");
    // Chỉ quan tâm file có schema Zod — nơi ngưỡng validate sống.
    if (!/from\s+["']zod["']/.test(source)) continue;

    const lines = source.split("\n");
    lines.forEach((line, i) => {
      for (const match of line.matchAll(CHAIN_RE)) {
        const value = Number.parseInt(match[2].replaceAll("_", ""), 10);
        if (value >= 2) {
          violations.push({ file: rel, line: i + 1, snippet: match[0], value });
        }
      }
      for (const match of line.matchAll(REGEX_QUANT_RE)) {
        const value = Number.parseInt(match[1], 10);
        if (value >= 2) {
          violations.push({ file: rel, line: i + 1, snippet: `.regex(…\\d{${value}}…)`, value });
        }
      }
    });
  }

  if (violations.length > 0) {
    console.error(`\n❌ FE hardcode ngưỡng validate mà BE sở hữu (${violations.length}):\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.snippet.trim()}`);
    }
    console.error("\n  Quy tắc validate chỉ được định nghĩa MỘT nơi (BE). FE đọc ngưỡng qua");
    console.error(
      "  GET /api/config/validation → useValidationLimits() (apps/web/src/lib/validation-limits.ts).",
    );
    console.error(
      "  Ngoại lệ chính đáng → thêm vào ALLOWLIST trong scripts/check-validation-parity.mjs KÈM reason.\n",
    );
    process.exit(1);
  }

  console.log("✅ Validation parity OK — FE không hardcode ngưỡng của BE.");
}

main();
