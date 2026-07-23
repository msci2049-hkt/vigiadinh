# ERRORS.md — known issues / tradeoffs

> Nợ kỹ thuật & điểm cần biết. Không chặn push; ghi để minh bạch.

## Known issues

### KI-1 — CI chưa xác nhận xanh headless (cần soi trên GitHub Actions)
`gh` CLI có nhưng **chưa auth** trong môi trường dev (không có token) → không `gh run` được.
CI (matrix Node 20/22: validate+test+build; job e2e **3 browser** chromium/firefox/webkit) phải
**mở GitHub Actions xác nhận**. Local đã: `validate`+`test`+`build`+`dev` xanh; E2E xem KI-2.

### KI-2 — E2E firefox/webkit chỉ verify được trên CI (sandbox fail-env)
Máy dev/WSL thiếu system libs của browser (`libnspr4.so`…) và không có `sudo` cho
`playwright install --with-deps` → **không chạy E2E local**. webServer (build+preview) chạy OK;
fail chỉ ở launch browser. Specs dùng locator auto-wait (`toBeVisible`/`toHaveURL`), không
`waitForTimeout`. **Job e2e trên CI là lần xác minh thật firefox/webkit.**

### KI-3 — Build warning `[INEFFECTIVE_DYNAMIC_IMPORT]` cho `common.json` (kỳ vọng)
`common` cố ý **eager** (static import vào entry, chống nháy UI chung) trong khi backend
dynamic-import glob cũng khớp `common.json`. Vite giữ `common` ở entry → đúng ý đồ. Vô hại.

### KI-4 — E2E `auth.spec.ts` phụ thuộc route demo `/dashboard`
Test đăng nhập điều hướng tới `/dashboard` (demo, route bảo vệ duy nhất). Khi **gỡ demo** phải
xoá/trỏ lại `auth.spec.ts` (đã ghi trong README "Gỡ demo"). Khung auth thật thì độc lập demo.

### KI-5 — WSL2 `/mnt/d`: vitest worker + tsc CỰC CHẬM (fail-env, KHÔNG phải lỗi code)
Trên WSL2 mount Windows (`/mnt/d`), `pnpm test` (vitest 4) hay báo `Timeout waiting for worker
to respond` (worker bootstrap >90s) và `pnpm typecheck` (tsc) mất >2 phút — do I/O filesystem
WSL2, KHÔNG phải test/type fail. Workaround: `pnpm exec vitest run --pool=forks` (child process
bền hơn worker thread). Xác minh THẬT ở CI (GitHub Actions, KI-1).

### 2026-07-05d — VERIFY THẬT: validate/test/build/e2e chạy trên máy (không chỉ CI)
- **`pnpm validate`** exit 0. **`pnpm exec vitest run --pool=forks`** → **28 pass / 0 fail** (8 file).
  `--pool=forks` né timeout worker-thread trên WSL2 `/mnt/d` (KI-5). **`pnpm build`** exit 0
  (chỉ warning `common.json` INEFFECTIVE_DYNAMIC_IMPORT — KI-3, vô hại).
- **Playwright** (`pnpm test:e2e`, 3 browser × 5 test = 15): **chromium 5/5 + firefox 5/5 PASS**
  (gồm test admin: tạo xã + gán/gỡ cán bộ). **webkit 5/5 fail-env** — thiếu chuỗi GTK4
  (`libgtk-4`, `libwebkitgtk-6.0`, `libjavascriptcoregtk-6.0`, `libgraphene`, `libnice`, `libva`…),
  máy không sudo. Đã vá được 6 lib rời (libva/libnice/libx264/libGLESv2/libxkbcommon-x11) nhưng
  webkit cần cả stack GTK4 → dừng, ghi fail-env (khớp KI-2). **CI chạy webkit `--with-deps`.**
- **Shape khớp BE**: `MeSummary` (carbonTons/walletBalance/plotsCount/communeId/**officerCommuneId**
  + isOfficer/isAdmin), `AdminCommune` (+officerCount/plotCount/createdAt), `OfficerAssignment`
  (userId/createdAt), `CommuneListItem` — đối chiếu trực tiếp với BE `me/admin/commune` service, khớp.

### 2026-07-05 — Bổ sung vai admin + màn Quản trị + chọn xã khi đăng ký
- **Identity 3 vai** (`carbon-identity-store`): farmer/officer/**admin** — công tắc header cycle;
  token dev `dev:u_admin:admin`. Khớp BE auth pluggable (dev/cdhc-jwt/better-auth).
- **Feature `admin`**: tạo xã + gán/gỡ cán bộ↔xã qua `/api/admin` (route `/admin`, guard
  `me.isAdmin`). Vận hành ĐỘC LẬP CDHC — không SQL tay.
- **Register commune picker**: `register-form` giờ có dropdown chọn xã (GET `/api/communes`) thay
  vì cứng `me.communeId` → nông dân mới (chưa có nương) vẫn đăng ký được.
- **Gotcha Zod+RHF**: `z.coerce.number()` gây lệch input/output type dưới
  `exactOptionalPropertyTypes` → dùng `z.number()` + `register(name,{valueAsNumber:true})`.
- **Gotcha biome a11y**: `<label>` bọc `<Input>` (component, không phải `<input>` native) →
  `noLabelWithoutControl` → thêm `// biome-ignore` (theo pattern register-form Field).

## BUG-006 (2026-07-10) — e2e OTP: `[data-slot="input-otp"]` KHÔNG tồn tại trong DOM
`InputOTP` (packages/ui) truyền `data-slot="input-otp"` xuống `OTPInput`, nhưng khi
bọc trong shadcn `<FormControl>` (Radix `Slot`) thì Slot **ghi đè** `data-slot` của
child thành `"form-control"` → selector đó match 0 element, test treo 30s rồi timeout.
Selector đúng: `input[data-input-otp]` (attribute do chính primitive `input-otp` đặt;
6 ô hiển thị chỉ là `<div data-slot="input-otp-slot">`, input THẬT chỉ có một).

## BUG-007 (2026-07-10) — e2e đỏ hàng loạt khi thiếu `apps/<app>/.env`
`src/lib/env.ts` validate `import.meta.env` lúc import → thiếu `VITE_API_URL` là app
throw ngay khi boot, render error-boundary trắng. Playwright `webServer` build từ
source nên bundle "câm" theo. Triệu chứng: mọi test UI báo "element not found",
KHÔNG có lỗi env nào hiện ra. Trước khi chạy e2e local: `cp apps/<app>/.env.example
apps/<app>/.env` (CI làm sẵn trong ci.yml/deploy.yml). Đây là fail-env, không phải regress.
