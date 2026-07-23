---
name: update-dependencies
description: Update dependencies an toàn theo nhóm patch/minor/major. Dùng khi user gõ "update deps", "bump version", "update package".
---

# Update dependencies workflow

Mỗi tháng nên chạy 1 lần để giữ deps cập nhật + security patch.

1. **Liệt kê deps cũ**:
   - `bun outdated` — hiển thị bảng `current` / `wanted` / `latest`
   - Phân loại 3 nhóm theo semver

2. **PATCH updates (`0.0.x`)** — safe, làm hết:
   - `bun update` (chỉ update theo semver range trong `package.json`)
   - Chạy `bun run validate` + `bun test`
   - Commit: `chore(deps): patch updates`

3. **MINOR updates (`0.x.0`)** — đọc changelog:
   - Mỗi package: search GitHub release notes
   - Update từng cái: `bun add <pkg>@<version>`
   - Test sau mỗi update
   - Commit từng nhóm liên quan (vd: tất cả `@hono/*` cùng commit)

4. **MAJOR updates (`x.0.0`)** — 1 PR/package:
   - **ĐỌC migration guide**
   - Tạo branch riêng `chore/bump-<pkg>-v<x>`
   - Update + chạy ĐẦY ĐỦ: typecheck + lint + test + curl smoke test
   - Có breaking change → ghi vào `.claude/ERRORS.md`
   - PR riêng, KHÔNG merge với feature

5. **Security audit**:
   - `bun audit` (check known CVE)
   - Fix critical/high ngay
   - Document medium/low trong `ERRORS.md`

6. **Báo cáo**:

   | Package | Old | New | Category | Test |
   |---|---|---|---|---|
   | hono | 4.12.18 | 4.13.0 | minor | ✓ |
   | drizzle-orm | 0.45.2 | 0.46.0 | minor | ✓ |
   | ... | | | | |

## Cấm

- ❌ Update major + feature trong cùng commit/PR.
- ❌ Skip changelog cho minor — đôi khi có breaking ẩn.
- ❌ `bun update --latest` toàn bộ một lần — không kiểm soát được scope.
