#!/usr/bin/env node
// init-project — chạy Ở DỰ ÁN MỚI sau khi degit template (KHÔNG chạy trên repo mẫu).
//   npx degit <template-repo> ten-du-an && cd ten-du-an && node scripts/init-project.mjs ten-du-an
// Việc script làm: (1) guard chống chạy nhầm trên mẫu → (2) xoá lớp demo carbon
// (file list + block đánh dấu [TEMPLATE-DEMO:carbon]) → (3) đổi danh tính (package
// name, README) → (4) sinh .env với BETTER_AUTH_SECRET MỚI + COMPOSE_PROJECT_NAME/
// COOKIE_PREFIX = slug + port rảnh → (5) reset git → (6) bun install + db:generate
// → (7) in checklist việc TAY còn lại. Cờ: --keep-demo --no-install --no-git --force-git
import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const nameArg = args.find((a) => !a.startsWith("--"));

function die(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}
function log(msg) {
  console.log(`  ${msg}`);
}

// ---------------------------------------------------------------- 0. tên dự án
if (!nameArg) die("Thiếu tên dự án. Dùng: node scripts/init-project.mjs <ten-du-an> [--keep-demo]");
const slug = nameArg
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/^-+|-+$/g, "");
if (!/^[a-z][a-z0-9-]{1,40}$/.test(slug))
  die(`Tên "${nameArg}" → slug "${slug}" không hợp lệ (a-z0-9-, bắt đầu bằng chữ).`);

// ------------------------------------------------- 1. GUARD: không chạy trên MẪU
const TEMPLATE_REMOTES = ["code-base-mau-be-chuan-cho-cac-du-an", "mau-demo-fe-vite"];
const hasGit = existsSync(path.join(ROOT, ".git"));
if (hasGit) {
  let remote = "";
  try {
    remote = execSync("git remote get-url origin", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    /* không có remote — repo local */
  }
  if (TEMPLATE_REMOTES.some((r) => remote.includes(r)))
    die(
      "Repo này đang trỏ remote của TEMPLATE MẪU — init-project chỉ chạy ở dự án MỚI sau khi degit.\n" +
        "   Nếu bạn clone (thay vì degit), hãy degit lại hoặc tự gỡ .git trước.",
    );
  if (!flags.has("--force-git") && !flags.has("--no-git"))
    die(
      "Thư mục đã có .git (không phải degit sạch). Chọn một trong hai:\n" +
        "   --force-git  → script XOÁ .git hiện có rồi git init mới\n" +
        "   --no-git     → giữ nguyên .git hiện có",
    );
}

console.log(`\n🚀 init-project: "${slug}" (BE template)\n`);

// ------------------------------------------- 2. xoá lớp demo carbon (mặc định)
const DEMO_PATHS = [
  "src/modules/admin",
  "src/modules/approval",
  "src/modules/carbon",
  "src/modules/commune",
  "src/modules/me",
  "src/modules/plot",
  "src/modules/plot-document",
  "src/modules/pool",
  "src/modules/wallet",
  "src/jobs",
  "src/integrations",
  "src/db/schema/approvals.ts",
  "src/db/schema/carbon-records.ts",
  "src/db/schema/communes.ts",
  "src/db/schema/officer-communes.ts",
  "src/db/schema/plot-documents.ts",
  "src/db/schema/plots.ts",
  "src/db/schema/pool-contributions.ts",
  "src/db/schema/pool-rounds.ts",
  "src/db/schema/wallet-txns.ts",
  "src/lib/cdhc-jwt.ts",
  "src/lib/cdhc-jwt.test.ts",
  "src/lib/chain.ts",
  "src/lib/chain.test.ts",
  "src/lib/geo.ts",
  "src/lib/geo.test.ts",
  "src/lib/geo-pg.ts",
  "src/lib/geo-pg.test.ts",
  "src/lib/gpt.ts",
  "src/lib/officer-scope.ts",
  "src/lib/officer-scope.test.ts",
  "src/lib/overlap-check.ts",
  "src/lib/sentinel.ts",
  "src/lib/sentinel.test.ts",
  "src/middlewares/carbon-auth.ts",
  "src/middlewares/carbon-auth.types.ts",
  "src/middlewares/carbon-auth.test.ts",
  "src/middlewares/carbon-auth.modes.test.ts",
  "src/test-support/carbon-fixtures.ts",
  "scripts/seed.ts",
  "scripts/e2e-carbon.sh",
  "scripts/apply-postgis.ts",
  "docker-compose.carbon.yml",
  "DEPLOY.md",
  "drizzle/postgis.sql",
];
// File có block/dòng đánh dấu [TEMPLATE-DEMO:carbon] cần strip.
const MARKED_FILES = [
  "src/app.ts",
  "src/index.ts",
  "src/env.schema.ts",
  "src/env.schema.test.ts",
  "src/db/schema/index.ts",
  "src/workers/index.ts",
  "src/middlewares/error.ts",
  "src/types/hono.d.ts",
  "src/test-support/pg.ts",
  "scripts/check-env-parity.ts",
  ".env.example",
  "deploy/env.production.example",
];
const BEGIN = /\[TEMPLATE-DEMO:carbon:BEGIN\]/;
const END = /\[TEMPLATE-DEMO:carbon:END\]/;
const LINE = /\[TEMPLATE-DEMO:carbon\]/;

function stripMarked(text, file) {
  const out = [];
  let inBlock = false;
  for (const line of text.split("\n")) {
    if (inBlock) {
      if (END.test(line)) inBlock = false;
      continue;
    }
    if (BEGIN.test(line)) {
      inBlock = true;
      continue;
    }
    if (LINE.test(line)) continue;
    out.push(line);
  }
  if (inBlock) die(`Block [TEMPLATE-DEMO:carbon:BEGIN] không đóng trong ${file}`);
  return out.join("\n");
}

let migrationsReset = false;
if (!flags.has("--keep-demo")) {
  console.log("🧹 Xoá lớp demo carbon…");
  for (const p of DEMO_PATHS) {
    const full = path.join(ROOT, p);
    if (existsSync(full)) {
      rmSync(full, { recursive: true, force: true });
      log(`xoá ${p}`);
    }
  }
  for (const p of MARKED_FILES) {
    const full = path.join(ROOT, p);
    if (!existsSync(full)) continue;
    const before = readFileSync(full, "utf8");
    const after = stripMarked(before, p);
    if (after !== before) {
      writeFileSync(full, after);
      log(`strip marker ${p}`);
    }
  }
  // workers/ giữ nguyên: array rỗng đã log "no workers registered yet".
  // Reset migration: bảng carbon nằm trong 0002..0006 → xoá toàn bộ SQL sinh
  // bởi drizzle-kit + meta, giữ auth-indexes.sql. Sinh lại baseline ở bước 6.
  const drizzleDir = path.join(ROOT, "drizzle");
  for (const f of ["meta", ...listSqlMigrations(drizzleDir)]) {
    rmSync(path.join(drizzleDir, f), { recursive: true, force: true });
  }
  migrationsReset = true;
  log("reset drizzle/ (giữ auth-indexes.sql) — baseline mới sinh ở bước install");
}

function listSqlMigrations(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f));
}

// ------------------------------------------------------ 3. danh tính dự án mới
console.log("🏷️  Đổi danh tính…");
const pkgPath = path.join(ROOT, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = slug;
if (!flags.has("--keep-demo")) {
  delete pkg.scripts.seed;
  delete pkg.scripts["db:postgis"];
  delete pkg.dependencies.viem;
}
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
log(`package.json name = "${slug}"${flags.has("--keep-demo") ? "" : " (gỡ seed/db:postgis/viem)"}`);

const readmePath = path.join(ROOT, "README.md");
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, "utf8").split("\n");
  readme[0] = `# ${slug}`;
  writeFileSync(readmePath, readme.join("\n"));
  log(`README.md tiêu đề = "# ${slug}"`);
}

// ------------------------------------------------------------- 4. sinh .env
async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

const envPath = path.join(ROOT, ".env");
if (existsSync(envPath)) {
  console.log("⚠️  .env đã tồn tại — KHÔNG ghi đè (kiểm tra tay các giá trị bên dưới).");
} else {
  console.log("🔐 Sinh .env…");
  const secret = randomBytes(32).toString("base64");
  const [dbPort, redisPort, smtpPort, uiPort] = [
    await freePort(),
    await freePort(),
    await freePort(),
    await freePort(),
  ];
  let env = readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const set = (key, value) => {
    // thay cả dạng active lẫn dạng comment "# KEY=..."
    const re = new RegExp(`^(#\\s*)?${key}=.*$`, "m");
    if (!re.test(env)) die(`.env.example thiếu key ${key} — cập nhật script/init hoặc example.`);
    env = env.replace(re, `${key}=${value}`);
  };
  set("BETTER_AUTH_SECRET", secret);
  set("COMPOSE_PROJECT_NAME", slug);
  set("COOKIE_PREFIX", slug);
  set("DB_PORT", String(dbPort));
  set("REDIS_PORT", String(redisPort));
  set("MAILHOG_SMTP_PORT", String(smtpPort));
  set("MAILHOG_UI_PORT", String(uiPort));
  set("DATABASE_URL", `postgresql://app:app@localhost:${dbPort}/app`);
  set("REDIS_URL", `redis://localhost:${redisPort}`);
  set("SMTP_HOST", "localhost");
  set("SMTP_PORT", String(smtpPort));
  writeFileSync(envPath, env);
  log(`BETTER_AUTH_SECRET mới (KHÔNG tái dùng secret của mẫu)`);
  log(`COMPOSE_PROJECT_NAME=${slug} · COOKIE_PREFIX=${slug}`);
  log(
    `port rảnh: DB=${dbPort} Redis=${redisPort} Mailhog=${smtpPort}/${uiPort} (đã khớp DATABASE_URL/REDIS_URL)`,
  );
}

// ------------------------------------------------------------- 5. reset git
if (!flags.has("--no-git")) {
  console.log("🌱 Reset git (dự án mới, lịch sử mới)…");
  rmSync(path.join(ROOT, ".git"), { recursive: true, force: true });
  execSync("git init -b main", { cwd: ROOT, stdio: "ignore" });
  log("git init -b main (chưa có remote — xem checklist)");
}

// ------------------------------------------------- 6. install + format + baseline migration
if (!flags.has("--no-install")) {
  console.log("📦 bun install…");
  const r = spawnSync("bun", ["install"], { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) console.error("⚠️  bun install lỗi — chạy lại tay rồi tiếp các bước dưới.");
  else {
    // Strip block để lại dòng trống thừa → format lại cho `bun run validate` xanh.
    console.log("🎨 biome format (dọn khoảng trống sau strip)…");
    spawnSync("bunx", ["biome", "check", "--write", "."], {
      cwd: ROOT,
      stdio: "ignore",
      shell: true,
    });
    if (migrationsReset) {
      console.log("🗃️  Sinh baseline migration mới (drizzle-kit generate)…");
      const g = spawnSync("bun", ["run", "db:generate"], {
        cwd: ROOT,
        stdio: "inherit",
        shell: true,
      });
      if (g.status !== 0)
        console.error("⚠️  db:generate lỗi — chạy tay: bun run db:generate (cần .env hợp lệ).");
    }
  }
} else {
  console.log(
    "ℹ️  Nhớ chạy: bun install && bunx biome check --write . " +
      (migrationsReset ? "&& bun run db:generate (baseline migration mới)" : ""),
  );
}

// ------------------------------------------------------------- 7. checklist tay
console.log(`
✅ init-project xong. VIỆC TAY còn lại (script KHÔNG tự làm được):

  Git & CI
  □ Tạo repo GitHub mới → git remote add origin <url> → commit đầu + push
  □ Bật Renovate app + Dependency graph/Dependabot alerts (docs/HUMAN-TODO.md §3)
  □ Cài gitleaks binary trên mỗi máy dev (docs/HUMAN-TODO.md §2)
  □ Xem run CI đầu tiên xanh (validate + secrets-scan)

  Secrets & dịch vụ ngoài (điền vào .env — KHÔNG dùng giá trị của dự án khác)
  □ RESEND_API_KEY + EMAIL_FROM (verify domain trong Resend)
  □ SENTRY_DSN mới (tạo project Sentry riêng; trống = tắt)

  Khi lên production
  □ deploy/env.production.example → deploy/.env.production, thay mọi <...>
  □ TRUSTED_ORIGINS = origin FE thật · BETTER_AUTH_URL = URL public API

  Ghép với FE (repo FE degit riêng — chạy init-project bên đó)
  □ FE VITE_API_URL == BE BETTER_AUTH_URL · origin FE ∈ TRUSTED_ORIGINS
  □ access-control BE (src/lib/access-control.ts) phải MIRROR FE (packages/auth)

  Dọn nốt tài liệu
  □ .claude/CODE_BASE_MAP.md + docs/GIOI-THIEU.md còn mô tả lớp demo carbon — cập nhật
  □ README.md: viết mô tả dự án thật

  Chạy thử:  bun run env:check && docker compose up -d && bun run db:migrate \\
             && bun run seed:admin && bun run dev
`);
