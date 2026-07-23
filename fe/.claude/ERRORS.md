# ERRORS.md — Bug log & follow-up đang mở

> Ghi lỗi đã gặp + cách xử lý, và việc còn nợ. Cập nhật khi fix/đóng.

## Đang mở / lưu ý môi trường
- **[env]** Máy dev hiện có app khác (`Đồng Đội`) chiếm cổng **5173** → `pnpm dev` tự nhảy **5174**.
  Máy sạch sẽ bind 5173 như cấu hình. Nếu cần đúng 5173: tắt app kia hoặc đổi `server.port`.
- **[env]** pnpm 10+ cần Node ≥ 22.13; máy đang Node 20.20 → template **pin pnpm 9.15.9**
  (`packageManager`). Lên Node 22+ có thể nâng pnpm.
- **[be][skip-cần-BE]** Các demo cần BE thật để chạy end-to-end: login Better Auth, SSE
  `/api/events`, `/health`, `/api/dashboard/summary`. Chưa có BE → **skip**, không phải fail.
- **[be]** Nhắc bật **CORS allow-credentials + origin = URL FE** ở BE; SSE set cookie + `Last-Event-ID`.
  Thiếu → cookie session/SSE không hoạt động cross-origin.
- **[type-sync]** `src/lib/rpc.ts` đang là scaffold (placeholder `AppType = Hono`). Khi có BE → gắn
  `AppType` thật (xem 3 cách trong file) để có type end-to-end.

## Đang mở / lưu ý môi trường (bổ sung)
- **[e2e][fail-env]** Máy WSL sandbox này **thiếu system libs** cho Chromium (`libnspr4.so`…) và
  **không có sudo** → `pnpm exec playwright test` KHÔNG chạy được tại đây (fail-env, không phải lỗi
  test). Đã verify gián tiếp: preview serve đúng app + /locales không cần BE. CI cài
  `playwright install --with-deps chromium` nên E2E chạy trong CI. Local: `sudo pnpm exec playwright install-deps chromium` rồi `pnpm test:e2e`.
- **[e2e][worktree][fail-env 2026-07-10]** Chạy `playwright test` trong một **git worktree**
  (vd `fe-hardening/`) → **TOÀN BỘ test timeout**, trông y hệt "code hỏng". Thực chất: `.env` bị
  `.gitignore` nên worktree **không** có `apps/web/.env` ⇒ Vite không inline được `VITE_API_URL` ⇒
  `loadEnv()` (`src/lib/env.ts`) throw `Invalid environment variables` ⇒ React không mount ⇒ trang
  trắng ⇒ mọi locator/`toHaveURL` đều timeout (kể cả test guard chỉ kiểm redirect).
  **Cách nhận diện (đừng đoán):** grep `dist/assets` — có chuỗi `VITE_API_URL` và
  `Invalid environment variables`, nhưng **KHÔNG** có phép gán `"VITE_API_URL":"http://…"`.
  **Fix:** `cp <repo-chính>/apps/web/.env <worktree>/apps/web/.env` rồi build lại (xoá `dist/` cũ).
  Verify 2026-07-10: sau khi copy → `e2e/otp.spec.ts` **6/6 pass**, full suite **20/20** (chromium).

## Đã xử lý (tham khảo nhanh)
- **[i18n 2026-06-23]** i18next 26 **bỏ `initImmediate`** khỏi InitOptions → gỡ option đó (resources
  bundle nạp store đồng bộ; test ép `vi` qua `changeLanguage` trong setup).
- **[i18n 2026-06-23]** Tách hết nhãn UI ra i18next (vi/en, 4 ns: common/auth/dashboard/errors),
  type-safe `t()` (augmentation), language switcher, Zod messages qua `makeLoginSchema(t)`. Bundle
  resources từ `public/locales` (chỉ cài 3 dep, không http-backend → tất định cho test/E2E).
- **[e2e 2026-06-23]** Playwright: `playwright.config.ts` (webServer build+preview :4173, locale
  vi-VN), `e2e/{smoke,auth}.spec.ts` (mock `**/api/auth/**`). Vitest exclude `e2e/**`; typecheck e2e
  qua tsconfig.node.
- **[ci 2026-06-23]** `.github/workflows/ci.yml`: matrix Node 20/22, pnpm từ packageManager, cache,
  `cp .env.example .env` (build cần VITE_API_URL), job e2e riêng + upload report khi fail.
- **[hoàn thiện 2026-06-23] A. SSE reconnect bền** — `lib/sse.ts`: `onclose`(server đóng sạch) +
  `onerror` đều reconnect; backoff expo + jitter cap 30s (`nextBackoff`), reset khi open; fatal
  401/403 (`isFatalStatus`) → abort + `notifyUnauthorized()` (đá /login như interceptor), status
  `connecting|open|reconnecting|closed`. Verify hành vi từ source `@microsoft/fetch-event-source`.
- **[hoàn thiện 2026-06-23] B. FOUC dark-mode** — inline `<script>` ở `index.html` set `.dark` trước
  paint; key `THEME_KEY` export 1 nguồn ở `theme-store.ts`. CSP-hashed (xem D).
- **[hoàn thiện 2026-06-23] C. Type-safety** — bật `noUncheckedIndexedAccess` (0 lỗi) **và**
  `exactOptionalPropertyTypes` (2 lỗi, fix sạch: bỏ cast thừa ở `sonner.tsx`; `retryAfterMs?: number |
  undefined` ở `api-client.ts`). Giữ cả 2 ON.
- **[hoàn thiện 2026-06-23] D. nginx + headers + CSP** — `deploy/nginx.conf`: SPA fallback, cache asset,
  security headers, CSP (`script-src` allow inline FOUC qua sha256; `connect-src` cho SSE). Dùng
  `expires` thay `add_header` cho cache để không reset inheritance của security headers.
- **[hoàn thiện 2026-06-23] E. Test** — `api-client.test.ts` (401→handler, 503 backoff Retry-After,
  4xx no-retry, network error, retryAfterMs); `sse.test.ts` (nextBackoff bounds+cap, isFatalStatus,
  hook 1 live-connection + abort cleanup). `vite.config` thêm `test.env.VITE_API_URL` (hermetic). 7→20 test.
- **[audit 2026-06-23]** Boundary checker bỏ lọt import tương đối (`../../auth/x`, `../../app/router`) →
  rewrite `check-boundaries.ts` resolve path tuyệt đối + so containment (bắt cả alias lẫn relative).
- **[audit 2026-06-23]** Open-redirect qua `?redirect=` ở `/login` → sanitize trong `validateSearch`
  (chỉ nhận internal path, chặn `//`, `https://`).
- **[audit 2026-06-23]** `events-feed` mutate `seqRef` trong state updater (impure, double-count ở
  StrictMode) → tăng seq trong handler, updater thuần. Thêm `onOpen` cho SSE (status "open" chính xác).
- **[audit 2026-06-23]** Thiếu error/404 boundary → thêm `errorComponent` + `notFoundComponent` ở
  `__root.tsx` (error.message chỉ hiện ở DEV).
- TS6 báo `baseUrl` deprecated (TS5101) → dùng `paths` không cần `baseUrl`.
- TS2883 (type nội bộ better-auth không "nameable") → bỏ `composite` khỏi tsconfig (dùng `tsc -p`).
- Biome không parse `src/index.css` (directive Tailwind v4) → bật `css.parser.tailwindDirectives`.
- shadcn tạo nhầm thư mục literal `@/` ở root → thêm `paths` vào root `tsconfig.json` rồi move về `src/`.
- shadcn `sonner.tsx` dùng `next-themes` → viết lại theo `@/stores/theme-store`, gỡ `next-themes`.

### [2026-07-05] Carbon FE — lỗi gặp khi build

- **exactOptionalPropertyTypes chặn prop `error?: string`**: truyền `error={errors.x?.message}` (`string|undefined`) vào prop `error?: string` → TS2375. Fix: khai `error?: string | undefined` (cho phép undefined tường minh, giống `ApiError.retryAfterMs`). File: `features/plots/components/register-form.tsx`.
- **biome `noLabelWithoutControl` với custom Input qua children**: `<label>` bọc `{children}` (Input) đúng HTML nhưng biome không nhìn xuyên `{children}` để thấy control → false-positive. Fix: `// biome-ignore lint/a11y/noLabelWithoutControl: control qua children`.
- **Dev auth**: FE gắn `Authorization: dev:<userId>[:role]` qua `setAuthHeader` (api-client) + store `carbon-identity`. BE cần `CARBON_DEV_TOKENS=true` (fail-closed). Thật thì dùng Better Auth cookie (session chung CDHC) — **chờ chủ dự án cấp secret + cookie domain**.
- **Bản đồ**: dùng SVG tự vẽ (không Leaflet) vì tile cần mạng → Playwright build offline chặn; SVG render polygon từ GeoJSON + tô đỏ overlap, khớp mockup.

### [2026-07-05b] Carbon FE — khớp FIX MAJOR-4 (officer↔commune) + e2e webkit fail-env

- **Officer commune từ `me.officerCommuneId`**: BE FIX MAJOR-4 chặn cán bộ thao tác ngoài xã mình. Cán bộ thường KHÔNG có nương → `me.communeId` (từ plot) = null → trang Duyệt không gọi được `/approvals/pending`. BE thêm `me.officerCommuneId` (từ bảng officer_communes). FE: `MeSummary.officerCommuneId?: string|null` + `approve.tsx` dùng `officerCommuneId ?? communeId ?? null` (fallback giữ tương thích mock e2e cũ — mock chỉ có communeId). KHÔNG đổi shape `/approvals/pending` (vẫn `{data:[{plot,checks}]}`, chỉ lọc theo xã). File: `src/lib/carbon-types.ts`, `src/app/routes/approve.tsx`.
- **Playwright webkit fail-ENV (không phải fail test)**: `pnpm test:e2e` → chromium+firefox **8 pass**, webkit **4 fail** vì host WSL thiếu system libs (`libva.so.2`, `libnice.so.10`, `libx264.so`, `libxkbcommon-x11.so.0`…) — `browserType.launch` không mở được webkit. Cần `sudo pnpm exec playwright install-deps` (quyền root). Đây là **fail-env**, KHÔNG phải lỗi code: `pnpm exec playwright test --project=chromium` → **4/4 pass** (gồm test duyệt/overlap officer). validate + test(28) + build đều xanh.

## Mẫu ghi bug mới
```
### [YYYY-MM-DD] <tiêu đề ngắn>
- Triệu chứng:
- Nguyên nhân:
- Fix:
- File liên quan:
```
