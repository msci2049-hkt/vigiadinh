---
appliesTo: "scripts/init-project.mjs, package.json, apps/*/.env.example"
---

# Rule: Dự án mới từ template (degit)

Áp dụng khi repo này là **dự án mới degit từ template FE** (hoặc khi được nhờ "tạo dự án mới từ mẫu").

## BƯỚC 1 BẮT BUỘC — trước mọi việc khác

```bash
node scripts/init-project.mjs <ten-du-an>
```

Script tự làm: xoá `apps/carbon` + toàn bộ wiring (root script `dev:carbon`, turbo
`SENTRY_PROJECT_CARBON`, matrix e2e + step deploy carbon trong workflows) · đổi root
package name + README · sinh `apps/web/.env` với `VITE_APP_NAME` mới · reset git ·
`pnpm install` · in checklist việc tay. Chi tiết chỗ-cần-thay: bảng ở `CLAUDE.md` §12.

**KHÔNG bao giờ chạy init-project trên repo mẫu** (script tự guard theo remote, nhưng đừng thử).

## BẤT BIẾN cho dự án mới

- **GIỮ nguyên tên `@repo/*`** của packages — đổi là ripple mọi import + turbo filter.
- **KHÔNG hardcode URL/origin** — BE origin qua `VITE_API_URL` (env), CSP `connect-src`
  trong `apps/web/deploy/nginx.conf` phải đổi sang origin BE thật khi self-host.
- **Access-control FE↔BE phải mirror**: `packages/auth/src/access-control.ts` (FE) giống hệt
  `src/lib/access-control.ts` (BE). Thêm/sửa role = sửa CẢ HAI repo cùng lúc.
- **BE cặp đôi phải có `BETTER_AUTH_SECRET` MỚI** (không tái dùng của mẫu/dự án khác —
  trùng secret là session dự án này verify được ở dự án kia) và `TRUSTED_ORIGINS` chứa
  origin FE. Nhắc user chạy `init-project` bên repo BE.
- Sau init: `pnpm validate && pnpm build` (honest) phải xanh rồi mới code tiếp —
  `vite build`/`turbo run build` thường KHÔNG được tính là bằng chứng.

## Checklist việc TAY (script không làm được — đừng báo "xong" hộ người)

Repo GitHub mới + remote · Cloudflare Pages project + tắt auto-build + secrets/vars ·
Sentry DSN mới · nginx.conf connect-src · site.ts/favicon · Renovate + gitleaks binary ·
cập nhật CLAUDE.md/GIOI-THIEU/CODE_BASE_MAP còn nhắc app carbon.
