---
globs: scripts/init-project.mjs,package.json,.env.example
description: Luật khi degit template sang dự án mới — PHẢI chạy init-project trước, cấm tái dùng secret/port/danh tính của mẫu.
---

# Rule: Dự án mới từ template (degit)

Áp dụng khi repo này là **dự án mới degit từ template** (hoặc khi được nhờ "tạo dự án mới từ mẫu").

## BƯỚC 1 BẮT BUỘC — trước mọi việc khác

```bash
node scripts/init-project.mjs <ten-du-an>
```

Script tự làm: xoá lớp demo carbon (file list + block `[TEMPLATE-DEMO:carbon]`) · đổi
`package.json.name` · sinh `.env` với **BETTER_AUTH_SECRET MỚI** + `COMPOSE_PROJECT_NAME`/
`COOKIE_PREFIX` = slug + **port rảnh** tự dò · reset git · `bun install` + baseline migration
mới · in checklist việc tay. Chi tiết chỗ-cần-thay: bảng ở `CLAUDE.md` §12.

**KHÔNG bao giờ chạy init-project trên repo mẫu** (script tự guard theo remote, nhưng đừng thử).

## BẤT BIẾN cho dự án mới

- **KHÔNG tái dùng `BETTER_AUTH_SECRET` của mẫu hay của dự án khác** — secret trùng nghĩa là
  cookie/session của dự án này verify được ở dự án kia (lỗ hổng thật, không phải lý thuyết).
  Script đã sinh mới; nếu tạo env bằng tay: `openssl rand -base64 32`.
- **KHÔNG hardcode host port / container name** — port qua biến env (`DB_PORT`, `REDIS_PORT`,
  `MAILHOG_*_PORT`, `API_PORT` trong `.env`), tên compose project qua `COMPOSE_PROJECT_NAME`.
  Xem `.claude/rules/docker.md`.
- **`COOKIE_PREFIX` phải là slug dự án** — cookie không phân biệt port, 2 dự án cùng
  localhost sẽ đè session của nhau nếu trùng prefix.
- **Access-control BE↔FE phải mirror**: `src/lib/access-control.ts` (BE) giống hệt
  `packages/auth/src/access-control.ts` (FE). Thêm/sửa role = sửa CẢ HAI repo cùng lúc.
- Sau init: `bun run env:check && bun run validate` phải xanh rồi mới code tiếp.

## Checklist việc TAY (script không làm được — đừng báo "xong" hộ người)

Repo GitHub mới + remote · Renovate + gitleaks binary · RESEND/R2 key thật ·
SENTRY_DSN mới · prod: `deploy/.env.production` + TRUSTED_ORIGINS thật ·
cập nhật CODE_BASE_MAP/GIOI-THIEU/README còn nhắc demo.
