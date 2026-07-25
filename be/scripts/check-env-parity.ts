// WHY: Chặn drift key giữa schema (src/env.schema.ts) ↔ .env.example ↔
// deploy/env.production.example. Đây là lỗ hổng làm một dự án trước gãy: schema thêm
// biến bắt buộc nhưng file example không ai cập nhật → project clone thiếu biến
// → boot chết ở production. Chạy trong `bun run validate` (+ pre-commit hook).
// FAIL nếu:
//   - example THIẾU key có trong schema (kể cả optional — mọi knob phải được
//     document; key optional được phép để dạng comment `# KEY=`);
//   - example có key ACTIVE (không comment) mà schema không biết và không nằm
//     trong INFRA_KEYS (biến cho compose/deploy tooling — app không đọc).
import { envShape } from "../src/env.schema";

/** Biến hợp lệ trong file env nhưng KHÔNG qua src/env.ts — consumer là
 * docker-compose / entrypoint.sh / deploy script / MCP tooling. Thêm biến infra
 * mới → thêm vào đây (có chủ đích, không phải tiện tay). */
export const INFRA_KEYS: ReadonlySet<string> = new Set([
  // Role OWNER — CHỈ scripts/migrate.ts + scripts/provision-runtime-role.ts đọc
  // (qua process.env, không qua src/env.ts). App runtime KHÔNG được thấy biến này:
  // nó chính là quyền mà tầng REVOKE của migration 0009 sinh ra để tước.
  "DATABASE_URL_OWNER",
  // docker-compose bootstrap
  "COMPOSE_PROJECT_NAME",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  // docker-compose.yml: host port từng service (bind 127.0.0.1, env-driven)
  "DB_PORT",
  "REDIS_PORT",
  "MAILHOG_SMTP_PORT",
  "MAILHOG_UI_PORT",
  "API_PORT",
  // deploy/docker-compose.prod.yml: port app bind trên host (127.0.0.1)
  "APP_HOST_PORT",
  // deploy compose: override image Postgres/Dragonfly (pin tag) không sửa file
  "POSTGRES_IMAGE",
  "DRAGONFLY_IMAGE",
  // deploy/backup.sh
  "BACKUP_DIR",
  "RETENTION_DAYS",
  // entrypoint.sh: worker set false để không migrate lặp
  "RUN_MIGRATIONS",
  // skill deploy-vps (pm2 flow qua SSH)
  "DEPLOY_HOST",
  "DEPLOY_USER",
  "DEPLOY_PATH",
  "DEPLOY_PM2_NAME",
  "DEPLOY_HEALTH_URL",
  // dev tooling (MCP servers), không phải runtime app
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
]);

export const EXAMPLE_FILES = [".env.example", "deploy/env.production.example"] as const;

export type FileKeys = {
  /** Key xuất hiện dưới bất kỳ dạng nào — `KEY=` hoặc `# KEY=` (đã document). */
  documented: Set<string>;
  /** Key active (dòng không comment) — phải thuộc schema hoặc INFRA_KEYS. */
  active: Set<string>;
};

export function extractKeys(text: string): FileKeys {
  const documented = new Set<string>();
  const active = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*(#\s*)?(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
    if (!match) continue;
    const key = match[2];
    if (!key) continue;
    documented.add(key);
    if (!match[1]) active.add(key);
  }
  return { documented, active };
}

export function compareFile(
  schemaKeys: readonly string[],
  keys: FileKeys,
): {
  missing: string[];
  unknown: string[];
} {
  const missing = schemaKeys.filter((k) => !keys.documented.has(k));
  const unknown = [...keys.active].filter((k) => !schemaKeys.includes(k) && !INFRA_KEYS.has(k));
  return { missing: missing.sort(), unknown: unknown.sort() };
}

if (import.meta.main) {
  const schemaKeys = Object.keys(envShape);
  let failed = false;

  for (const path of EXAMPLE_FILES) {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      console.error(`❌ ${path} không tồn tại — example file là hợp đồng, phải commit.`);
      failed = true;
      continue;
    }
    const { missing, unknown } = compareFile(schemaKeys, extractKeys(await file.text()));
    if (missing.length > 0) {
      failed = true;
      console.error(`❌ ${path} THIẾU key có trong schema src/env.schema.ts:`);
      for (const key of missing) console.error(`   • ${key}`);
    }
    if (unknown.length > 0) {
      failed = true;
      console.error(`❌ ${path} có key LẠ (không trong schema, không trong INFRA_KEYS):`);
      for (const key of unknown) console.error(`   • ${key}`);
      console.error(
        "   → Biến app đọc: thêm vào src/env.schema.ts. Biến compose/deploy: thêm INFRA_KEYS (scripts/check-env-parity.ts).",
      );
    }
  }

  if (failed) process.exit(1);
  console.log(
    `Env parity OK — ${Object.keys(envShape).length} key schema khớp ${EXAMPLE_FILES.join(" + ")}.`,
  );
}
