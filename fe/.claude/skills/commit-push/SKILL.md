---
name: commit-push
description: Kỷ luật git của dự án — chạy pnpm validate trước, KHÔNG git add ., stage file tường minh, commit message conventional, KHÔNG tự push/commit khi chưa có người duyệt.
---
# Commit & Push (kỷ luật git)

## Khi nào dùng
Khi chuẩn bị lưu thay đổi vào git. Template này CẤM auto-commit/push.

## Các bước
1. Chạy `pnpm validate` (typecheck + `biome ci` + boundaries) — PHẢI exit 0. Lỗi thì sửa trước, không commit.
2. (Khuyến nghị) `pnpm test` cho phần liên quan.
3. Xem thay đổi: `git status` và `git diff` để biết chính xác mình sửa gì.
4. Stage TƯỜNG MINH từng file: `git add <path1> <path2>`. TUYỆT ĐỐI không `git add .` / `git add -A`.
5. Commit dạng conventional: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:` + mô tả ngắn (tiếng Việt được).
6. DỪNG LẠI. KHÔNG push và KHÔNG commit nếu chưa có người xác nhận rõ ràng.

## Ví dụ
```bash
pnpm validate
git status
git add src/features/orders/api/orders-api.ts src/features/orders/hooks/use-orders.ts
git commit -m "feat(orders): them query options va hook danh sach don hang"
# DỪNG — chờ người duyệt mới push
```

## Lưu ý / cạm bẫy
- AI agent KHÔNG được tự ý `git commit`/`git push` khi chưa được yêu cầu — đây là quy ước bắt buộc.
- Không commit file sinh tự động (`src/app/routeTree.gen.ts` đã gitignore) hay `.env`.
- `git add .` dễ kéo nhầm file rác/secret → luôn stage theo đường dẫn.
- Nếu `biome ci` than format → `pnpm format` rồi xem lại diff trước khi add.

## Liên quan
[rules/git.md], skills/new-feature; scripts: `package.json` (validate), `scripts/check-boundaries.ts`
