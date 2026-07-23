# CONTRACT-SYNC — hợp đồng BE↔FE (monorepo `family-wallet`: git chung, build riêng, KHÔNG shared package)

> File này tồn tại Y HỆT ở cả hai bên (`be/docs/` và `fe/docs/`). Sửa một bên = sửa cả hai.
> Từ PHA 1 (2026-07-23) hai bên nằm chung repo `family-wallet/` nhưng vẫn **build riêng**
> (be = bun, fe = pnpm) và **CẤM import chéo** — cơ chế sync dưới đây vì thế vẫn nguyên giá trị.

## 1. Bề mặt hợp đồng

| Mặt | BE (nguồn) | FE (bản mirror) | Gác bằng |
|---|---|---|---|
| Access control (`statement`/`ac`/`roles`/`AppRole`) | `src/lib/access-control.ts` | `packages/auth/src/access-control.ts` | `contract:check` (chạy trong `validate` cả 2 bên → CI fail nếu lệch) |
| Enum trạng thái + intent state machine | **`shared/` ở root monorepo là NGUỒN** → copy AUTO-SYNC vào `be/src/shared-contract/{contract,intent}.ts` + `fe/packages/core/src/contract/` | (copy do script sinh, ĐỪNG SỬA TAY) | `bun run sync:contract` + `bun run check:contract` (root) |
| Types + zod schema FE cần (error envelope, SSE events) | `src/shared-contract/` (api-envelope, sse) | copy tay sang FE khi màn hình cần (ghi lại file đích tại đây) | review + mục 3 |
| Ngưỡng validate form | `src/lib/validation-limits.ts` → `GET /api/config/validation` | FE fetch lúc boot (`useValidationLimits`) | `check-validation-parity.mjs` (FE) |
| Env wiring | `BETTER_AUTH_URL` = `http://localhost:3000` · `TRUSTED_ORIGINS` ⊇ origin FE | `VITE_API_URL` = `http://localhost:3000` | thủ công (đổi port = sửa cả hai) |

## 2. contract:check hoạt động thế nào

- Script (`scripts/contract-check.ts` bên BE, `scripts/contract-check.mjs` bên FE) chuẩn hóa
  file access-control của bên mình (bỏ dòng comment `//`, `*`, `/*` và dòng trống, cắt
  trailing space) rồi SHA-256. Hai file chỉ được khác nhau ở comment → cùng MỘT canonical hash.
- So với `canonical-hash` bên dưới. Lệch = exit 1 (chạy trong `validate` nên CI đỏ).
- Root `scripts/check-contract.mjs` dùng CÙNG thuật toán chuẩn hóa để gác `shared/` ↔ bản copy.

canonical-hash: `7dead00016727b102f17f3f452a8b0a7cc05494d54c5807905688845e24b453e`

(cập nhật 2026-07-20 — contract 2 role: `admin`, `user`)

## 3. LUẬT: thêm/sửa role = sửa CẢ HAI bên, trong CÙNG một commit

1. Sửa `be/src/lib/access-control.ts` và `fe/packages/auth/src/access-control.ts`
   **giống hệt nhau** (phần khai báo; comment được phép khác).
2. Chạy script lấy hash mới (chạy `contract:check` — nó in hash thực tế khi lệch), cập nhật
   `canonical-hash` trong `docs/CONTRACT-SYNC.md` ở **CẢ HAI** bên.
3. FE: thêm PANELS entry + route group nếu role có panel (docs/ADD-NEW-PANEL.md — lưu ý
   `ac.newRole({ user: [], session: [] })`, KHÔNG `{}`).
4. `bun run validate` (be/) + `pnpm validate` (fe/) phải cùng xanh rồi mới commit.

## 3b. LUẬT: sửa enum trạng thái / intent = sửa Ở ROOT `shared/`

1. Sửa `shared/contract.ts` hoặc `shared/intent.ts` ở root — KHÔNG sửa bản copy.
2. `bun run sync:contract` (root) → sinh lại copy 2 bên → `bun run check:contract` xanh.
3. Đổi giá trị enum đã dùng trong DB = kèm migration CHECK constraint mới (forward-only).
4. Commit cả 3 bản (shared + 2 copy) trong cùng một commit.

## 4. shared-contract sync log

| File BE | Bản copy FE | Lần sync cuối |
|---|---|---|
| `src/shared-contract/contract.ts` (từ root `shared/`) | `packages/core/src/contract/contract.ts` | 2026-07-23 (PHA 1.4) |
| `src/shared-contract/intent.ts` (từ root `shared/`) | `packages/core/src/contract/intent.ts` | 2026-07-23 (PHA 1.4) |
| `src/shared-contract/api-envelope.ts` | (chưa copy — FE chưa có màn hình dùng) | — |
| `src/shared-contract/sse.ts` | (chưa copy) | — |
