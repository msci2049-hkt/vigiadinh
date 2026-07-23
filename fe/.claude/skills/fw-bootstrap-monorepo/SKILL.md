---
name: fw-bootstrap-monorepo
description: "Dựng monorepo FamilyWallet từ 2 template mẫu (mau-demo-be Bun/Hono, mau-demo-fe-vite React/Vite): xóa lớp demo carbon, sửa rule sai trong template, wiring BE↔FE, thêm cấu trúc module mới. Dùng skill này khi: khởi tạo dự án mới từ template mẫu, degit, dọn code mẫu, xóa module carbon, xóa apps/carbon, sửa TRUSTED_ORIGINS, reset migration, wiring backend frontend, bootstrap monorepo, bắt đầu dự án FamilyWallet."
---

# FamilyWallet — Bootstrap monorepo từ template

Hai template đã chín, đừng viết lại: `mau-demo-be` (Bun+Hono+Drizzle+BullMQ+Better Auth) và `mau-demo-fe-vite` (React19+Vite+TanStack+Tailwind4). Việc ở đây là **dọn lớp demo và nối dây**, không phải dựng lại nền.

## LUẬT AN TOÀN KHI DỌN
1. **Không xóa mù theo danh sách.** Trước khi xóa bất kỳ module nào, `grep -rn "<ten-module>" src/` — còn chỗ import là dọn tiếp, không xóa để build đỏ.
2. **Xóa theo tầng, từ ngoài vào**: routes → services → jobs → schema → lib. Ngược lại là gãy import liên hoàn.
3. **Sau mỗi nhóm xóa: chạy `bun run validate` (BE) / `pnpm validate` (FE).** Đỏ thì sửa ngay, đừng dồn.
4. **Reset migration là NGOẠI LỆ hợp lệ** ở đây: dự án chưa có dữ liệu thật, nên xóa sạch `drizzle/*.sql` cũ và sinh lại `0000_init` từ schema mới. Luật forward-only chỉ áp dụng SAU khi có production data.

## BE — XÓA (lớp demo "carbon")
- `src/modules/`: `approval` `carbon` `commune` `me` `plot` `plot-document` `pool` `wallet` — và **kiểm tra `admin`**: tài liệu template xếp nó vào nhóm carbon, nhưng API quản trị lõi đi qua plugin Better Auth. Đọc `CLAUDE.md §12` + grep trước khi quyết; giữ nếu nó là admin lõi.
- **GIỮ**: `product` (mẫu Vertical Slice — đọc rồi mới xóa, dùng làm khuôn cho module mới) và `realtime` (SSE, FamilyWallet cần cho trạng thái guardian).
- Jobs: `carbon-estimate`, `chain-anchor`. Lib: `geo` `geo-pg` `overlap-check` `chain` `sentinel` `gpt` `cdhc-jwt` `officer-scope`. Middleware: `carbon-auth.ts` (Bearer JWT từ hệ ngoài — FamilyWallet không dùng).
- `drizzle/postgis.sql` (PostGIS chỉ phục vụ bản đồ nương rẫy) + mọi schema bảng carbon.
- `drizzle/0000_*.sql` … `0006_*.sql` → xóa sạch, sinh lại sau khi có schema mới.
- `docs/TÀI LIỆU HD CODE BE MẪU .md` (lạc hậu), `.claude/ERRORS.md` phần BUG-001…013 và `ERRORS.md` (BUG-014) — **giữ lại bảng "pattern hay gây bug"**, xóa phần bug cụ thể của template.

## BE — SỬA (rule sai tự nạp vào context, sai là nguy hiểm)
- `.claude/rules/auth.md`: đang vẽ `CORS → auth.handler → session`. **SAI** — code thật chèn `secureHeaders → csrf → requestId → logger → hashGuard` vào giữa. Làm theo rule là gỡ mất lớp bảo mật khỏi `/api/auth/*`. Sửa theo code.
- `.claude/rules/db-schema.md`: ví dụ `.references(() => users.id)` — **không có bảng `users`** kiểu đó. Bảng `user` của Better Auth khóa chính `text`, quy ước template là ULID `varchar(26)` → **không ghép FK cứng được**. Sửa thành tham chiếu mềm `varchar("user_id",{length:64})` + index (mẫu: `src/db/schema/plots.ts` — đọc trước khi xóa file này).
- `.env.example`: `TRUSTED_ORIGINS=http://localhost:3000` là **sai** (đó là địa chỉ BE). Đổi thành `http://localhost:5173,http://localhost:5174`. Biến này nuôi cùng lúc CORS + CSRF + trustedOrigins Better Auth — sai là FE không đăng nhập được mà **không có thông báo lỗi rõ ràng**.

## FE — XÓA & SỬA
- Xóa `apps/carbon/` (kèm 5 e2e + 5 unit của nó), `docs/TAI_LIEU_HD_FE_MAU.md` (lạc hậu).
- **GIỮ**: `apps/web` (7 màn auth + admin panel + honest build + apiClient + useServerEvents + i18n + dark mode), toàn bộ `packages/*`.
- Sửa `docs/ADD-NEW-PANEL.md` Bước 1: `ac.newRole({})` object rỗng **phá kiểu** plugin admin bên BE — code thật là `ac.newRole({ user: [], session: [] })`.
- Sửa `.claude/rules/module-boundary.md`: script kiểm tra thật là `packages/config/scripts/check-boundaries.mjs`, không phải `scripts/check-boundaries.ts`.
- Sửa `.claude/rules/auth.md`: đã tiến hóa sang `ensureQueryData(sessionQueryOptions)` + `requireRoles()`, không còn `getSession()` trực tiếp.
- Sửa `apps/*/deploy/nginx.conf`: CSP hardcode `connect-src ... https://api.example.com` → đổi sang domain thật, nếu không fetch/SSE bị chặn trên production.
- Đường dẫn trong các rule cũ kiểu `src/features/...` đọc là `apps/web/src/features/...`.

## WIRING BE↔FE — 4 ràng buộc bắt buộc khớp
1. FE `VITE_API_URL` = BE `BETTER_AUTH_URL` (cùng là gốc BE; Better Auth tự thêm `/api/auth`).
2. Origin FE nằm trong BE `TRUSTED_ORIGINS`.
3. `access-control.ts` hai bên **giống hệt** (`statement`, `ac`, `roles`, `AppRole`) — chép tay, không phải package chung. Lệch = FE cho bấm nút mà server từ chối.
4. Thêm role mới = sửa **cả hai** repo.
Lệch version cố ý, đừng "sửa": BE TypeScript 5.9 / FE TypeScript 6; BE better-auth ^1.6.23 / FE ^1.6.20 (cùng dòng 1.6.x, nâng thì nâng cả hai).

## QUYẾT ĐỊNH KIẾN TRÚC PHẢI CHỐT TRƯỚC KHI DỌN
**Giữ Better Auth email+mật khẩu hay bỏ?** → **GIỮ, nhưng phân vai rõ**: email+password chỉ cho **admin panel nội bộ**; người dùng cuối vào bằng **passkey**. Better Auth quản phiên app (biết user là ai để trả presence/notification), **KHÔNG đụng custody** — ví ký bằng passkey/Stellar, backend sập vẫn ký được. Xóa auth email/password là mất luôn admin panel đang chạy tốt — không đáng.

## THÊM MỚI SAU KHI DỌN
- BE module (khuôn theo `product`): `wallets` `guardians` `presence` `recovery` `inheritance` `indexer` `notifications` `risk`.
- **Cron/repeatable job: template CHƯA CÓ** (`redlock.ts` khai mà không file nào import; 2 job hiện có đều theo sự kiện). Ping 12:00 phải tự dựng — dùng skill `new-cron` của template, tên queue **bắt buộc có `{ngoặc nhọn}`** nếu không Dragonfly dồn hết về 1 luồng.
- **Webhook cũng CHƯA nối dây** (có `verify.ts` + `captureRawBody` nhưng không route nào gọi, không bảng `webhook_events`) — FamilyWallet chưa cần, đừng tưởng có sẵn.
- Push FCM/APNs: template không có, thêm mới.
- `packages/shared`: types + zod schemas dùng chung BE/FE.
- `apps/ai`: service tách riêng, không secret, không quyền ghi.

## NGHIỆM THU BOOTSTRAP
- [ ] `bun run validate` + `bun test` (BE) xanh; `pnpm validate` + `pnpm build` (honest build) xanh
- [ ] `docker compose up -d` (KHÔNG kèm tên service — kèm là thiếu mailhog) → `/health` + `/ready` 200
- [ ] Đăng nhập từ FE thật được (chứng minh TRUSTED_ORIGINS đúng)
- [ ] `grep -rn "carbon\|plot\|commune\|geo" src/ apps/` không còn kết quả nào ngoài lịch sử git
- [ ] Migration mới `0000_init` sinh từ schema sạch, `bun run db:migrate` chạy trên DB trắng
- [ ] SSE `/api/events` vẫn nhận được sự kiện (chưa xóa nhầm realtime)
