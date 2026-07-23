---
name: build-safety-cloudflare
description: Thiết lập honest build chống "xanh giả" + deploy Cloudflare Pages qua wrangler direct-upload cho monorepo Vite/Turbo. Dùng khi build xanh local nhưng đỏ trên Cloudflare/CI, khi gặp ERR_UNKNOWN_FILE_EXTENSION, khi user nói "build xanh giả", "honest build", "setup deploy Cloudflare", "tắt auto-build Cloudflare", "wrangler pages deploy", "pre-push chặn build", hoặc khi clone template FE sang dự án mới cần dựng lại build-safety. Skill này chứa các bẫy đã trả giá thật: Node ≥23.6 strip types che bug, NODE_OPTIONS crash trên Node 20, Windows cmd không nhận inline env, turbo strict env, lefthook skip khi thiếu stdin.
---

# Build-safety + deploy Cloudflare (cách B)

## Vấn đề gốc — vì sao build "nói dối"

Bun và Node ≥ 23.6 **tự strip TypeScript types**. Config host-loaded (vite
preset, postcss, tailwind — file Node import TRỰC TIẾP, không qua bundler)
mà import một file `.ts` cross-package thì:
- Máy dev (Bun/Node 24): nạp được → build **XANH**.
- Host sạch Node 20/22 (Cloudflare CI): `ERR_UNKNOWN_FILE_EXTENSION` → **ĐỎ**.

Lỗi chỉ lộ SAU khi push. Honest build = ép local hành xử như host khắt khe nhất.

## 3 lớp phòng thủ (đủ cả 3, thiếu 1 là thủng)

1. **Guard tĩnh** `scripts/check-host-loaded.mjs` — scan mọi config host-loaded,
   resolve import qua exports map, fail nếu trỏ tới `.ts` cross-package.
   Độc lập runtime → không Node nào che được. Chạy đầu `validate` + pre-commit.
2. **Honest build là lệnh mặc định**: `"build": "node scripts/honest-build.mjs"`
   — wrapper thêm `--no-experimental-strip-types` vào NODE_OPTIONS rồi chạy
   `turbo run build --force`.
3. **Pre-push lefthook** chạy `pnpm build` — đỏ = chặn push tại máy.

CI giữ matrix Node 20/22 (naturally honest) + 24 (`--no-experimental-strip-types`).

## Vì sao phải là WRAPPER, không phải inline NODE_OPTIONS

- `NODE_OPTIONS=... turbo build` là cú pháp POSIX — **chết trên Windows** (cmd).
  cross-env né được nhưng dính bẫy thứ 2:
- `--no-experimental-strip-types` **không tồn tại trên Node < 22.6** → Node 20
  thấy flag lạ trong NODE_OPTIONS là exit ngay. Node 20/22 vốn không strip
  (naturally honest) nên wrapper chỉ thêm flag khi `major>22 || (22 && minor>=6)`.
- `--force` bắt buộc: artifact xanh cache từ lần build strip-types không được
  replay làm bằng chứng honest.

## Deploy cách B — CI build, Cloudflare chỉ nhận dist/

`wrangler pages deploy <dist> --project-name=X --branch=Y --commit-dirty=true`
(wrangler v4, pin `wrangler@4`). `--branch` = production branch của project →
deploy prod; branch khác → preview `<branch>.<project>.pages.dev`.
Auth CI: env `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages: Edit —
zone-scoped token KHÔNG chạy) + `CLOUDFLARE_ACCOUNT_ID`.
Xem mẫu đầy đủ: `.github/workflows/deploy.yml` (gate build+audit trước deploy,
SKIP an toàn khi chưa có secrets — job vẫn xanh, có notice).

**Việc con người**: dashboard → mỗi Pages project → Builds & deployments →
tắt "Automatic deployments" (prod + preview=None). Chỉ tắt trigger build —
không detach repo. Git-integrated project VẪN nhận wrangler direct upload
(chỉ drag-and-drop bị cấm); chiều ngược lại thì không (Direct-Upload project
không chuyển sang Git integration được — một chiều).

## Gotchas (đã trả giá)

- **Kiểm tra exit code qua pipe là tự lừa**: `cmd | tail; echo $?` trả exit của
  `tail`. Ghi log ra file rồi echo `$?` ngay sau lệnh.
- **Turbo 2 strict env**: env không khai báo bị lọc khỏi task. NODE_OPTIONS
  thực tế VẪN được truyền (đã kiểm chứng bằng sabotage test), nhưng khai vào
  `globalPassThroughEnv` để biome noUndeclaredEnvVars khỏi kêu + rõ ý đồ.
- **Lefthook pre-push chạy theo push-files từ stdin của git**: chạy tay
  `lefthook run pre-push` không có stdin → "no matching push files" → skip.
  Đó KHÔNG phải bug — push thật luôn có range. Muốn test thật: push vào bare
  repo local (`git init --bare /tmp/x.git`). `always_run: true` KHÔNG phải
  option của lefthook v2 (bị parser bỏ im lặng — kiểm bằng `lefthook dump`).
- **Worktree/clone mới trên Windows = CRLF** (autocrlf) → biome đỏ TOÀN BỘ
  repo. Fix gốc: `.gitattributes` với `* text=auto eol=lf`. Fix tại chỗ:
  `biome format --write .` (git normalize → diff thật = 0).
- **pnpm bị pin qua `packageManager`** — máy có pnpm 11 global vẫn phải chạy
  `corepack pnpm ...` để dùng đúng bản pin (lockfile format + engines).
- Verify chuẩn: cố tình thêm export `.ts` vào packages/config + import ở
  vite.config.ts → guard đỏ, plain build XANH (bằng chứng xanh-giả), honest
  build đỏ ERR_UNKNOWN_FILE_EXTENSION, push bị hook chặn. Gỡ sabotage → xanh.

## Checklist áp cho dự án mới (clone template)

1. Có sẵn: honest-build.mjs, check-host-loaded.mjs, lefthook.yml, deploy.yml,
   `.nvmrc`, `.gitattributes` — không phải làm lại.
2. `corepack pnpm install` (prepare tự `lefthook install`). Cài gitleaks binary.
3. Tạo 2 Pages project (hoặc đổi `CF_PAGES_PROJECT_*` vars), thêm secrets
   CLOUDFLARE_*, tắt auto-build trên dashboard.
4. Chạy sabotage test 1 lần để tin hệ thống còn sống.

## Điểm mới 2026 (Vite 8 · Cloudflare Workers · Biome 2)

- **Vite 8 hiện hành** (repo `^8.0.16`, bundler rolldown): nâng **có kiểm soát** — đọc migration guide trước,
  đừng nâng mù. Vite 7+ cần **Node ≥20.19** (pin `.nvmrc`) — Node cũ hơn chết ngay từ `install`.
- **Cloudflare khuyến nghị Workers static assets cho project MỚI** (không phải Pages): `wrangler.jsonc`
  `assets.not_found_handling: "single-page-application"` (SPA fallback) + `run_worker_first: ["/api/*"]` +
  `.assetsignore` (`_headers`/`_redirects` vẫn chạy). **Pages hiện tại của repo này GIỮ NGUYÊN — không cần vội
  migrate** (`wrangler pages deploy` chỉ bị nudge sang `wrangler deploy`).
- **Biome 2 `noFloatingPromises` type-aware KHÔNG cần tsc** → bật để honest-build bắt "quên await" ngay lúc lint
  (mảnh ghép honest build, bắt ~75–85% case). Monorepo nested config: `"extends": ["//"]` per-package.
