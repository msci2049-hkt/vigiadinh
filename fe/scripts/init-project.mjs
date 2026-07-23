#!/usr/bin/env node
// init-project — chạy Ở DỰ ÁN MỚI sau khi degit template FE (KHÔNG chạy trên repo mẫu).
//   npx degit <template-repo> ten-du-an-fe && cd ten-du-an-fe && node scripts/init-project.mjs ten-du-an
// Việc script làm: (1) guard chống chạy nhầm trên mẫu → (2) xoá app demo carbon
// (apps/carbon + mọi wiring: root script, turbo passthrough, ci/deploy workflow)
// → (3) đổi danh tính (root package name, README, VITE_APP_NAME) → (4) sinh
// apps/web/.env → (5) reset git → (6) pnpm install → (7) in checklist việc tay.
// Cờ: --keep-demo --no-install --no-git --force-git
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
function editFile(rel, fn) {
  const full = path.join(ROOT, rel);
  if (!existsSync(full)) return;
  const before = readFileSync(full, "utf8");
  const after = fn(before);
  if (after !== before) {
    writeFileSync(full, after);
    log(`sửa ${rel}`);
  }
}

// ---------------------------------------------------------------- 0. tên dự án
if (!nameArg) die("Thiếu tên dự án. Dùng: node scripts/init-project.mjs <ten-du-an> [--keep-demo]");
const slug = nameArg
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/^-+|-+$/g, "");
if (!/^[a-z][a-z0-9-]{1,40}$/.test(slug))
  die(`Tên "${nameArg}" → slug "${slug}" không hợp lệ (a-z0-9-, bắt đầu bằng chữ).`);
// Tên hiển thị cho VITE_APP_NAME: "shop-abc" → "Shop Abc"
const displayName = slug
  .split("-")
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(" ");

// ------------------------------------------------- 1. GUARD: không chạy trên MẪU
const TEMPLATE_REMOTES = ["mau-demo-fe-vite", "code-base-mau-be-chuan-cho-cac-du-an"];
if (existsSync(path.join(ROOT, ".git"))) {
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

console.log(`\n🚀 init-project: "${slug}" (FE template)\n`);

// ------------------------------------------- 2. xoá app demo carbon (mặc định)
if (!flags.has("--keep-demo")) {
  console.log("🧹 Xoá app demo carbon…");
  rmSync(path.join(ROOT, "apps/carbon"), { recursive: true, force: true });
  log("xoá apps/carbon/");

  // root package.json: bỏ script dev:carbon
  editFile("package.json", (s) => {
    const pkg = JSON.parse(s);
    delete pkg.scripts["dev:carbon"];
    return `${JSON.stringify(pkg, null, 2)}\n`;
  });

  // turbo.json: bỏ SENTRY_PROJECT_CARBON khỏi globalPassThroughEnv
  editFile("turbo.json", (s) => {
    const t = JSON.parse(s);
    t.globalPassThroughEnv = (t.globalPassThroughEnv ?? []).filter((k) => !k.includes("_CARBON"));
    return `${JSON.stringify(t, null, 2)}\n`;
  });

  // ci.yml: matrix chỉ còn web + bỏ cp .env carbon
  editFile(".github/workflows/ci.yml", (s) =>
    s
      .replace("app: [web, carbon]", "app: [web]")
      .split("\n")
      .filter((l) => !l.includes("apps/carbon"))
      .join("\n"),
  );

  // deploy.yml: bỏ step "Deploy carbon", block append .env carbon, env *_CARBON
  editFile(".github/workflows/deploy.yml", (s) => {
    let lines = s.split("\n");
    // (a) step "Deploy carbon (Cloudflare Pages)" → đến step kế / EOF
    const stepStart = lines.findIndex((l) => l.includes("- name: Deploy carbon"));
    if (stepStart !== -1) {
      let stepEnd = lines.length;
      for (let i = stepStart + 1; i < lines.length; i++) {
        if (/^ {6}- name:/.test(lines[i])) {
          stepEnd = i;
          break;
        }
      }
      lines.splice(stepStart, stepEnd - stepStart);
    }
    // (b) block `{ ... } >> apps/carbon/.env` trong Prepare env
    const blockEnd = lines.findIndex((l) => l.trim() === "} >> apps/carbon/.env");
    if (blockEnd !== -1) {
      let blockStart = blockEnd;
      while (blockStart > 0 && lines[blockStart].trim() !== "{") blockStart--;
      lines.splice(blockStart, blockEnd - blockStart + 1);
    }
    // (c) dòng lẻ còn nhắc carbon (cp .env, secrets/vars *_CARBON)
    lines = lines.filter((l) => !l.includes("apps/carbon") && !l.includes("_CARBON"));
    // (d) prose header
    return lines
      .join("\n")
      .replace(" / CF_PAGES_PROJECT_CARBON", "")
      .replace('(mặc định "web" / "carbon")', '(mặc định "web")')
      .replace(", SENTRY_PROJECT_CARBON", "")
      .replace("VITE_SENTRY_DSN_WEB /", "VITE_SENTRY_DSN_WEB.")
      .replace("ở cả 2 Pages project", "ở Pages project");
  });

  // comment nhắc carbon trong config web (dòng comment `//` hoặc ` * ` trong block)
  editFile("apps/web/playwright.config.ts", (s) =>
    s
      .split("\n")
      .filter((l) => !(l.includes("apps/carbon") && /^\s*(\/\/|\*)/.test(l)))
      .join("\n"),
  );
  log("gỡ wiring carbon (package.json, turbo.json, ci.yml, deploy.yml)");
}

// ------------------------------------------------------ 3. danh tính dự án mới
console.log("🏷️  Đổi danh tính…");
editFile("package.json", (s) => {
  const pkg = JSON.parse(s);
  pkg.name = `${slug}-fe`;
  return `${JSON.stringify(pkg, null, 2)}\n`;
});
log(`package.json name = "${slug}-fe" (GIỮ nguyên @repo/* — đổi là ripple mọi import)`);

editFile("README.md", (s) => {
  const lines = s.split("\n").filter((l) => !l.includes("actions/workflows"));
  lines[0] = `# ${slug}-fe`;
  return lines.join("\n");
});
log("README.md: tiêu đề mới + gỡ badge CI của repo mẫu");

// ------------------------------------------------------------- 4. sinh .env
const envPath = path.join(ROOT, "apps/web/.env");
if (existsSync(envPath)) {
  console.log("⚠️  apps/web/.env đã tồn tại — KHÔNG ghi đè.");
} else {
  console.log("🔐 Sinh apps/web/.env…");
  let env = readFileSync(path.join(ROOT, "apps/web/.env.example"), "utf8");
  env = env.replace(/^VITE_APP_NAME=.*$/m, `VITE_APP_NAME=${displayName}`);
  writeFileSync(envPath, env);
  log(`VITE_APP_NAME="${displayName}" (đổi brand UI + <title> bằng 1 knob)`);
  log("VITE_API_URL=http://localhost:3000 (đổi khi BE chạy chỗ khác)");
}

// ------------------------------------------------------------- 5. reset git
if (!flags.has("--no-git")) {
  console.log("🌱 Reset git (dự án mới, lịch sử mới)…");
  rmSync(path.join(ROOT, ".git"), { recursive: true, force: true });
  execSync("git init -b main", { cwd: ROOT, stdio: "ignore" });
  log("git init -b main (chưa có remote — xem checklist)");
}

// ------------------------------------------------------------- 6. pnpm install + format
if (!flags.has("--no-install")) {
  console.log("📦 pnpm install…");
  const r = spawnSync("pnpm", ["install"], { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) console.error("⚠️  pnpm install lỗi — chạy lại tay.");
  else {
    // JSON.stringify format khác biome → format lại cho `pnpm validate` xanh.
    console.log("🎨 biome format (chuẩn hoá file đã sửa)…");
    spawnSync("pnpm", ["exec", "biome", "check", "--write", "."], {
      cwd: ROOT,
      stdio: "ignore",
      shell: true,
    });
  }
} else {
  console.log("ℹ️  Nhớ chạy: pnpm install && pnpm exec biome check --write .");
}

// ------------------------------------------------------------- 7. checklist tay
console.log(`
✅ init-project xong. VIỆC TAY còn lại (script KHÔNG tự làm được):

  Git & CI
  □ Tạo repo GitHub mới → git remote add origin <url> → commit đầu + push
  □ Bật Renovate app; cài gitleaks binary mỗi máy dev (docs/HUMAN-TODO.md)
  □ Xem run CI đầu tiên xanh (validate + e2e + secrets-scan)

  Cloudflare Pages (deploy cách B — CI build, wrangler upload)
  □ Tạo Pages project mới + TẮT "Automatic deployments"
  □ GitHub Secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
  □ GitHub Variables: CF_PAGES_PROJECT_WEB, VITE_API_URL (URL BE prod)

  Sentry (tuỳ chọn)
  □ Tạo project Sentry MỚI → secret VITE_SENTRY_DSN_WEB + SENTRY_AUTH_TOKEN,
    vars SENTRY_ORG + SENTRY_PROJECT_WEB

  Brand & bảo mật
  □ apps/web/src/config/site.ts — tagline, nav; apps/web/public/favicon.svg
  □ apps/web/deploy/nginx.conf:46 — đổi connect-src https://api.example.com
    sang origin BE thật (không đổi = fetch/SSE bị CSP chặn khi self-host)

  Ghép với BE (repo BE degit riêng — chạy init-project bên đó)
  □ VITE_API_URL == BE BETTER_AUTH_URL · origin FE ∈ BE TRUSTED_ORIGINS
  □ packages/auth/src/access-control.ts phải MIRROR BE src/lib/access-control.ts

  Dọn nốt tài liệu
  □ CLAUDE.md / docs/GIOI-THIEU.md / .claude/CODE_BASE_MAP.md còn mô tả app carbon
  □ README.md: viết mô tả dự án thật

  Chạy thử:  pnpm dev:web   → http://localhost:5173
  Gate:      pnpm validate && pnpm build (honest) && pnpm test
`);
