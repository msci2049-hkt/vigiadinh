# CLAUDE.md — FE mẫu (React 19 + Vite 8 + TanStack, monorepo Turbo)

> Primer bắt buộc đọc trước mọi task. Bản đồ + luật ở đây; chi tiết sâu nằm ở
> `.claude/rules/` (auto-load) và `.claude/skills/<task>/SKILL.md`.
> **Mọi con số/path trong file này lấy từ code thật trên branch `main`.**
>
> Bản giới thiệu cho **người đọc** (ngôn ngữ · tính năng · điểm lưu ý): [`docs/GIOI-THIEU.md`](docs/GIOI-THIEU.md).

## 0. 4 LUẬT VÀNG (đọc trước — chi tiết ở skill tương ứng)

1. **State = category-first.** Mỗi loại state một công cụ, cấm trộn: **server state → TanStack Query (LUÔN,
   không copy vào Zustand)** · form → RHF+Zod · URL/filter/shareable → search params · UI cục bộ → useState ·
   UI toàn cục → Zustand. Test: "paste link phải ra đúng view" mà lưu Zustand = sai layer. → skill **`state-management`**.
2. **API error envelope nhất quán (contract từ BE) → FE fail-closed.** `apiClient` đã bọc `ApiError`
   (`.status`, `.retryAfterMs`); 401→`/login`, 503→backoff **tự xử** — đừng làm lại. Lỗi kiểm quyền/session =
   coi như **KHÔNG có quyền** (`sessionQueryOptions` catch→null), không render tạm. → skill **`error-handling-fe`**.
3. **Realtime/session là eventual (hệ quả cluster=stateless bên BE).** BE không giữ state RAM ⇒ SSE
   **at-most-once** + cookie-cache revocation window ⇒ FE `onReconnect` phải `invalidateQueries` (refetch-bù),
   KHÔNG giả định event/session tức thời. → skill **`consume-sse`** / `error-handling-fe`.
4. **Đo trước, tối ưu đúng chỗ.** `pnpm build` (honest) là bằng chứng build DUY NHẤT; đo Web Vitals + bundle
   budget trước khi tối ưu; có React Compiler thì **ngừng rải memo tay**. Phân biệt pass thật/skip/fail-env
   (WSL, thiếu `.env`). → skill **`testing-fe`** / `build-safety-cloudflare`.

## 1. TL;DR

Frontend template production-grade: **pnpm + Turbo monorepo**, React 19 + Vite 8 (rolldown),
TanStack Router/Query, Tailwind v4 + shadcn/ui, Better Auth client. Cắm thẳng vào BE mẫu
(`mau-demo-be`) ở `http://localhost:3000`.

Degit về là có sẵn: login / sign-up / **verify email bằng OTP** / **forgot + reset password bằng OTP**,
**admin panel** (users, sessions, settings) + **role-panel registry** mở rộng được, i18n vi/en, dark mode,
SSE consumer, Sentry, **honest build**, lefthook + gitleaks, deploy Cloudflare Pages qua wrangler.

⚠️ Repo có **2 app**: `apps/web` (template thật, dùng cái này) và `apps/carbon` (demo nghiệp vụ nông nghiệp —
xoá khi degit). 5 package dùng chung ở `packages/*`.

## 2. Stack (version chính xác)

| Nhóm | Package | Version | Khai ở |
|---|---|---|---|
| Runtime | Node | `.nvmrc` = **20**, `engines.node >= 20.19.0` | root |
| PM | pnpm | `packageManager: pnpm@9.15.9` | root |
| Monorepo | `turbo` | `^2.10.4` | root |
| UI | `react` / `react-dom` | `^19.2.7` | `apps/web` |
| Build | `vite` | `^8.0.16` (bundler **rolldown 1.0.3**, không phải alias `rolldown-vite`) | `apps/web` |
| Router | `@tanstack/react-router` | `^1.170.16` | `apps/web` |
| Server-state | `@tanstack/react-query` | `^5.101.0` | `apps/web` |
| CSS | `tailwindcss` / `@tailwindcss/vite` | `^4.3.1` | `apps/web` |
| Form | `react-hook-form` + `@hookform/resolvers` | `^7.80.0` + `^5.4.0` | `apps/web` |
| Validate | `zod` | `^4.4.3` | `apps/web` |
| Auth | `better-auth` | `^1.6.20` | `packages/auth` |
| SSE | `@microsoft/fetch-event-source` | `^2.0.1` | `packages/core` |
| Error | `@sentry/react` / `@sentry/vite-plugin` | `^10.64.0` / `^5.3.0` | `apps/web` / preset |
| i18n | `i18next` / `react-i18next` | `^26.3.1` / `^17.0.8` | `apps/web` |
| TS | `typescript` | `^6.0.3` | `apps/web` |
| Test | `vitest` / `@playwright/test` | `^4.1.9` / `^1.61.0` | `apps/web` |
| PWA (update toast) | `vite-plugin-pwa` | `^1.3.0` | `packages/config` (preset) + `apps/web` (types) |
| Lint | `@biomejs/biome` | `^2.5.0` | root |

`zustand` (`^5.0.14`) **chỉ có** ở `apps/carbon` + `packages/ui`; `apps/web` **không** khai zustand
(dùng gián tiếp qua `@repo/ui` theme-store).

## 3. Cấu trúc

```
apps/
  web/      ← TEMPLATE THẬT. src/{app/routes, features, components, lib, config, locales}
            .env (BẮT BUỘC) · vite.config.ts (wrapper mỏng) · e2e/ · instrument.ts (Sentry)
  carbon/   ← demo nông nghiệp (phone-frame, dev-token). Xoá khi degit.
packages/               ← KHÔNG package nào có script build (không compile ra dist/)
  auth/     @repo/auth   JIT (exports → ./src/index.ts). authClient, access-control (mirror BE), PANELS, requireRoles, sessionQueryOptions
  core/     @repo/core   JIT. apiClient (plain fetch), sse (useServerEvents), queryClient, format, hooks
  ui/       @repo/ui     JIT (+ ./components/*, ./lib/*, ./theme.css). shadcn new-york + theme-store
  i18n/     @repo/i18n   JIT. initI18n (i18next)
  config/   @repo/config NGOẠI LỆ — exports là ./vite.preset.mjs + ./tsconfig/*.json, KHÔNG phải .ts
                         (đây chính là lý do honest build tồn tại, xem §6). + scripts/check-boundaries.mjs
scripts/    honest-build.mjs · check-host-loaded.mjs
.claude/    CLAUDE.md(stub) · rules/ · skills/ · hooks/ · ERRORS.md
```

Trong mỗi app: `app/` = tầng compose (router, routes, provider) → `features/<x>/{api,components,hooks,schemas}`
→ dùng chung ở `components/`, `lib/`, `config/`.

## 4. Kiến trúc & pattern

- **Feature-based, phụ thuộc 1 chiều**: `app/` → `features/` → (`components/`, `lib/`, `config/`).
  **Cấm feature A import feature B** (kể cả relative `../../B`); ghép nhiều feature ở tầng `app/`.
  Enforce: `packages/config/scripts/check-boundaries.mjs` (chạy qua script `boundaries` của từng app).
- **Server-state = TanStack Query, KHÔNG bao giờ để trong Zustand.** Zustand chỉ cho global UI state (theme).
  Mỗi feature có key factory + `queryOptions()` trong `<feature>/api/*.ts`; route loader dùng
  `context.queryClient.ensureQueryData(...)`.
  **Reference implementation** (copy pattern từ đây): `features/users-management/api/admin-users-api.ts`
  — key factory, `queryOptions`, **phân trang `{ limit, offset }`**, mutation pessimistic (invalidate sau khi server trả).
- **Gọi BE qua `apiClient`** (`@repo/core`, plain `fetch`, `credentials:'include'`). Không `fetch()` thẳng trong component.
  `rpc.ts` (Hono RPC) là **scaffold** — `AppType = Hono` placeholder, BE không export type → **chưa có type end-to-end**.
- **Route = file** trong `src/app/routes/`. `routeTree.gen.ts` tự sinh, **gitignored, không sửa tay**.
  Plugin `tanstackRouter` phải đứng **trước** `react()` trong vite config.
- **Guard 2 tầng**: `_authenticated/route.tsx` (`beforeLoad` → `ensureQueryData(sessionQueryOptions)` → không có
  session thì redirect `/login?redirect=`) rồi `_authenticated/_admin/route.tsx` (`beforeLoad: requireRoles(["admin"])`
  → `/unauthorized`). ⚠️ **Route guard là UX, không phải security** — BE re-check mọi API call.
- **Package là JIT**: app tự transpile `src/*.ts` của `@repo/{auth,core,ui,i18n}` (không có bước build).
  Nhưng `vite.config.ts` do **Node nạp trực tiếp** (host-loaded), không qua Vite → nó **không** transpile được `.ts`
  cross-package. Vì vậy `@repo/config` phải export `.mjs`/`.json`, không bao giờ `.ts` — xem §6.

## 5. Tính năng có sẵn

| Tính năng | Route / File |
|---|---|
| Login (+ chặn open-redirect `?redirect=`) | `/login` → `features/auth/components/login-form.tsx` |
| Sign-up (**không bao giờ gửi `role`**) | `/sign-up` → `signup-form.tsx` |
| Verify email bằng **OTP 6 số** | `/verify-email?email=` → `verify-email-form.tsx` → `emailOtp.verifyEmail()` |
| Forgot password (OTP) | `/forgot-password` → `emailOtp.requestPasswordReset()` |
| Reset password (OTP) | `/reset-password?email=` → `emailOtp.resetPassword()` |
| 403 page | `/unauthorized` |
| Admin: tổng quan | `/admin` → `_authenticated/_admin/admin/index.tsx` |
| Admin: users (CRUD, setRole, ban, impersonate, revoke) | `/admin/users` → `features/users-management/` |
| Admin: phiên của chính mình | `/admin/sessions` (`authClient.listSessions/revokeSession`) |
| Admin: settings + xem PANELS registry | `/admin/settings` |
| Impersonation banner | `features/auth/components/impersonation-banner.tsx`, mount ở `__root.tsx` |
| SSE consumer | `@repo/core` `useServerEvents` → skill `consume-sse` |
| Sentry | `apps/*/src/instrument.ts` (import **đầu tiên** ở `main.tsx`) |
| i18n vi/en + dark mode | `@repo/i18n`, `@repo/ui` theme-store (localStorage `ui-theme`) |
| **Toast "Có phiên bản mới — Tải lại"** (SW prompt) | `components/update-toast.tsx` (useRegisterSW), mount ở `provider.tsx`; bật qua `pwa: true` trong `vite.config.ts` (chỉ `apps/web`). KHÔNG đổi sang `autoUpdate` — onNeedRefresh sẽ không bắn, user không được báo (D-052) |

**Sentry FE (chính xác)**: chỉ bật khi `import.meta.env.PROD && VITE_SENTRY_DSN`. Init với
`replayIntegration()`; browser tracing gắn **sau** qua `tanstackRouterBrowserTracingIntegration(router)`
trong `provider.tsx` — **không** dùng thêm `browserTracingIntegration()` (double-instrument).
`tracesSampleRate: 0.2`, replay `0.1`/`1.0`, `sendDefaultPii: false`.
`tracePropagationTargets: [/^\//, RegExp("^" + VITE_API_URL)]`. Error boundary = `errorComponent` ở
`__root.tsx` (gọi `Sentry.captureException`), **không** có `<Sentry.ErrorBoundary>`.
Source map: `build.sourcemap: 'hidden'` + upload rồi **xoá `.map`** khỏi `dist` (chỉ khi có `SENTRY_AUTH_TOKEN`).

## 6. Convention BẤT BIẾN

1. **`pnpm build` là lệnh build DUY NHẤT** để verify/deploy (wrapper `scripts/honest-build.mjs`:
   thêm `NODE_OPTIONS=--no-experimental-strip-types` khi Node ≥ 22.6, rồi `turbo run build --force`).
   **`vite build` / `turbo run build` thường KHÔNG được coi là bằng chứng build.**
   *Vì sao*: Bun và Node ≥ 23.6 strip type → nạp được `.ts` cross-package → **xanh giả**; host Node 20/22 sạch
   (Cloudflare CI) đỏ với `ERR_UNKNOWN_FILE_EXTENSION`. `--force` bắt buộc: artifact cache từ lần strip-types
   không được replay làm bằng chứng.
2. **Config host-loaded (`packages/config/vite.preset.mjs`, vitest/playwright preset) chỉ import `.mjs`/`.json`
   cross-package — không bao giờ `.ts`.** Guard tĩnh: `pnpm guard:host-loaded`.
3. **Cấm** thêm script build né wrapper honest; **cấm** bump Node trong CI để "né" lỗi strip-types.
4. **File ≤ 300 dòng, component ≤ 200.** *(quy ước — KHÔNG có gate tự động: không rule Biome, không script, không CI.)*
5. **No `any`, no `@ts-ignore`.** Mọi input/form/search-param validate bằng **Zod**.
6. **Env qua `@/lib/env`** (Zod), prefix `VITE_`. Không hardcode URL, không commit `.env`.
7. **No cross-feature import · no barrel file lớn** (phá tree-shaking).
8. **Server-state không vào Zustand.** Không `invalidateQueries` trong render (→ vòng lặp refetch).
9. **`signUp.email()` KHÔNG BAO GIỜ kèm `role`.** Nâng quyền chỉ qua `authClient.admin.*`.
10. **Access-control phải mirror BE** (§8).
11. `routeTree.gen.ts` không sửa tay. `tanstackRouter` plugin trước `react()`.
12. **No-JWT**: session là cookie Better Auth, `credentials:'include'`. Không lưu token, không silent-refresh.
13. **Ngưỡng validate = của BE** (D-052): schema đọc `useValidationLimits()` (`GET /api/config/validation`), số ≥ 2 hardcode trong file zod bị `check-validation-parity.mjs` chặn. Copy user-facing không chứa `localhost`/`example.com`/`TODO`/tên template — `check-user-copy.mjs` chặn (allowlist theo giá trị kèm reason).

Gate: `pnpm validate` = `check-host-loaded` + `check-validation-parity` + `check-user-copy` + `biome ci .` + `turbo run validate` (typecheck + boundaries).
`pnpm verify` = `validate` + honest build.

## 7. Chạy dev

```bash
pnpm install
cp apps/web/.env.example    apps/web/.env       # BẮT BUỘC
cp apps/carbon/.env.example apps/carbon/.env    # BẮT BUỘC (nếu còn giữ app carbon)
pnpm dev            # chạy CẢ 2 app (web :5173, carbon :5174)
pnpm dev:web        # chỉ web
pnpm validate && pnpm build   # honest build
pnpm test           # vitest (hermetic, không cần .env)
pnpm test:e2e       # playwright (CẦN .env — xem dưới)
```

🔴 **Thiếu `apps/<app>/.env` = trang trắng.** `src/lib/env.ts` chạy `loadEnv()` lúc **import module** và `throw`
nếu thiếu `VITE_API_URL`. `instrument.ts` (import đầu tiên) đã import `env` → throw trước khi React mount →
`#root` rỗng. Triệu chứng: **mọi e2e báo "element not found"**, không thấy lỗi env nào (BUG-007).
Unit test vẫn xanh vì `vite.config.ts` inject `test.env.VITE_API_URL`.

Biến `VITE_*`: **bắt buộc** `VITE_API_URL` (url). Có default: `VITE_APP_NAME` (`"Mau Demo FE"`),
`VITE_ENABLE_DEVTOOLS` (`"true"`). Optional: `VITE_SENTRY_DSN` (trống = Sentry tắt).

⚠️ Muốn login/SSE chạy thật: BE phải có origin FE trong `TRUSTED_ORIGINS`.
`.env.example` của BE mặc định đã có `http://localhost:5173,http://localhost:5174` —
đổi port/origin FE thì phải sửa theo bên BE.

## 8. Mở rộng & contract BE↔FE

**Thêm gì → skill nào**: feature → `new-feature` · route → `new-route` · guard → `protect-route` ·
component shadcn → `new-component` · form → `new-form` · gọi API → `connect-api` · SSE → `consume-sse` ·
global UI state → `add-store` · ngôn ngữ → `add-i18n` · Sentry → `sentry-frontend` ·
build/deploy Cloudflare → `build-safety-cloudflare`.

**Thêm panel cho role mới — 3 bước cơ học** (`docs/ADD-NEW-PANEL.md`, đọc kèm cảnh báo dưới):
1. `packages/auth/src/access-control.ts`: thêm role bằng `ac.newRole({...})` — **và thêm y hệt vào
   `src/lib/access-control.ts` của repo BE (`mau-demo-be`)**. Đây là thay đổi **2 repo**; nếu chỉ được phép
   sửa FE thì **dừng và hỏi user**, vì role không có bên BE = server từ chối mọi thao tác.
2. `packages/auth/src/panels.ts`: thêm 1 object vào `PANELS` (`{key, roles, basePath, labelKey, nav[]}`).
3. Copy route group `apps/web/src/app/routes/_authenticated/_admin/` → `_<role>/`, đổi `requireRoles([...])` + pages.
   Nhớ thêm i18n key `panels.<role>.*` vào `apps/web/src/locales/{vi,en}/common.json`.

⚠️ `docs/ADD-NEW-PANEL.md` **sai ở Bước 1**: nó ví dụ `user: ac.newRole({})`. Code thật dùng
`ac.newRole({ user: [], session: [] })` — object rỗng **phá type variance** của `admin({ roles })` bên BE.

**Contract với `mau-demo-be`** (mô tả này khớp §8 của CLAUDE.md bên BE):

| Mặt | Sự thật |
|---|---|
| Auth | Cookie Better Auth. `createAppAuthClient` set `fetchOptions.credentials:'include'`; `apiClient` và `sse` cũng vậy. `baseURL` = **gốc BE** (`VITE_API_URL`), Better Auth tự thêm `/api/auth`. |
| Plugins client | `adminClient({ ac, roles })` + `emailOTPClient()` — mirror `admin()` + `emailOTP()` bên BE. |
| Access control | **Phần khai báo** (`statement`/`ac`/`roles`/`AppRole`) ở `packages/auth/src/access-control.ts` **phải giống hệt** BE `src/lib/access-control.ts`. Hiện **khớp 100%** (copy tay; chỉ khác comment). Chỉ có 2 role: `admin`, `user`. |
| CORS/CSRF | BE `TRUSTED_ORIGINS` phải chứa origin FE (nuôi cả `cors`, `csrf`, `trustedOrigins`). Thiếu = cookie không được set. |
| Realtime | `GET ${VITE_API_URL}/api/events`, auth bằng cookie (dùng `@microsoft/fetch-event-source`, **không** `EventSource` — native không gửi cookie). Kênh `sse:user:{id}`, heartbeat `ping` ~20s. **At-most-once** → `onReconnect` phải `invalidateQueries` (refetch bù). Fatal 401/403 → abort + đá `/login`. |
| API | Plain fetch qua `apiClient`. `rpc.ts` = scaffold. |
| Lỗi | **401** → `apiClient` xoá session cache + `router.navigate('/login')`. **503** → backoff theo `Retry-After` (tối đa 2 lần). `ApiError` có `.status`, `.retryAfterMs`. |
| Sentry | DSN tách: FE `VITE_SENTRY_DSN`, BE `SENTRY_DSN`. Trace nối được vì BE `cors.allowHeaders` có `sentry-trace` + `baggage`. |
| Env phải khớp | FE `VITE_API_URL` == BE `BETTER_AUTH_URL` · origin FE ∈ BE `TRUSTED_ORIGINS` |
| Validation limits | Ngưỡng validate (password min/max, OTP length) KHÔNG hardcode ở FE — fetch **`GET /api/config/validation`** lúc boot (`apps/web/src/lib/validation-limits.ts`, prefetch ở `provider.tsx`), schema factory nhận `limits`. Fallback duy nhất: `FALLBACK_LIMITS` (allowlisted). Guard: `scripts/check-validation-parity.mjs` (D-052). |

⚠️ **Version skew**: FE `better-auth ^1.6.20` vs BE `^1.6.23` (cùng dòng 1.6.x). Nâng cấp thì nâng cả hai.

## 9. Skills & rules

**Rules** (`.claude/rules/`, 7 file, auto-load). 6 file dùng frontmatter key `appliesTo:`, `build.md` **không có
frontmatter**. Key Claude Code tài liệu hoá để scope theo path là `paths:` → thực tế **mọi rule đều luôn load**:

| Rule | Bất biến cốt lõi |
|---|---|
| `build.md` | `pnpm build` (honest) là bằng chứng build DUY NHẤT · host-loaded config chỉ `.mjs` · `--force` bắt buộc · Cloudflare KHÔNG build |
| `auth.md` | Cookie session, `credentials:'include'` · guard ở `beforeLoad` · `signUp` không gửi `role` · unauth = 401 |
| `data-fetching.md` | key factory + `queryOptions()` · gọi BE qua `apiClient` · không refetch loop · server-state ≠ Zustand |
| `routing.md` | 1 route = 1 file · `routeTree.gen.ts` không sửa tay · `tanstackRouter` trước `react()` · validateSearch bằng Zod |
| `module-boundary.md` | phụ thuộc 1 chiều · no cross-feature import · no barrel lớn |
| `forms.md` | RHF + `zodResolver` + shadcn Form · 1 schema là nguồn sự thật · lỗi qua `sonner` |
| `styling.md` | Tailwind v4 CSS-first (không `tailwind.config.js`) · token semantic OKLCH · `cn()` · `.dark` trên `<html>` |

🔴 **Rule đã lạc hậu — CODE THẮNG** (rule auto-load nên dễ bị tin nhầm):
- `module-boundary.md` nói enforcer là `scripts/check-boundaries.ts`. **File đó không tồn tại.**
  Thật: `packages/config/scripts/check-boundaries.mjs`, gọi qua script `boundaries` của từng app.
- `auth.md` vẽ guard là `authClient.getSession().catch(...)` inline trong `beforeLoad`. Code đã tiến hoá:
  `_authenticated/route.tsx` dùng `context.queryClient.ensureQueryData(sessionQueryOptions(authClient))`,
  rồi `_admin/route.tsx` dùng `requireRoles([...])`. **Dùng idiom mới** cho route/panel.
- Cả `.claude/rules/*` lẫn skill `commit-push` còn trỏ path thời single-app (`src/features/...`). Đọc như
  path **trong 1 app** (`apps/web/src/...`).

**Skills** (`.claude/skills/`, 20 — đọc `SKILL.md` trước khi code). Hai lớp:

**(a) Decision skills — bản đồ tri thức 2026** (chọn *phương án*):

| Skill | Khi nào dùng (trigger) |
|---|---|
| `state-management` ⭐ | dùng Query hay Zustand, lưu data ở đâu, URL state, re-render nhiều lần |
| `forms-rhf-zod` ⭐ | tạo form, validate, lỗi type zodResolver, "expected a Zod schema", nhập số ra NaN |
| `error-handling-fe` ⭐ | xử lý lỗi API, error boundary, 401/503, fail-closed, SSE mất event |
| `testing-fe` ⭐ | vitest/playwright, test đỏ mà code đúng, worker timeout, mock đăng nhập |
| `styling-tailwind` | Tailwind v4, dark mode, class bị mất/purge, `@source` monorepo |
| `i18n-frontend` | thêm ngôn ngữ, namespace, useTranslation, format theo locale |
| `components-a11y` | shadcn/Radix, dialog/dropdown, a11y, biome a11y, Slot data-slot |

**(b) Task skills — thao tác cơ học** (decision-skill ở trên là "chủ" cho phương án):

`new-feature` `new-route` `new-component` `new-form` `protect-route` `connect-api` `consume-sse` `add-store`
`add-i18n` `sentry-frontend` `build-safety-cloudflare` `supply-chain-guard` `commit-push`.
(Routing: `tanstack-router` **không tách skill riêng** — `new-route` + `.claude/rules/routing.md` đã đủ.)

**Hooks** (`.claude/settings.json`): `post-edit.sh` (biome format file vừa sửa) · `pre-commit-validate.sh`
(chặn `git commit` nếu `pnpm validate` fail) · `session-start.sh`. `permissions.allow` **không** có
`git commit`/`push`/`add` — theo kỷ luật skill `commit-push`.

**Lefthook** (git hooks, khác với hooks của Claude): pre-commit = `guard:host-loaded` + biome + gitleaks;
**pre-push = `pnpm build` honest** (đỏ = chặn push).

## 10. Gotchas đã trả giá

Chi tiết: **`ERRORS.md`** (root — known issues hiện hành: KI-1…5, BUG-006/007, + ghi chú theo phiên) và
**`.claude/ERRORS.md`** (nhật ký bug lịch sử + việc còn nợ). *Hai file khác phạm vi, chồng lấn một phần
(chủ đề thiếu `.env` → e2e đỏ, và e2e fail-env trên WSL, có ở cả hai) — đọc cả hai.*

| # | Chữ ký | Fix |
|---|---|---|
| BUG-007 | Thiếu `apps/<app>/.env` → **trang trắng**, e2e "element not found" hàng loạt, không lỗi env nào hiện ra | `cp apps/<app>/.env.example apps/<app>/.env` rồi xoá `dist/` build lại |
| build-safety | Build **xanh giả** trên Bun/Node ≥ 23.6 vì strip types nạp `.ts` cross-package; Node 20/22 sạch → `ERR_UNKNOWN_FILE_EXTENSION` | `pnpm build` (honest) + `guard:host-loaded` + pre-push |
| BUG-006 | e2e OTP: `[data-slot="input-otp"]` không tồn tại — shadcn `FormControl` (Radix `Slot`) **ghi đè** `data-slot` của child | selector đúng: `input[data-input-otp]` |
| worktree | Chạy e2e trong git **worktree** → toàn bộ timeout: `.env` bị gitignore nên worktree không có | copy `.env` từ repo chính sang worktree |
| open-redirect | `?redirect=//evil.com` ở `/login` | sanitize trong `validateSearch` (chỉ internal path, chặn `//`, `https://`) |
| KI-5 | WSL2 `/mnt/d`: vitest worker timeout >90s, `tsc` >2 phút — **fail-env, không phải lỗi code** | `pnpm exec vitest run --pool=forks`; verify thật ở CI |
| type-safety | `exactOptionalPropertyTypes` chặn `error?: string` khi truyền `string \| undefined` | khai `error?: string \| undefined` |
| RHF+Zod | `z.coerce.number()` lệch input/output type dưới `exactOptionalPropertyTypes` | `z.number()` + `register(name,{valueAsNumber:true})` |
| CSP | `apps/*/deploy/nginx.conf` hardcode `connect-src ... https://api.example.com` | đổi sang origin BE thật, nếu không fetch + SSE bị CSP chặn |
| KI-2 | Playwright webkit/firefox fail-env trên máy dev thiếu system libs | verify thật ở CI (job e2e cài `--with-deps`) |

**Kỷ luật**: phân biệt **pass thật / skip / fail-env**. Skip ≠ pass.

## 11. Deploy (Cloudflare Pages — "cách B", direct upload)

**CI build honest → wrangler đẩy `dist/`. Cloudflare KHÔNG build lại.**

- `.github/workflows/ci.yml`: matrix Node **20 / 22 / 24** (Node 24 chạy với `--no-experimental-strip-types`
  để `.ts` cross-package không bị che) → `check-host-loaded` → `biome ci` → `turbo run validate` →
  `turbo run test` → `turbo run build --force`. Job `e2e` (web + carbon, Node 22, 3 browser).
  Job `supply-chain`: **`pnpm audit --audit-level=high` BLOCKING**. Job `secrets-scan`: gitleaks full-history, BLOCKING.
  *(Không có `continue-on-error` ở bất kỳ step nào trong cả 2 workflow.)*
- `.github/workflows/deploy.yml`: Node từ `.nvmrc` (20) → `pnpm install` → prepare `.env` →
  `check-host-loaded` → **`pnpm build` (honest)** → audit → `npx wrangler@4 pages deploy apps/<app>/dist
  --project-name=... --branch=...`.
  `push main` → production; `pull_request` → preview `<branch>.<project>.pages.dev`.
- **Chưa có secrets → deploy step SKIP, job vẫn XANH** (build + audit đã gác).
- Secrets: `CLOUDFLARE_API_TOKEN` (scope Account → Cloudflare Pages: Edit), `CLOUDFLARE_ACCOUNT_ID`,
  `SENTRY_AUTH_TOKEN`, `VITE_SENTRY_DSN_WEB`, `VITE_SENTRY_DSN_CARBON`.
  Variables: `VITE_API_URL`, `CF_PAGES_PROJECT_WEB`, `CF_PAGES_PROJECT_CARBON`, `SENTRY_ORG`,
  `SENTRY_PROJECT_WEB`, `SENTRY_PROJECT_CARBON`.
- **Việc con người**: tắt "Automatic deployments" trên cả 2 Pages project, nếu không Cloudflare vẫn tự build.
  Xem `docs/HUMAN-TODO.md`.

## 12. Degit sang dự án mới

**Bước 1 — BẮT BUỘC, trước mọi việc khác** (rule `new-project.md` auto-load sẽ nhắc):

```bash
npx degit <template-repo> <ten-du-an>-fe && cd <ten-du-an>-fe
node scripts/init-project.mjs <ten-du-an>     # KHÔNG chạy trên repo mẫu (script tự guard)
```

Script tự làm: xoá `apps/carbon` + wiring (root script `dev:carbon`, turbo `SENTRY_PROJECT_CARBON`,
matrix e2e trong `ci.yml`, step deploy carbon + env `*_CARBON` trong `deploy.yml`) → đổi root name
+ README → sinh `apps/web/.env` (`VITE_APP_NAME` theo tên dự án) → reset git → `pnpm install` →
in checklist việc tay. Cờ: `--keep-demo` · `--no-install` · `--no-git`.

**Bảng CHỖ CẦN THAY** — script làm ✅, người/agent làm ✋:

| Nhóm | Chỗ thay | Ai |
|---|---|---|
| Danh tính | root `package.json` `name` (**GIỮ `@repo/*`** — đổi = ripple mọi import + turbo filter) | ✅ script |
| Danh tính | `VITE_APP_NAME` trong `apps/web/.env` (1 knob = brand UI + `<title>`); `.default(...)` trong `apps/web/src/lib/env.ts` + fallback `e2e/smoke.spec.ts` nếu muốn default mới | ✅ env / ✋ default |
| Danh tính | `apps/web/src/config/site.ts` (tagline, nav) + `public/favicon.svg`; README mô tả; docs còn nhắc carbon | ✋ |
| Secret | `VITE_SENTRY_DSN` (tạo project Sentry MỚI, trống = tắt); GitHub secrets `SENTRY_AUTH_TOKEN`, `VITE_SENTRY_DSN_WEB` | ✋ |
| Hạ tầng | `VITE_API_URL` = URL BE (dev đã đúng localhost:3000; prod qua GitHub Variables) | ✋ khi lên prod |
| Hạ tầng | `apps/web/deploy/nginx.conf:46` — `connect-src https://api.example.com` → origin BE thật (không đổi = fetch/SSE bị CSP chặn); sửa FOUC script thì regenerate hash sha256 | ✋ |
| Hạ tầng | Cloudflare Pages: tạo project + **tắt Automatic deployments**; secrets `CLOUDFLARE_API_TOKEN`/`ACCOUNT_ID`, var `CF_PAGES_PROJECT_WEB` | ✋ |
| Git | `rm -rf .git && git init -b main`; repo GitHub mới + `git remote add` + push | ✅ init / ✋ remote |
| CI/CD | Bật Renovate, cài gitleaks binary, xem run CI đầu xanh | ✋ |
| BE cặp đôi | Repo BE degit riêng + chạy init-project bên đó: `BETTER_AUTH_SECRET` MỚI, `TRUSTED_ORIGINS` ⊇ origin FE, `BETTER_AUTH_URL` == `VITE_API_URL`; **access-control 2 repo mirror** | ✋ |

→ Xong: **auth (login + sign-up + OTP verify + forgot/reset), admin panel + RBAC, role-panel, i18n,
Sentry, honest build, gitleaks chạy sẵn từ ngày 1.** Việc con người còn lại: `docs/HUMAN-TODO.md`.
