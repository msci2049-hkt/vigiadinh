// WHY: Architecture guardrails — chạy trong `bun run validate` (+ pre-commit hook).
// 3 check, đều dùng string/regex scan (KHÔNG ts-morph) cho nhẹ + zero-dep:
//   1) Cross-module deep import: module A import `@/modules/B/{features,infra,domain}`
//      → bắt buộc đi qua `@/modules/B` (index.ts).
//   2) eventBus-no-I/O: `eventBus.on(...)` handler PHẢI sync cùng-request.
//      Bắt callback `async`, body `await`, hoặc file handler import I/O
//      (email/resend, bullmq/@jobs, ofetch/fetch, db write). Xem rules/events.md.
//   3) BullMQ queue name PHẢI bọc `{hashtag}` (Dragonfly). Xem rules/bullmq.md.
//
// GAP đã biết (đây là smell-detector, KHÔNG phải proof):
//   - eventBus: handler tham chiếu hàm async định nghĩa nơi khác
//     (vd `eventBus.on("x", asyncFn)`) — string scan KHÔNG thấy `await` ⇒ lọt.
//     I/O ĐỒNG BỘ (vd `Bun.spawnSync`, `fs.*Sync`, sync DB driver) KHÔNG bị bắt.
//   - queue name: tên truyền bằng biến (`new Queue(name)`) KHÔNG kiểm được.
//   - eventBus I/O check ở mức FILE: file có `eventBus.on` mà import I/O bị FAIL
//     dù import đó chỉ dùng NGOÀI handler ⇒ đăng ký `.on` ở file subscriber riêng,
//     KHÔNG import I/O trong đó. `eventBus.once()` (nếu expose) KHÔNG được quét.
//   Mọi check bỏ qua match nằm trong line-comment (`//`).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MODULES_ROOT = "src/modules";
const SRC_ROOT = "src";

const boundary: string[] = [];
const eventBusIO: string[] = [];
const queueName: string[] = [];

// ---------- shared helpers ----------
function isLineCommented(content: string, idx: number): boolean {
  const lineStart = content.lastIndexOf("\n", idx) + 1;
  return content.slice(lineStart, idx).includes("//");
}

// Xoá nội dung string literal → test `async`/`await` không dính tên event
// (vd `eventBus.on("user.async", syncHandler)` không bị false-positive).
function stripStrings(s: string): string {
  return s.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "''");
}

// Trả về chuỗi argument trong cặp `()` cân bằng, bắt đầu từ `(` tại openIdx.
function balancedArgs(content: string, openIdx: number): string {
  let depth = 0;
  for (let i = openIdx; i < content.length; i++) {
    const ch = content[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return content.slice(openIdx + 1, i);
    }
  }
  return content.slice(openIdx + 1);
}

// ---------- check 1: module boundary (logic gốc, giữ nguyên hành vi) ----------
async function checkBoundary(filepath: string, content: string): Promise<void> {
  const currentModule = filepath.match(/src[/\\]modules[/\\]([^/\\]+)/)?.[1];
  if (!currentModule) return;

  const importRegex = /from\s+["'](@\/modules\/[^"']+)["']/g;
  let match: RegExpExecArray | null = importRegex.exec(content);
  while (match !== null) {
    const importPath = match[1] ?? "";
    const importedModule = importPath.match(/@\/modules\/([^/]+)/)?.[1];
    if (importedModule && importedModule !== currentModule) {
      if (importPath !== `@/modules/${importedModule}`) {
        boundary.push(`  ${filepath}\n    → ${importPath}`);
      }
    }
    match = importRegex.exec(content);
  }
}

// ---------- check 2: eventBus-no-I/O ----------
// File có `eventBus.on(...)` mà import 1 trong các module dưới đây = smell I/O.
const IO_IMPORTS: ReadonlyArray<{ re: RegExp; label: string }> = [
  {
    re: /from\s+["']@\/lib\/(?:email|resend|redis|storage)["']/,
    label: "@/lib/{email,resend,redis,storage}",
  },
  {
    re: /from\s+["'](?:resend|nodemailer|ofetch|bullmq)["']/,
    label: "lib I/O (resend/nodemailer/ofetch/bullmq)",
  },
  { re: /from\s+["']@\/jobs\//, label: "BullMQ job (@/jobs/*)" },
  { re: /\bfetch\s*\(/, label: "fetch() call" },
  { re: /\.(?:insert|update|delete)\s*\(/, label: "DB write (.insert/.update/.delete)" },
];

function checkEventBus(filepath: string, content: string): void {
  const onRe = /\beventBus\.on\s*\(/g;
  let hasOn = false;
  let m: RegExpExecArray | null = onRe.exec(content);
  while (m !== null) {
    if (!isLineCommented(content, m.index)) {
      hasOn = true;
      const openIdx = onRe.lastIndex - 1; // index của `(` sau `.on`
      const code = stripStrings(balancedArgs(content, openIdx));
      if (/\basync\b/.test(code) || /\bawait\b/.test(code)) {
        eventBusIO.push(
          `  ${filepath}\n    → eventBus.on handler async/await (phải sync cùng-request)`,
        );
      }
    }
    m = onRe.exec(content);
  }
  if (hasOn) {
    for (const io of IO_IMPORTS) {
      if (io.re.test(content)) {
        eventBusIO.push(`  ${filepath}\n    → eventBus.on file làm I/O: ${io.label}`);
      }
    }
  }
}

// ---------- check 3: BullMQ queue name `{hashtag}` ----------
function checkQueueName(filepath: string, content: string): void {
  const ctorRe = /new\s+(Queue|Worker|QueueEvents)\b[^(]*\(\s*(['"`])([^'"`]*)\2/g;
  let m: RegExpExecArray | null = ctorRe.exec(content);
  while (m !== null) {
    if (!isLineCommented(content, m.index)) {
      const ctor = m[1];
      const quote = m[2];
      const name = m[3] ?? "";
      const dynamic = quote === "`" && name.includes("${"); // template biến → bỏ qua
      if (!dynamic && !/\{[^}]+\}/.test(name)) {
        queueName.push(
          `  ${filepath}\n    → new ${ctor}("${name}") thiếu {hashtag} (Dragonfly multi-thread)`,
        );
      }
    }
    m = ctorRe.exec(content);
  }
}

// ---------- walk ----------
async function walk(
  dir: string,
  perFile: (path: string, content: string) => unknown,
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, perFile);
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      await perFile(fullPath, await readFile(fullPath, "utf-8"));
    }
  }
}

// ---------- run ----------
await walk(MODULES_ROOT, checkBoundary);
await walk(SRC_ROOT, (path, content) => {
  checkEventBus(path, content);
  checkQueueName(path, content);
});

// ---------- report ----------
let failed = false;
function report(title: string, items: string[], fix: string): void {
  if (items.length === 0) return;
  failed = true;
  console.error(`\n${title} (${items.length}):`);
  for (const v of items) console.error(v);
  console.error(`  Fix: ${fix}`);
}

report(
  "Module boundary violations",
  boundary,
  "import qua @/modules/<name> (index.ts) hoặc dùng eventBus.",
);
report(
  "eventBus I/O violations",
  eventBusIO,
  "eventBus chỉ cho side-effect sync cùng-request; I/O/durable phải đi BullMQ (xem .claude/rules/events.md).",
);
report(
  "BullMQ queue-name violations",
  queueName,
  'bọc tên queue bằng {hashtag}, vd new Queue("{send-email}") (xem .claude/rules/bullmq.md).',
);

if (failed) {
  process.exit(1);
}

console.log("All architecture guardrails respected (boundary + eventBus-no-IO + queue-name).");
