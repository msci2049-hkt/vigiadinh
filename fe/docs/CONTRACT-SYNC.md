# CONTRACT-SYNC — hợp đồng BE↔FE (2 repo độc lập, KHÔNG shared package)

> File này tồn tại Y HỆT ở cả hai repo (`stellaer-be/docs/` và `stellar-fe-vite/docs/`).
> Sửa một bên = sửa cả hai.

## 1. Bề mặt hợp đồng

| Mặt | BE (nguồn) | FE (bản mirror) | Gác bằng |
|---|---|---|---|
| Access control (`statement`/`ac`/`roles`/`AppRole`) | `src/lib/access-control.ts` | `packages/auth/src/access-control.ts` | `contract:check` (chạy trong `validate` cả 2 repo → CI fail nếu lệch) |
| Types + zod schema FE cần (error envelope, SSE events, enum trạng thái) | `src/shared-contract/` | copy tay sang FE khi màn hình cần (ghi lại file đích tại đây) | review + mục 3 |
| Ngưỡng validate form | `src/lib/validation-limits.ts` → `GET /api/config/validation` | FE fetch lúc boot (`useValidationLimits`) | `check-validation-parity.mjs` (FE) |
| Env wiring | `BETTER_AUTH_URL` = `http://localhost:3000` · `TRUSTED_ORIGINS` ⊇ origin FE | `VITE_API_URL` = `http://localhost:3000` | thủ công (đổi port = sửa cả hai) |

## 2. contract:check hoạt động thế nào

- Script (`scripts/contract-check.mjs` bên FE, `scripts/contract-check.ts` bên BE) chuẩn hóa
  file access-control của repo mình (bỏ dòng comment `//`, `*`, `/*` và dòng trống, cắt
  trailing space) rồi SHA-256. Hai file chỉ được khác nhau ở comment → cùng MỘT canonical hash.
- So với `canonical-hash` bên dưới. Lệch = exit 1 (chạy trong `validate` nên CI đỏ).

canonical-hash: `7dead00016727b102f17f3f452a8b0a7cc05494d54c5807905688845e24b453e`

(cập nhật 2026-07-20 — contract 2 role: `admin`, `user`)

## 3. LUẬT: thêm/sửa role = sửa CẢ HAI repo, trong CÙNG một đợt

1. Sửa `stellaer-be/src/lib/access-control.ts` và `stellar-fe-vite/packages/auth/src/access-control.ts`
   **giống hệt nhau** (phần khai báo; comment được phép khác).
2. Chạy script lấy hash mới (chạy `contract:check` — nó in hash thực tế khi lệch), cập nhật
   `canonical-hash` trong `docs/CONTRACT-SYNC.md` ở **CẢ HAI** repo.
3. FE: thêm PANELS entry + route group nếu role có panel (docs/ADD-NEW-PANEL.md — lưu ý
   `ac.newRole({ user: [], session: [] })`, KHÔNG `{}`).
4. `bun run validate` (BE) + `pnpm validate` (FE) phải cùng xanh rồi mới commit.

## 4. shared-contract sync log

| File BE | Bản copy FE | Lần sync cuối |
|---|---|---|
| `src/shared-contract/enums.ts` | (chưa copy — FE chưa có màn hình dùng) | — |
| `src/shared-contract/api-envelope.ts` | (chưa copy) | — |
| `src/shared-contract/sse.ts` | (chưa copy) | — |
