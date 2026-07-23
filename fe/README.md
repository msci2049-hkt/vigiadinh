# familywallet-fe — Frontend FamilyWallet

**FamilyWallet**: ví Stellar mà gia đình khôi phục được — social recovery, thừa kế chia %,
theo dõi kết nối người bảo hộ, AI người gác đêm. Sản phẩm toàn cầu: **en mặc định + vi**,
mọi chuỗi qua i18n key. Nền: **Turborepo + React 19 + Vite 8 + TypeScript** (strict),
feature-based, pnpm 9 + Node 20.

| Repo | Ở đâu | Là gì |
|---|---|---|
| **repo này** | `stellar-fe-vite/` | Frontend web (+ Capacitor Android/iOS ở Phase 2) |
| Backend | `../stellaer-be/` | Bun + Hono + Drizzle + Better Auth — `http://localhost:3000` |
| Contract | `../vigiadinh-main/` (tạm) | Soroban recovery-registry testnet — repo riêng, chốt sau |

Hai repo nói chuyện **chỉ qua HTTP** (`VITE_API_URL` == BE `BETTER_AUTH_URL`). Contract BE↔FE:
`docs/CONTRACT-SYNC.md` (gác bằng `pnpm contract:check` trong `validate`). Đọc trước khi code:
`CLAUDE.md` → `docs/PROJECT-BRIEF.md`. Spec UI: `vigiadinh-mockup.html` (41 màn — nhóm két di chúc ĐÃ HỦY).

## 🛡️ Production hardening (đã dựng sẵn)

`pnpm build` = **HONEST build** mặc định (chống xanh-giả strip-types — `scripts/honest-build.mjs`)
· lefthook pre-commit (guard-ts + biome + gitleaks) / pre-push (honest build, đỏ = chặn push)
· deploy cách B: CI build → `wrangler pages deploy` (`.github/workflows/deploy.yml`)
· Sentry 2 app (tracing + Web Vitals + replay + source map hidden, chỉ prod + có DSN)
· Renovate + `pnpm audit` gate · gitleaks full-history trong CI.
Chi tiết + bộ sabotage verify: **`docs/HARDENING.md`** · việc con người còn lại (kích hoạt
Cloudflare/Sentry/Renovate): **`docs/HUMAN-TODO.md`** · skill: `.claude/skills/{build-safety-cloudflare,
sentry-frontend, supply-chain-guard}` · luật bất biến: `.claude/rules/build.md`.

## 🗺️ Monorepo layout

```
familywallet-fe/                  # turbo root (pnpm workspaces)
├── apps/
│   └── web/       # app FamilyWallet: public + auth + PANEL theo role (/admin: users/sessions/settings)
├── packages/
│   ├── config/    # vite preset .MJS + tsconfig chung + scripts (HOST-LOADED — KHÔNG .ts!)
│   ├── core/      # api-client (factory) · query-client · SSE · format · hooks   [JIT .ts]
│   ├── ui/        # shadcn components + theme.css + cn + theme-store             [JIT .ts]
│   ├── auth/      # auth-client (+adminClient) · access-control · guards · PANELS registry
│   └── i18n/      # initI18n (namespace lazy)                                    [JIT .ts]
├── scripts/check-host-loaded.mjs # guard: config host-loaded cấm import .ts cross-package
└── docs/ADD-NEW-PANEL.md         # thêm bảng điều khiển cho role mới = 3 bước
```

- **JIT packages**: `exports` trỏ thẳng `./src/*.ts` — Vite của app transpile, không build step.
- **Role-panel**: một app — nhiều panel theo role qua registry `PANELS`
  (`packages/auth/src/panels.ts`). Thêm panel = 3 bước — xem `docs/ADD-NEW-PANEL.md`.
- **Lằn ranh sống-còn**: file host-loaded (vite/playwright config, preset) chỉ được import
  `.mjs`/`.json` cross-package — guard `pnpm guard:host-loaded` + CI (Node 20/22/24 matrix) chặn.
- Đường dẫn `src/...` trong các mục bên dưới = `apps/web/src/...` (app template).

## 🚀 Dùng làm template (copy là chạy)

Mục tiêu: dự án mới chỉ cần **copy → đổi danh tính → nối BE → chạy**.

**1. Lấy code + init** (không kèm git history của template):
```bash
npx degit msci2026vn/mau-demo-fe-vite my-app && cd my-app
node scripts/init-project.mjs my-app
# git init · pnpm install · in checklist việc tay. Cờ: --keep-demo nếu muốn giữ demo.
```

**2. Chạy:**
```bash
pnpm dev:web        # app web: http://localhost:5173
pnpm validate && pnpm build   # gate + honest build
```

**3. Đổi danh tính** — phần lớn rebrand chỉ cần đổi `VITE_APP_NAME`:

| Đổi gì | Ở đâu | Ghi chú |
|---|---|---|
| **Tên app** (UI brand **+** tab `<title>`) | **`.env`** → `VITE_APP_NAME` | 1 nguồn: chạy vào `site.name` và `<title>` (Vite thay `%VITE_APP_NAME%`) |
| Tagline · locale mặc định | `src/config/site.ts` | `description` · `defaultLocale` (vào i18n `fallbackLng`) |
| Backend URL | `.env` → `VITE_API_URL` | |
| Tên package | `package.json` → `name` | |
| CI badge | dòng badge ở `README.md` | đổi `msci2026vn/mau-demo-fe-vite` → repo của bạn |
| Favicon | `public/favicon.svg` | logo placeholder |

> Theme localStorage key đã generic (`ui-theme`) → **khỏi đổi**. Đổi key thì phải regenerate
> CSP hash (xem mục Deploy).

**4. Nối Backend:** xem mục **Khớp BE** bên dưới.
**5. Thêm tính năng:** dùng `.claude/skills/` — `new-feature`, `new-route`, `protect-route`,
`connect-api`, `consume-sse`, `new-form`, `new-component`, `add-store`, `add-i18n`.
**6. Bỏ phần demo:** xem mục **Gỡ demo** bên dưới.

## Stack
TanStack Router (file-based) · TanStack Query v5 · Zustand v5 · Tailwind v4 (CSS-first, OKLCH) +
shadcn/ui · React Hook Form + Zod · Better Auth client (session cookie) ·
`@microsoft/fetch-event-source` (SSE) · **i18next + react-i18next** (vi/en) · Hono RPC (optional) ·
Biome · Vitest + RTL · **Playwright (E2E)** · **GitHub Actions CI**.

## Yêu cầu
- Node ≥ 20.19 (Vite 8). Dùng Node ≥ 22.13 nếu muốn pnpm 10+.
- pnpm 9 (`packageManager` đã pin 9.15.9).

## Bắt đầu
```bash
pnpm install
cp .env.example .env      # chỉnh VITE_API_URL nếu BE không ở localhost:3000
pnpm dev                  # http://localhost:5173
```

## Lệnh
| Lệnh | Việc |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | `tsr generate` + typecheck + build production |
| `pnpm preview` | Xem bản build |
| `pnpm validate` | **typecheck + biome + boundaries** (phải exit 0) |
| `pnpm test` / `pnpm test:e2e` | Vitest (unit) / Playwright (E2E) |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm generate:routes` | Sinh `src/app/routeTree.gen.ts` |

## i18n (i18next + react-i18next)
- Ngôn ngữ: **vi** (gốc, `fallbackLng`) + **en** (song song đầy đủ). Đổi qua nút ngôn ngữ ở header,
  lưu vào `localStorage` (detector). Khóa `t()` **type-safe** (augmentation từ `vi` resources).
- File dịch: `src/locales/{vi,en}/{common,auth,errors,admin,fw}.json`. Thêm key → sửa **cả vi lẫn en**.
- **Lazy-load theo namespace** (`i18next-resources-to-backend` + dynamic `import()`): chỉ `common`
  (nav/layout/error) **eager** trong entry để không nháy UI chung; `auth`/`errors` (v.v.) tách
  thành **chunk riêng**, chỉ tải khi route cần. `t()` vẫn **type-safe** (augmentation compile-time,
  không ảnh hưởng runtime lazy).

## E2E (Playwright) — chạy KHÔNG cần BE
- `pnpm test:e2e` (hoặc `pnpm exec playwright test`). `playwright.config.ts` tự `build` + `preview`
  (baseURL `http://localhost:4173`), locale `vi-VN`. Auth được **mock** qua `page.route('**/api/auth/**')`.
- Chạy trên **3 browser**: `chromium` · `firefox` · `webkit` (mỗi spec × 3).
- Lần đầu cần cài browser + system libs: `pnpm exec playwright install --with-deps chromium firefox webkit`
  (CI làm tự động; máy WSL/sandbox thiếu lib như `libnspr4` thì cần `sudo` cho bước `--with-deps`).

## CI (GitHub Actions — `.github/workflows/ci.yml`)
- Job `validate-test-build` chạy **matrix Node 20 & 22**: `install --frozen-lockfile` → `validate` →
  `test` → `build`. pnpm lấy từ field `packageManager` (9.15.9). Job `e2e` (sau build) cài
  `--with-deps chromium firefox webkit` rồi chạy Playwright trên **3 browser**; upload report khi fail.

## Cấu trúc
```
src/app/        providers, router, routes (file-based), layout — tầng compose
src/features/   mỗi feature tự chứa (api, components, hooks, schemas) — KHÔNG import chéo
src/components/ ui/ (shadcn) + dùng chung
src/lib/        api-client, auth-client, query-client, rpc, sse, env, utils
src/stores/     global UI state (zustand)
```
Chi tiết: `.claude/CODE_BASE_MAP.md`. Luật code: `.claude/CLAUDE.md` + `.claude/rules/`.

## Gỡ demo — ✅ ĐÃ GỠ 2026-07-23 (PHA 1.5 monorepo family-wallet; mục dưới giữ làm tư liệu template)

Template kèm một demo **nối-BE** (health + dashboard + SSE) để minh hoạ. Phần **khung** (auth
thật, `lib/`, `app/` setup, i18n, `components/ui`) **không hard-import** demo — gỡ trong ~1 phút.
Mọi file demo có marker `🧪 DEMO` ở đầu (`grep -rn "🧪 DEMO" src`).

1. Xoá code demo:
   ```bash
   rm -rf src/features/health src/features/dashboard src/app/routes/dashboard.tsx
   ```
2. `src/app/routes/index.tsx` — xoá import `HealthBadge` + 2 block `{/* 🧪 DEMO … */}` (badge + CTA dashboard).
3. `src/config/site.ts` — xoá entry nav có comment `// 🧪 DEMO` (link `/dashboard`).
4. `e2e/` — `auth.spec.ts` đăng nhập vào `/dashboard` demo: xoá file (hoặc trỏ sang route bảo vệ
   của bạn). Trong `smoke.spec.ts` xoá 2 test đụng demo: *"protected /dashboard…"* và *"health badge…"*.
5. `pnpm validate && pnpm build` → phải xanh.

> Tuỳ chọn: `src/locales/*/dashboard.json` thành **không dùng** (vô hại — lazy, không vào bundle).
> Muốn xoá hẳn thì xoá file đó **và** bỏ `dashboard` khỏi `I18nResources` + import type trong
> `src/lib/i18n.ts`. Cần route bảo vệ mới → xem `.claude/skills/protect-route`.

## Khớp BE (để chạy thật)
- Auth: Better Auth, session **cookie**, `credentials:'include'`. BE bật **CORS allow-credentials +
  origin = URL FE** (vd `http://localhost:5173`) + `trustedOrigins`.
- 401 → đá `/login`; 503 + `Retry-After` → backoff.
- SSE `GET /api/events` (kênh `sse:user:{id}`, at-most-once) → FE reconnect + refetch bù.
- Health `GET /health` → `{"ok":true}`.
- Type-sync: gắn `AppType` của BE vào `src/lib/rpc.ts` (Hono RPC) khi sẵn sàng.

## Deploy (nginx + security headers) — tầng HOST, KHÔNG nằm trong build

Mẫu ở [`deploy/nginx.conf`](deploy/nginx.conf): serve SPA (`try_files … /index.html`),
gzip, cache asset hash dài hạn, chặn dotfiles, `/healthz` cho container, + **security
headers**. CSP/headers là cấu hình **web server/reverse proxy**, không phải Vite build.

Headers đã set: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`
(+ `frame-ancestors 'none'`), `Permissions-Policy` (khoá camera/mic/geo/topics),
`Strict-Transport-Security` (**commented — chỉ bật khi đã có HTTPS**).

**Phải chỉnh khi deploy:**
- **`connect-src`** trong CSP: đổi `https://api.example.com` → đúng origin của
  `VITE_API_URL`. Thiếu/sai → `fetch` và **SSE `/api/events` bị CSP chặn**.
- **CSP cho inline script (chống FOUC):** `index.html` có 1 inline `<script>` set theme
  trước paint. CSP **không** dùng `'unsafe-inline'` cho script — script này được allow-list
  bằng **sha256 hash** trong `deploy/nginx.conf` (`script-src 'sha256-…'`). **Sửa script đó
  thì phải regenerate hash** (build rồi hash đúng nội dung dist):
  ```bash
  pnpm build
  node -e 'const fs=require("fs"),c=require("crypto");const m=fs.readFileSync("dist/index.html","utf8").match(/<script>([\s\S]*?)<\/script>/);console.log("sha256-"+c.createHash("sha256").update(m[1]).digest("base64"))'
  # → dán vào script-src trong deploy/nginx.conf
  ```
- `style-src 'unsafe-inline'`: cần cho inline style attribute (sonner đặt CSS custom props);
  Tailwind v4 xuất CSS ra file ngoài nên stylesheet vẫn là `'self'`.

## Quy ước
File ≤ 300 dòng (component ≤ 200) · no `any`/`@ts-ignore` · validate input bằng Zod · env qua
`@/lib/env` · không cross-feature import · không barrel file lớn · **không tự commit/push**.
