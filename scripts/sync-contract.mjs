// WHY: shared/ là NGUỒN hợp đồng BE↔FE nhưng hai bên build riêng (bun vs pnpm),
// CẤM import chéo — nên đồng bộ bằng COPY có header cảnh báo, gác bằng check-contract.mjs.
// Chạy: `bun run sync:contract` (hoặc `node scripts/sync-contract.mjs`) từ root.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Mỗi file shared → 2 bản copy (BE + FE). Thêm file shared mới = thêm entry ở đây
// VÀ ở scripts/check-contract.mjs (MIRRORS phải giống hệt nhau ở 2 script).
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

const HEADER = (source) =>
  `// AUTO-SYNC từ ${source} — ĐỪNG SỬA TAY. Sửa ở shared/ rồi chạy \`bun run sync:contract\`.\n`;

for (const { source, targets } of MIRRORS) {
  const body = readFileSync(join(ROOT, source), "utf8");
  for (const target of targets) {
    const abs = join(ROOT, target);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, HEADER(source) + body);
    console.log(`sync: ${source} → ${target}`);
  }
}
console.log("sync:contract xong — chạy `bun run check:contract` để xác nhận.");
