// WHY: gác hợp đồng shared/ ↔ bản copy ở be/ + fe/ (sinh bởi sync-contract.mjs).
// Cùng thuật toán chuẩn hóa với be/scripts/contract-check.ts và fe/scripts/contract-check.mjs:
// bỏ dòng comment (//, *, /*) + dòng trống + trailing space rồi SHA-256 — nên header AUTO-SYNC
// không làm lệch hash. Lệch/thiếu = exit 1.
// Chạy: `bun run check:contract` (hoặc `node scripts/check-contract.mjs`) từ root.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// PHẢI giống hệt MIRRORS trong scripts/sync-contract.mjs.
const MIRRORS = [
  {
    source: "shared/contract.ts",
    targets: ["be/src/shared-contract/contract.ts", "fe/packages/core/src/contract/contract.ts"],
  },
  {
    source: "shared/intent.ts",
    targets: ["be/src/shared-contract/intent.ts", "fe/packages/core/src/contract/intent.ts"],
  },
];

function canonicalHash(source) {
  const normalized = source
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => {
      const t = line.trim();
      return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}

let failed = false;
for (const { source, targets } of MIRRORS) {
  const expected = canonicalHash(readFileSync(join(ROOT, source), "utf8"));
  for (const target of targets) {
    const abs = join(ROOT, target);
    if (!existsSync(abs)) {
      console.error(`❌ THIẾU bản copy: ${target} — chạy \`bun run sync:contract\`.`);
      failed = true;
      continue;
    }
    const actual = canonicalHash(readFileSync(abs, "utf8"));
    if (actual !== expected) {
      console.error(`❌ LỆCH hợp đồng: ${target} khác ${source}
   → Nếu vừa sửa shared/: chạy \`bun run sync:contract\` rồi commit cả 3 bản.
   → Nếu KHÔNG sửa shared/: có người sửa bản copy bằng tay — đối chiếu trước, đừng ép.`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("check:contract OK — shared/ khớp bản copy ở be/ + fe/.");
