# CODE_BASE_MAP.md

> Bản đồ codebase — nạp vào context đầu phiên (hook `session-start`). **Cập nhật sau mỗi feature.**

## Tổng quan
FE mẫu React 19 + Vite 8 (SPA, no SSR), feature-based, cắm thẳng BE Bun + Hono + Better Auth
ở `localhost:3000`. Template phải `pnpm build`/`dev` chạy được **kể cả khi chưa có BE**.

## Phiên bản (đã verify từ registry khi tạo)
React 19.2 · react-dom 19.2 · Vite 8.0 · @vitejs/plugin-react 6 · TypeScript 6 · pnpm 9.15 ·
@tanstack/react-router 1.170 + router-plugin 1.168 + router-cli 1.167 · @tanstack/react-query 5.101 ·
zustand 5 · better-auth 1.6.20 · react-hook-form 7.80 + @hookform/resolvers 5.4 · zod 4.4 ·
@microsoft/fetch-event-source 2 · hono 4.12 · tailwindcss 4.3 + @tailwindcss/vite 4.3 ·
i18next 26.3 + react-i18next 17.0 + i18next-browser-languagedetector 8.2 + i18next-resources-to-backend 1.2 ·
shadcn/ui (new-york) · @biomejs/biome 2.5 · vitest 4.1 + RTL 16 · @playwright/test 1.61.

## Cây thư mục
```
src/
  main.tsx                      entry → AppProvider
  index.css                     Tailwind v4 + tokens OKLCH (@theme inline) + shadcn new-york
  vite-env.d.ts
  app/
    provider.tsx                QueryClientProvider + RouterProvider + Toaster + devtools + theme init + 401 handler
    router.tsx                  createAppRouter, RouterContext = { queryClient }, Register
    routeTree.gen.ts            TỰ SINH (gitignored) — KHÔNG sửa
    routes/
      __root.tsx                layout: header (...) + Outlet + RouterDevtools + errorComponent/notFoundComponent (app-wide fallback)
      index.tsx                 trang chủ (public) — hosts 🧪 DEMO HealthBadge + dashboard CTA (fenced, gỡ được)
      login.tsx                 login (public), search param `redirect` (Zod, sanitized → chỉ internal path, chống open-redirect)
      dashboard.tsx             🧪 DEMO route — PROTECTED (beforeLoad getSession) — compose auth + dashboard
  features/
    auth/      schemas/login-schema · hooks/use-current-user · components/{login-form,user-menu}  [KHUNG]
    health/    🧪 DEMO — api/health-api · hooks/use-health · components/health-badge (xoá được, README "Gỡ demo")
    dashboard/ 🧪 DEMO — api/dashboard-api · hooks/use-dashboard · components/{dashboard-summary-card,events-feed}
  components/
    ui/        shadcn: button input label card badge sonner form
    theme-toggle.tsx
  lib/
    env.ts          validate import.meta.env (Zod) → export `env`
    api-client.ts   fetch wrapper, credentials:'include', ApiError, 401→/login, 503→backoff; notifyUnauthorized() (+ api-client.test.ts)
    auth-client.ts  Better Auth client (createAuthClient), signIn/Up/Out, useSession, getSession
    query-client.ts createQueryClient (defaults: staleTime, no-retry-4xx)
    sse.ts          useServerEvents: reconnect bền (onclose+onerror→backoff jitter cap 30s), fatal 401/403→notifyUnauthorized, status connecting|open|reconnecting|closed; pure nextBackoff/isFatalStatus (+ sse.test.ts)
    rpc.ts          Hono RPC scaffold (placeholder AppType — gắn BE type khi có)
    i18n.ts         i18next init (vi/en, detector) — `common` EAGER (bundled), auth/dashboard/errors LAZY per-ns chunk qua resourcesToBackend(import src/locales/{lng}/{ns}.json) + default i18n
    utils.ts        cn()
  components/  ui/ + theme-toggle + language-switcher (vi⇄en)
  stores/      theme-store.ts (zustand persist + useThemeInit; export THEME_KEY="ui-theme" generic — khớp inline FOUC ở index.html)
  config/      site.ts (name=env.VITE_APP_NAME · description · defaultLocale→i18n fallbackLng · nav[labelKey]) — 1 nguồn danh tính
  types/       i18next.d.ts (type-safe t(): resources/defaultNS từ vi)
  test/        setup.ts (jest-dom/vitest + ép i18n vi + preload mọi ns cho test tất định)
src/locales/{vi,en}/{common,auth,dashboard,errors}.json   bản dịch (nguồn dịch; lazy code-split per-ns, không còn serve tĩnh /locales)
scripts/check-boundaries.ts     chặn cross-feature import — resolve path tuyệt đối (bắt alias + relative)
deploy/nginx.conf               serve SPA + security headers + CSP (script-src sha256 cho inline FOUC; connect-src cho SSE) — tầng host
index.html                      <title>%VITE_APP_NAME%</title> (Vite env) + inline FOUC script (key "ui-theme", set .dark trước paint, CSP-hashed)
ERRORS.md                       known issues / tradeoffs (CI headless, E2E fail-env sandbox…)
playwright.config.ts + e2e/     E2E (webServer build+preview, locale vi-VN, mock auth — KHÔNG cần BE) — 3 browser: chromium/firefox/webkit
.github/workflows/ci.yml        CI: validate+test+build (Node 20/22) → e2e (playwright --with-deps chromium firefox webkit, 3 browser)
```

## Demo kết nối BE (§10)
- Login (Better Auth) · 1 protected route `/dashboard` (chưa auth → `/login`) ·
  SSE consumer (`EventsFeed`) + refetch-bù · Health badge (`/health`).

## Carbon mini-app (app nông dân) — thêm 2026-07-05

Mobile-first, 4 tab (khớp mockup). Auth dev qua header `Authorization: dev:<userId>[:role]`
(store `carbon-identity`), thật thì dùng Better Auth cookie. Bản đồ = SVG (offline, Playwright-safe).

| Nhóm | File | Mục đích |
|---|---|---|
| Chrome | `src/components/{carbon-header,carbon-tab-bar,status-block}.tsx`, `src/config/carbon-nav.ts` | Header (back + công tắc Nông dân/Cán bộ), 4 tab, meta route. |
| Identity | `src/stores/carbon-identity-store.ts` | Zustand dev identity (farmer/officer) → sync `setAuthHeader`. |
| Lib | `src/lib/{carbon-types,format}.ts` (+`format.test`), `api-client.ts` (`setAuthHeader`) | Kiểu response BE + format VND/tấn. |
| Shell | `src/app/routes/__root.tsx` | Khung điện thoại + header + tab. |
| home | `features/home/api/home-api.ts`, `components/home-view.tsx` | Tab Tổng quan (me + quỹ xã). |
| plots | `features/plots/{api/plots-api,components/{plots-list,plot-detail,carbon-chart,register-form},schemas/register-schema}.ts(x)` | List / detail / đăng ký (RHF+Zod, bắt buộc upload) / chart EVI. `plots-api.communesListOptions` (GET /api/communes) → **dropdown chọn xã** trong register-form (không còn cứng communeId). |
| commune | `features/commune/{api/commune-api,components/{commune-view,plot-map,approve-list}}.ts(x)` | Quỹ xã + bản đồ SVG cờ overlap + duyệt (khoá nút khi chồng lấn). Trang Duyệt (`approve.tsx`) dùng `me.officerCommuneId` (FIX MAJOR-4) → gọi `/approvals/pending` đúng xã officer. |
| admin | `features/admin/{api/admin-api,schemas/admin-schema,components/{admin-console,create-commune-form,commune-admin-card}}.ts(x)` | **[admin]** Tạo xã + gán/gỡ cán bộ↔xã qua API (KHÔNG SQL tay). `/admin` route, guard `me.isAdmin`. HomeView hiện CTA khi admin. |
| wallet | `features/wallet/{api/wallet-api,components/wallet-view}.ts(x)` | Số dư + rút + lịch sử on-chain. |
| Identity | `stores/carbon-identity-store.ts`, `components/carbon-header.tsx` | Dev identity **3 vai** (farmer/officer/admin) — công tắc header cycle; token `dev:u_admin:admin`. |
| Routes | `src/app/routes/{index,plots,plot.$id,register,commune,map,approve,wallet,admin}.tsx` | 4 tab + 5 màn drill (thêm `/admin`), compose feature (tầng app). |
| E2E | `e2e/carbon.spec.ts` | 4 tab nav · register chặn thiếu upload · map cờ overlap · khoá nút Duyệt · **admin tạo xã+gán cán bộ**. |

Ghi chú: bỏ demo `routes/dashboard.tsx` + e2e cũ (smoke/auth) → thay bằng carbon. `features/{dashboard,health}`
+ `components/{user-menu,language-switcher,theme-toggle}` giữ lại nhưng không dùng (tree-shaken).

## Quyết định tự quyết (mặc định hợp lý — ghi để minh bạch)
1. **Routes ở `src/app/routes/`** (đúng §4) thay vì mặc định `src/routes` của TanStack → cấu hình
   `tsr.config.json` + plugin theo path này.
2. **`routeTree.gen.ts` gitignored + auto-gen** (`tsr generate` trong `build`/`typecheck`/`dev`)
   thay vì commit file sinh.
3. **pnpm pin 9.15.9**: môi trường Node 20.20; pnpm 10+ cần Node ≥ 22.13. `engines.node ≥ 20.19`.
4. **TS 6**: bỏ `baseUrl` (deprecated), `paths` resolve tương đối tsconfig; bỏ `composite`
   (dùng `tsc -p`, tránh lỗi declaration-portability với type nội bộ better-auth).
5. **Biome 2.5**: bật `css.parser.tailwindDirectives`; `linter.rules.recommended` mặc định true
   nên không khai (tránh deprecation).
6. **sonner** viết lại dùng `@/stores/theme-store` (gỡ `next-themes` shadcn mặc định).
7. **Type-sync**: core độc lập BE (apiClient + Better Auth); Hono RPC là scaffold optional.
8. **Theme**: zustand `theme-store` (light/dark/system) + `.dark` trên `<html>`.

## Lệnh
`pnpm dev` (vite) · `pnpm build` · `pnpm validate` (typecheck+biome+boundaries) · `pnpm test` ·
`pnpm generate:routes`.

## Hardening 2026-07 (feat/core-hardening)

| Khu vực | File | Vai trò |
|---|---|---|
| Honest build | `scripts/honest-build.mjs` (+ `package.json` build/verify/prepare) | `pnpm build` mặc định = honest: tự thêm `--no-experimental-strip-types` (Node ≥22.6) + `turbo build --force`. `pnpm verify` = validate + build. |
| Node pin | `.nvmrc` (20) | CI setup-node + mirror host khắt khe nhất. Local khác version vẫn honest nhờ wrapper. |
| Hooks | `lefthook.yml` | pre-commit: guard-ts + biome staged + gitleaks; pre-push: honest build (đỏ = chặn push). |
| Deploy cách B | `.github/workflows/deploy.yml` | honest build → audit → wrangler@4 pages deploy web+carbon (prod=main, preview=PR); SKIP xanh khi chưa có secrets. |
| Sentry | `apps/*/src/instrument.ts` + `main.tsx` + `app/provider.tsx` (attach router tracing) + `app/routes/__root.tsx` (captureException) + web `use-current-user` (setUser) + carbon `login-form` (setUser) | Chỉ PROD + có `VITE_SENTRY_DSN` (env.ts optional, '' = tắt). |
| Source map | `packages/config/vite.preset.mjs` (+ `.d.mts` sentryProject) | sourcemap hidden CHỈ khi SENTRY_AUTH_TOKEN+project; upload xong xoá. Plugin cuối mảng plugins. |
| Turbo env | `turbo.json` globalPassThroughEnv | NODE_OPTIONS + SENTRY_* (strict env mode). |
| Secrets | `.gitleaks.toml` | default + SePay pattern. |
| CI mở rộng | `.github/workflows/ci.yml` | +job supply-chain (pnpm audit high) + secrets-scan (gitleaks full-history CLI). |
| Supply chain | `renovate.json` | recommended + group monorepos, KHÔNG auto-bump better-auth. |
| EOL | `.gitattributes` | eol=lf — worktree/clone Windows không còn CRLF phá biome. |
| Rule | `.claude/rules/build.md` | luật honest-build bất biến cho agent. |
| Docs | `docs/HARDENING.md`, `docs/HUMAN-TODO.md` | verify + việc con người (Cloudflare/secrets/Sentry/Renovate). |
| Skills | `.claude/skills/{build-safety-cloudflare,sentry-frontend,supply-chain-guard}` | tái dùng cho dự án khác. |

## Email OTP (feat/email-otp-verification, merge 2026-07-10)

| Khu vực | File | Vai trò |
|---|---|---|
| Routes | `apps/web/src/app/routes/{sign-up,verify-email,forgot-password,reset-password}.tsx` | Sign-up → verify-email OTP 6 số (redirect kèm ?email=); forgot → reset qua OTP. Thiếu ?email → redirect về bước trước. |
| Forms | `apps/web/src/features/auth/components/{signup,verify-email,forgot-password,reset-password}-form.tsx` | RHF + Zod (`schemas/{otp,signup}-schema.ts`); OTP input 6 số. |
| UI | `packages/ui/src/components/input-otp.tsx` | shadcn input-otp (dep `input-otp`), export qua packages/ui. |
| Auth client | `packages/auth/src/auth-client.ts` (+`apps/web/src/lib/auth-client.ts`) | thêm `emailOTPClient()` plugin; re-export `emailOtp`. |
| E2E | `apps/web/e2e/otp.spec.ts` | 6 case mocked BA (không cần BE): redirect flow + verify + reset. |
| Lưu ý BE | BA ≥1.6.21: rate-limit chạy TRƯỚC handler → brute-force OTP có thể trả **429** thay vì 403 TOO_MANY_ATTEMPTS — FE xử lý cả hai. | |
