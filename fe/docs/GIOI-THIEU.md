# Giới thiệu FE mẫu — dùng gì, làm được gì, phải cẩn thận chỗ nào

> Tài liệu cho **người đọc**. Bản dành cho Claude Code là [`CLAUDE.md`](../CLAUDE.md) ở root.
> Mọi thông tin dưới đây lấy từ code thật trên branch `main`.

Đây là **frontend mẫu** để degit sang dự án mới, cắm thẳng vào BE mẫu (`mau-demo-be`). Cài xong là
đã có sẵn màn đăng nhập / đăng ký / xác minh email bằng OTP / quên mật khẩu / trang quản trị /
đa ngôn ngữ / dark mode / realtime, cộng với lớp chống "build xanh giả" và quy trình deploy
Cloudflare đã chạy thật.

---

## 1. Dùng ngôn ngữ gì

**Toàn bộ code ứng dụng là TypeScript** (file `.ts` và `.tsx`). Không `any`, không `@ts-ignore`. Bật cả những
cờ nghiêm ngặt mà đa số dự án không bật: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`.

Ngoại lệ: **4 file build/tooling viết bằng JavaScript thuần (`.mjs`)** — `scripts/honest-build.mjs`,
`scripts/check-host-loaded.mjs`, `packages/config/scripts/check-boundaries.mjs`, và
`packages/config/vite.preset.mjs`. File cuối cùng **bắt buộc** phải là `.mjs`, xem mục 3.1.

Chạy trên **Node 20** (ghim trong `.nvmrc`), quản lý package bằng **pnpm 9**.

Các ngôn ngữ / định dạng phụ và **lý do chúng phải là như vậy**:

| Ngôn ngữ | Dùng ở đâu | Vì sao |
|---|---|---|
| TypeScript + JSX | toàn bộ `apps/*/src`, `packages/*/src` | ngôn ngữ chính |
| **JavaScript ESM (`.mjs`)** | `scripts/*.mjs`, `packages/config/vite.preset.mjs` | **bắt buộc** — xem mục 3.1, đây là gốc rễ của "honest build" |
| CSS | `apps/*/src/index.css`, `packages/ui/src/styles/theme.css` | Tailwind v4 theo kiểu **CSS-first**: không có `tailwind.config.js`, token màu khai bằng **OKLCH** ngay trong CSS |
| JSON | `apps/web/src/locales/{vi,en}/*.json` | chuỗi dịch |
| YAML | `.github/workflows/`, `lefthook.yml` | CI + git hook |

**Tiếng Việt hay tiếng Anh?** Comment và tài liệu viết **tiếng Việt**; tên biến/hàm tiếng Anh.
`apps/web` có **song ngữ vi/en** (mặc định tiếng Việt), nhãn đi qua i18next thay vì hardcode.
(`apps/carbon` thì **không** — nó còn nhiều chuỗi tiếng Việt viết thẳng trong JSX.)

### Thư viện chính (version chính xác trong `package.json`)

| Vai trò | Thư viện | Version |
|---|---|---|
| UI | `react` / `react-dom` | `^19.2.7` |
| Build | `vite` (bundler bên trong là **rolldown**) | `^8.0.16` |
| Định tuyến | `@tanstack/react-router` (file-based) | `^1.170.16` |
| Dữ liệu từ server | `@tanstack/react-query` | `^5.101.0` |
| CSS | `tailwindcss` v4 + `shadcn/ui` (style new-york) | `^4.3.1` |
| Form | `react-hook-form` + `zod` | `^7.80.0` + `^4.4.3` |
| Xác thực | `better-auth` (client) | `^1.6.20` |
| Realtime | `@microsoft/fetch-event-source` | `^2.0.1` |
| Theo dõi lỗi | `@sentry/react` | `^10.64.0` |
| Đa ngôn ngữ | `i18next` + `react-i18next` | `^26.3.1` + `^17.0.8` |
| Lint + format | `@biomejs/biome` (**không** ESLint/Prettier) | `^2.5.0` |
| Test | `vitest` + `@playwright/test` | `^4.1.9` + `^1.61.0` |
| TypeScript | `typescript` | `^6.0.3` |

> ⚠️ Hai lệch version cần biết: FE dùng **TypeScript 6**, BE dùng **TypeScript 5.9** — đừng bê
> `tsconfig` qua lại. Và FE dùng `better-auth ^1.6.20` trong khi BE dùng `^1.6.23`; cùng dòng
> `1.6.x` nên chạy được, nhưng **nâng cấp thì phải nâng cả hai repo**.

### Đây là monorepo

```
apps/web/       ← app template thật, dùng cái này
apps/carbon/    ← app demo nghiệp vụ nông nghiệp (xoá khi degit)
packages/auth/  packages/core/  packages/ui/  packages/i18n/  packages/config/
```

Các package **không build ra `dist/`**. App nạp thẳng file `.ts` nguồn của package (gọi là JIT).
Ngoại lệ duy nhất là `packages/config` — nó phải export `.mjs`/`.json`, xem mục 3.1.

---

## 2. Có tính năng gì

### 2.1. Màn hình xác thực (đã đủ bộ)

| Màn | Đường dẫn |
|---|---|
| Đăng nhập | `/login` |
| Đăng ký | `/sign-up` |
| Xác minh email bằng **OTP 6 số** | `/verify-email` |
| Quên mật khẩu (gửi OTP) | `/forgot-password` |
| Đặt lại mật khẩu (nhập OTP) | `/reset-password` |
| Không đủ quyền (403) | `/unauthorized` |

Session là **cookie**, FE không giữ token, không tự refresh. Form đăng ký **không bao giờ gửi
trường `role`** — quyền do server quyết định.

### 2.2. Trang quản trị + hệ thống "panel theo role"

Có sẵn khu `/admin` chỉ cho role `admin`, gồm 4 trang: tổng quan, **quản lý user** (tạo, đổi role,
khoá, **đóng giả user**, thu hồi phiên), **phiên đăng nhập của chính mình**, và cài đặt.

Khi admin đang đóng giả một user khác, một **thanh cảnh báo màu hổ phách** hiện trên toàn app kèm
nút thoát.

Điểm hay: muốn thêm một khu riêng cho role mới (ví dụ `moderator`) thì chỉ cần **3 bước cơ học** —
khai role, thêm 1 object vào danh sách `PANELS`, copy thư mục route. Không phải đụng vào phần lõi.
Hướng dẫn: [`docs/ADD-NEW-PANEL.md`](ADD-NEW-PANEL.md) (đọc kèm cảnh báo ở mục 3.4).

> ⚠️ **Guard ở route chỉ là trải nghiệm người dùng, không phải bảo mật.** Nó chỉ giấu nút và
> chuyển hướng. BE mới là nơi thật sự kiểm tra quyền ở mọi lời gọi API.

### 2.3. Nền tảng có sẵn

- **Gọi API** qua `apiClient` (fetch thường, luôn kèm cookie). Gặp `401` tự đá về `/login`; gặp
  `503` tự chờ theo `Retry-After` rồi thử lại — không spam retry.
- **Realtime**: hook `useServerEvents` nghe SSE từ BE, tự kết nối lại với backoff, và **refetch bù
  dữ liệu** sau khi mất kết nối (vì SSE có thể rơi mất sự kiện).
- **Đa ngôn ngữ** vi/en và **dark mode** (không nháy trắng khi tải trang).
- **Sentry**: bắt lỗi, đo hiệu năng, quay lại phiên (session replay), và source map được upload rồi
  **xoá khỏi thư mục public** — người ngoài không đọc được code gốc.
- **Test**: `vitest` cho unit, `playwright` cho **e2e**. `apps/web` có **20 test e2e / 4 file**
  (smoke, auth, OTP, admin) cộng 2 file unit; `apps/carbon` có 5 e2e + 5 unit. CI chạy e2e trên
  **3 trình duyệt** (chromium, firefox, webkit). E2E **giả lập BE** bằng `page.route`, không cần backend chạy.

### 2.4. Hàng rào chất lượng

- **"Honest build"** — chống build-xanh-giả, xem mục 3.1. Đây là tính năng đặc trưng nhất của template.
- **Lefthook**: trước khi commit chạy lint + quét secret; trước khi push chạy **build thật**.
- **CI** chặn merge nếu: typecheck/lint đỏ, test đỏ, build đỏ, có CVE mức high/critical, hoặc lộ
  secret trong toàn bộ lịch sử git.
- **Deploy Cloudflare Pages** kiểu "direct upload": CI build rồi đẩy thư mục `dist/` lên.
  **Cloudflare không build lại.**

---

## 3. Các điểm lưu ý

### 3.1. "Honest build" — hiểu cái này trước đã

Đây là thứ dễ gây hiểu lầm nhất trong repo, nên nói cho kỹ.

**Vấn đề:** file `vite.config.ts` được **Node nạp trực tiếp**, không đi qua Vite. Mà Bun và Node từ
bản 23.6 trở lên thì *tự động bỏ qua cú pháp TypeScript*. Nghĩa là trên máy bạn, `vite.config.ts`
có thể `import` một file `.ts` từ package khác và **chạy ngon lành**. Nhưng khi lên máy build sạch
chạy Node 20 (đúng là Cloudflare CI), nó chết với `ERR_UNKNOWN_FILE_EXTENSION`.

Build ở máy bạn **xanh**, build trên CI **đỏ**. Đó là "build xanh giả".

**Cách template chặn, 3 lớp:**

1. `pnpm guard:host-loaded` — quét tĩnh, phát hiện config nạp `.ts` xuyên package.
2. `pnpm build` **không phải** `vite build`. Nó chạy `scripts/honest-build.mjs`, tự tắt tính năng
   bỏ-qua-TypeScript của Node rồi mới build, kèm `--force` để không tái dùng cache của lần build "gian lận".
3. Lefthook chặn `git push` nếu honest build đỏ.

**Hệ quả bạn phải nhớ:**

- Chỉ `pnpm build` mới được coi là bằng chứng build. `vite build` hay `turbo run build` **không tính**.
- `packages/config` phải export `.mjs`/`.json`, **không bao giờ `.ts`**.
- Đừng nâng Node trong CI để "né" lỗi này — nâng lên là lỗi bị giấu lại chứ không mất đi.

### 3.2. Thiếu `.env` là trang trắng, không có báo lỗi

`src/lib/env.ts` kiểm tra biến môi trường **ngay lúc import module**, thiếu `VITE_API_URL` là ném lỗi.
Mà nó được import trước cả React. Kết quả: **trang trắng tinh**, `#root` rỗng, và **toàn bộ test e2e
báo "element not found"** — trông y như code hỏng.

```bash
cp apps/web/.env.example    apps/web/.env
cp apps/carbon/.env.example apps/carbon/.env
```

Unit test thì vẫn xanh (nó tự bơm biến), nên đừng lấy `pnpm test` xanh làm bằng chứng.

Đặc biệt: nếu bạn làm việc trong một **git worktree**, file `.env` bị `.gitignore` nên worktree
**không có** — phải copy sang thủ công.

### 3.3. FE không đăng nhập được? Lỗi nằm ở BE

BE đọc biến `TRUSTED_ORIGINS` để cấu hình **cùng lúc** CORS, CSRF và `trustedOrigins` của Better Auth.
`.env.example` của BE mặc định đã chứa origin FE dev (`http://localhost:5173,http://localhost:5174`),
nhưng nếu FE của bạn chạy ở origin khác mà bên BE không cập nhật theo thì cookie không bao giờ
được lưu, đăng nhập/SSE/mọi API đều fail. Sửa bên BE:

```bash
TRUSTED_ORIGINS=<origin FE thật, phân cách bằng dấu phẩy>
```

### 3.4. Tài liệu cũ trong repo nói sai, tin code

- **`docs/ADD-NEW-PANEL.md` sai ở Bước 1.** Nó ví dụ `user: ac.newRole({})`. Object rỗng sẽ **phá
  kiểu dữ liệu** của plugin admin bên BE. Code thật dùng `ac.newRole({ user: [], session: [] })`.
- **`.claude/rules/module-boundary.md`** nói bộ kiểm tra là `scripts/check-boundaries.ts`. File đó
  **không tồn tại**; thật ra là `packages/config/scripts/check-boundaries.mjs`.
- **`.claude/rules/auth.md`** vẽ cách bảo vệ route bằng `getSession()` gọi trực tiếp. Code đã tiến hoá
  sang `ensureQueryData(sessionQueryOptions)` + `requireRoles()`.
- Nhiều rule vẫn viết đường dẫn kiểu `src/features/...` từ thời chưa tách monorepo — hãy đọc là
  `apps/web/src/features/...`.

### 3.5. Luật không được phá

- **Cấm feature này import feature kia.** Cần dùng chung thì đẩy xuống `components/`, `lib/`.
  Muốn ghép nhiều feature thì ghép ở tầng `app/`. Có script chặn tự động.
- **Dữ liệu từ server không được để trong Zustand.** Đó là việc của TanStack Query. Zustand chỉ giữ
  trạng thái giao diện toàn cục (theme).
- **Không `fetch()` thẳng trong component** — đi qua `apiClient`.
- **Mọi input, form, tham số URL phải validate bằng Zod.**
- **`routeTree.gen.ts` là file tự sinh**, không sửa tay.
- Không tạo file `index.ts` re-export hàng loạt (phá tree-shaking).

### 3.6. Bẫy nhỏ đã trả giá

- **`apps/web` không hề khai `zustand`** dù tài liệu cũ ghi vậy — nó chỉ có ở `apps/carbon` và
  `packages/ui`.
- Giới hạn **300 dòng/file, 200 dòng/component** là **quy ước**, không có công cụ nào kiểm tra.
- **`apps/*/deploy/nginx.conf` hardcode `connect-src ... https://api.example.com`** trong CSP.
  Không sửa thì fetch và SSE bị trình duyệt chặn khi lên production.
- Test e2e trên **WSL2 mount ổ Windows (`/mnt/d`)** cực chậm, hay timeout. Đó là lỗi môi trường,
  không phải lỗi code. Xác minh thật ở CI.
- **Nhật ký bug nằm ở 2 file**, khác vai trò: `ERRORS.md` ở root là **danh sách nợ kỹ thuật /
  đánh đổi đã biết** (không chặn push); `.claude/ERRORS.md` là **nhật ký bug đang mở + đã xử lý**.
  Chồng lấn một phần (chủ đề thiếu `.env`), đọc cả hai.

---

## 4. FE ghép với BE thế nào

BE mẫu là repo `mau-demo-be`, mặc định chạy ở `http://localhost:3000`. Bốn thứ **bắt buộc khớp**:

| # | Ràng buộc |
|---|---|
| 1 | FE `VITE_API_URL` **phải bằng** BE `BETTER_AUTH_URL` (cùng là gốc của BE — Better Auth tự thêm `/api/auth`) |
| 2 | Origin của FE **phải nằm trong** BE `TRUSTED_ORIGINS` |
| 3 | **Phần khai báo** (`statement`, `ac`, `roles`, `AppRole`) trong `packages/auth/src/access-control.ts` (FE) và `src/lib/access-control.ts` (BE) phải **giống hệt nhau** — chép tay, không phải package chung. Hiện đang khớp (chỉ khác phần comment) |
| 4 | Thêm role mới = sửa **cả hai repo** |

Giới thiệu phía BE: [`mau-demo-be/docs/GIOI-THIEU.md`](https://github.com/msci2026vn/code-base-mau-be-chuan-cho-cac-du-an/blob/main/docs/GIOI-THIEU.md).

---

## 5. Bắt đầu

```bash
pnpm install
cp apps/web/.env.example    apps/web/.env       # BẮT BUỘC, xem mục 3.2
cp apps/carbon/.env.example apps/carbon/.env

pnpm dev:web        # http://localhost:5173
pnpm validate       # typecheck + lint + kiểm tra ranh giới module
pnpm build          # honest build — cái này mới tính là build
pnpm test           # unit
pnpm test:e2e       # e2e (cần .env)
```

Đi sâu hơn: [`CLAUDE.md`](../CLAUDE.md) (bản đồ + luật) · `.claude/skills/` (quy trình theo từng
loại task) · [`docs/ADD-NEW-PANEL.md`](ADD-NEW-PANEL.md) · [`docs/HUMAN-TODO.md`](HUMAN-TODO.md)
(việc con người phải tự làm: bật secrets, tắt auto-build trên Cloudflare…).
