---
name: testing-fe
description: Viết & chạy test FE đúng cho repo này — Vitest 4 (jsdom, hermetic) + Testing Library query-by-role, Playwright e2e với auth mock qua page.route. Quan trọng nhất: phân biệt pass thật / skip / fail-env, đặc biệt các bẫy WSL /mnt/d (vitest worker timeout, tsc chậm) và thiếu .env làm e2e đỏ hàng loạt. Dùng khi user gõ "viết test FE", "test component", "vitest", "playwright", "e2e", "test đỏ mà code đúng", "worker timeout", "test-id hay getByRole", "mock đăng nhập trong test", "e2e trang trắng", "test chạy CI khác local". Đọc TRƯỚC khi kết luận "test fail" — nhiều lỗi ở đây là fail-env, không phải regress.
---

# Testing FE: Vitest 4 + Playwright, phân biệt fail-env

> **Kỷ luật số 1**: **pass thật ≠ skip ≠ fail-env**. Nhiều "test đỏ" trên máy dev là môi trường (WSL, thiếu
> `.env`, thiếu system-lib browser), KHÔNG phải code sai. Đừng nới test cho hết đỏ — verify thật ở CI.

## Ground truth (version + config thật)

`vitest ^4.1.9` · `@playwright/test ^1.61.0`. Config: `apps/web` dùng `defineAppConfig` (`@repo/config`
`vite.preset.mjs`, `test: { environment: jsdom }`) + inject `VITE_API_URL` hermetic; `packages/*` có
`vitest.config.ts` riêng (jsdom, globals). E2E: `apps/web/playwright.config.ts` — `webServer` = `pnpm build &&
pnpm preview`, **auth mock per-test qua `page.route`** (không cần BE thật).

## Unit / component (Vitest)

- **Hermetic**: `vite.config` inject `test.env.VITE_API_URL` → unit **không cần `.env`** (chạy sạch ở CI).
  Mẫu: `features/auth/schemas/login-schema.test.ts`, `features/health/components/health-badge.test.tsx`.
- **Query by role** (`getByRole('button', { name })`) > test-id. Test hành vi người dùng, không nội thất DOM.
- Schema i18n test: truyền `t = (k) => k` vào factory (`makeLoginSchema((k) => k)`) — không cần i18next thật.

## E2E (Playwright)

- `webServer` build + preview → chạy trên **bundle thật** (giống prod), không dev server.
- **Auth mock per-test** qua `page.route(...)` chặn `/api/auth/*` → không phụ thuộc BE sống. Route bảo vệ demo
  `/dashboard` (KI-4) — gỡ demo phải trỏ lại `auth.spec.ts`.
- Locator **auto-wait** (`toBeVisible`, `toHaveURL`) — **KHÔNG** `waitForTimeout` (flaky).

## GOTCHAS (đã trả giá thật — đọc trước khi báo "test fail")

- **WSL2 `/mnt/d`: vitest worker timeout >90s + `tsc` >2 phút = FAIL-ENV** (KI-5), do I/O filesystem WSL,
  KHÔNG phải test/type sai. Fix: `pnpm exec vitest run --pool=forks` (child process bền hơn worker thread).
  Verify THẬT ở CI (GitHub Actions).
  - ⚠️ **Vitest 4 đổi API pool**: `singleThread`/`singleFork`/`minWorkers`/`poolOptions` **đã bị xoá** (Tinypool
    gỡ) → config cũ copy sang = fail khó hiểu. Thay bằng `maxWorkers: 1` + `isolate: false`; env
    `VITEST_MAX_WORKERS`. Pool type `'threads'|'forks'|'vmThreads'|'vmForks'` vẫn còn → `--pool=forks` OK.
- **Thiếu `apps/<app>/.env` → e2e "element not found" HÀNG LOẠT** (BUG-007): `lib/env.ts` throw lúc import →
  React không mount → `#root` rỗng → mọi test UI báo không thấy element, **không lỗi env nào hiện ra**. Trước
  e2e local: `cp apps/<app>/.env.example apps/<app>/.env` (CI làm sẵn). Đây là fail-env, KHÔNG regress. Unit
  vẫn xanh (vite.config inject env).
- **input-otp selector** (BUG-006): shadcn `<FormControl>` (Radix `Slot`) **ghi đè `data-slot`** → dùng
  `input[data-input-otp]`, KHÔNG `[data-slot="input-otp"]` (match 0 element → treo 30s → timeout).
- **webkit/firefox fail-env trên máy dev** (KI-2): thiếu system libs browser (`libgtk-4`…), không `sudo` cho
  `playwright install --with-deps` → chỉ chromium chạy local. **Job e2e trên CI (`--with-deps`, 3 browser) là
  lần verify thật.** Skip/không-chạy ≠ pass.
- **Chạy e2e trong git worktree** → `.env` bị gitignore nên worktree KHÔNG có → toàn bộ timeout. Copy `.env`
  từ repo chính sang worktree.
- **CI chưa xác nhận xanh headless** (KI-1): `gh` chưa auth trong dev → phải mở GitHub Actions xem thật. Local
  xanh ≠ CI xanh (nhất là e2e đa-browser).

## Bằng chứng phải phân loại

Khi báo kết quả: ghi rõ **N pass / M skip / K fail-env** + lý do từng loại. Ví dụ mẫu (phiên trước):
`vitest --pool=forks → 28 pass / 0 fail`; `playwright chromium 5/5 + firefox 5/5 PASS, webkit 5/5 fail-env`.

## Cross-reference

`build-safety-cloudflare` (honest build = bằng chứng build; e2e webServer build thật) · `forms-rhf-zod` (test
form) · `error-handling-fe` · `.claude/rules/data-fetching.md`. Bug lịch sử: `ERRORS.md` (root) + `.claude/ERRORS.md`.
