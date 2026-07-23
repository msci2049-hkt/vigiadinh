// WHY: Gác contract BE↔FE không cần shared package. `packages/auth/src/access-control.ts`
// (FE) và `src/lib/access-control.ts` (BE) là BẢN CHÉP TAY của nhau — script này
// hash phần NGỮ NGHĨA (bỏ dòng comment/trống) và so với canonical hash trong
// docs/CONTRACT-SYNC.md. Hai repo dùng CÙNG thuật toán chuẩn hóa nên cùng một
// canonical hash. Lệch = có người sửa 1 bên mà chưa sync bên kia.
// Chạy trong `pnpm validate` (→ CI fail nếu lệch).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const CONTRACT_FILE = "packages/auth/src/access-control.ts";
const SYNC_DOC = "docs/CONTRACT-SYNC.md";

function normalize(source) {
  return source
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => {
      const t = line.trim();
      return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}

const actual = createHash("sha256")
  .update(normalize(readFileSync(CONTRACT_FILE, "utf8")))
  .digest("hex");

const doc = readFileSync(SYNC_DOC, "utf8");
const m = doc.match(/canonical-hash:\s*`?([0-9a-f]{64})`?/);
if (!m) {
  console.error(`❌ ${SYNC_DOC} thiếu dòng "canonical-hash: <sha256>".`);
  process.exit(1);
}
const expected = m[1];

if (actual !== expected) {
  console.error(`❌ Contract BE↔FE LỆCH: ${CONTRACT_FILE}
   hash thực tế : ${actual}
   hash đã chốt : ${expected}
   → Nếu bạn VỪA sửa access-control: sửa Y HỆT ở repo BE
     (stellaer-be/src/lib/access-control.ts), rồi cập nhật canonical-hash
     trong docs/CONTRACT-SYNC.md ở CẢ HAI repo.
   → Nếu bạn KHÔNG sửa: có người đổi contract mà chưa sync — đừng ép hash,
     đối chiếu 2 repo trước. Quy trình: docs/CONTRACT-SYNC.md.`);
  process.exit(1);
}

console.log(`Contract OK — ${CONTRACT_FILE} khớp canonical hash (${actual.slice(0, 12)}…).`);
