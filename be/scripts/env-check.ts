// WHY: Kiểm env TRƯỚC khi boot/deploy — thuốc chống crash-loop mù (sự cố thực tế ở một dự án trước:
// flip NODE_ENV=production → pm2 restart 0→16, không biết biến nào thiếu).
//   - KHÔNG khởi động app, KHÔNG mở DB/Redis — chỉ load schema + safeParse.
//   - Mặc định: kiểm process.env (Bun tự load .env khi chạy `bun run env:check`).
//   - `--env-file <path>`: kiểm RIÊNG file đó (KHÔNG merge process.env — giống
//     cách docker compose `env_file:` dùng: file phải TỰ ĐỦ). Dùng để kiểm
//     deploy/.env.production TRƯỚC khi áp — đây là GATE trong deploy/deploy.sh.
//   - Giá trị dạng `<...>` = placeholder chưa thay (format chuẩn của
//     deploy/env.production.example) → FAIL kể cả khi schema chỉ đòi min(1).
// Exit 0 = pass, exit 1 = fail (in TỪNG biến lỗi + lý do, không dump JSON thô).
import {
  type EnvIssueLine,
  envSchema,
  envShape,
  formatEnvIssues,
  normalizeRawEnv,
  PROD_REQUIRED_CHAIN_KEYS,
  requiredEnvKeys,
} from "../src/env.schema";

export type CheckResult = {
  ok: boolean;
  problems: EnvIssueLine[];
  /** NODE_ENV của nguồn được kiểm (để in nhắc tập prod-required). */
  nodeEnv: string | undefined;
};

/** Parse file .env đơn giản: KEY=VALUE, bỏ comment/dòng trống, hỗ trợ
 * `export KEY=`, quote đôi/đơn bao ngoài, CRLF. Đủ cho file env của template —
 * không cần lib dotenv. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] ?? "";
    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      // Không quote → cắt comment inline (` # ...`) nếu có.
      value = value.replace(/\s+#.*$/, "").trim();
    }
    if (key) out[key] = value;
  }
  return out;
}

const PLACEHOLDER_RE = /<[^<>\n]{1,80}>/;

/** Validate 1 record env theo đúng schema boot (src/env.schema.ts).
 * `scanAllKeysForPlaceholder`: true cho --env-file (file deploy phải sạch 100%,
 * kể cả biến infra như POSTGRES_PASSWORD); false cho process.env (tránh quét
 * biến hệ điều hành không liên quan). */
export function checkEnvRecord(
  source: Record<string, string | undefined>,
  opts: { scanAllKeysForPlaceholder?: boolean } = {},
): CheckResult {
  const raw = normalizeRawEnv(source);
  const byKey = new Map<string, string>();

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    for (const { key, reason } of formatEnvIssues(parsed.error.issues, raw)) {
      byKey.set(key, reason);
    }
  }

  const placeholderKeys = opts.scanAllKeysForPlaceholder ? Object.keys(raw) : Object.keys(envShape);
  for (const key of placeholderKeys) {
    const value = raw[key];
    if (value !== undefined && PLACEHOLDER_RE.test(value)) {
      byKey.set(key, `placeholder \`${value}\` chưa thay bằng giá trị thật`);
    }
  }

  // 4 biến chain: schema optional (dev/test degrade có chủ đích) nhưng file env
  // PRODUCTION thiếu chúng = sep45 503 + recovery-watch skipped + indexer no-op
  // + send 503 — các phòng tuyến chính tắt im lặng. Chặn tại gate này.
  if (raw.NODE_ENV === "production") {
    for (const key of PROD_REQUIRED_CHAIN_KEYS) {
      if (raw[key] === undefined && !byKey.has(key)) {
        byKey.set(key, "THIẾU — bắt buộc khi NODE_ENV=production (biến chain, xem env.schema.ts)");
      }
    }
  }

  const problems = [...byKey.entries()].map(([key, reason]) => ({ key, reason }));
  problems.sort((a, b) => a.key.localeCompare(b.key));
  return { ok: problems.length === 0, problems, nodeEnv: raw.NODE_ENV };
}

/** In kết quả + trả exit code. Tách khỏi CLI block để test được. */
export function reportResult(result: CheckResult, label: string): number {
  if (result.ok) {
    console.log(`✅ ENV hợp lệ (${label}) — đủ ${requiredEnvKeys().length} biến bắt buộc.`);
    return 0;
  }
  console.error(`❌ ENV KHÔNG HỢP LỆ (${label}) — ${result.problems.length} biến lỗi:`);
  for (const { key, reason } of result.problems) {
    console.error(`   • ${key} — ${reason}`);
  }
  const required = requiredEnvKeys();
  const failing = new Set(result.problems.map((p) => p.key));
  const missingRequired = required.filter((k) => failing.has(k));
  if (missingRequired.length > 0) {
    const scope = result.nodeEnv === "production" ? "PROD-REQUIRED" : "REQUIRED";
    console.error(
      `→ ${scope} thiếu/sai (${missingRequired.length}/${required.length}): ${missingRequired.join(", ")}`,
    );
  }
  console.error(`→ Tập biến bắt buộc đầy đủ: ${required.join(", ")}`);
  console.error("→ Sửa xong chạy lại: bun run env:check [--env-file <file>]");
  return 1;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const fileFlagIdx = args.indexOf("--env-file");
  if (fileFlagIdx !== -1) {
    const path = args[fileFlagIdx + 1];
    if (!path) {
      console.error("❌ Thiếu path: bun run env:check --env-file <path>");
      process.exit(1);
    }
    const file = Bun.file(path);
    if (!(await file.exists())) {
      console.error(`❌ Không đọc được file: ${path}`);
      process.exit(1);
    }
    const record = parseEnvFile(await file.text());
    const result = checkEnvRecord(record, { scanAllKeysForPlaceholder: true });
    process.exit(reportResult(result, path));
  }
  const result = checkEnvRecord(process.env);
  process.exit(reportResult(result, "process.env — .env đã được Bun tự load"));
}
