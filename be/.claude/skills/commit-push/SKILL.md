---
name: commit-push
description: Commit code thay đổi và push lên Git. Dùng khi user gõ "commit", "push", "commit và push", "đẩy code lên git", "save code".
---

# Commit + Push workflow

Khi user yêu cầu commit/push, làm tuần tự:

1. **Verify trạng thái**:
   - `git status` — liệt kê file thay đổi cho user thấy
   - `git diff --stat` — tóm tắt số dòng thêm/xoá

2. **Kiểm tra an toàn — STOP nếu fail**:
   - `.env` KHÔNG được stage: `git status --porcelain | grep -E "\.env$|\.env\.local$"` → phải trống
   - Không có file binary nặng (>5MB): `git status --porcelain | awk '{print $2}' | xargs -I{} sh -c '[ -f "{}" ] && wc -c < "{}"'`
   - Không có file `.pem`, `.key`, `id_rsa*`

3. **Chạy validate**:
   - `bun run validate` (= typecheck + biome check)
   - Fail → STOP, paste error, hỏi user fix

4. **Đề xuất commit message theo Conventional Commits**:
   - Format: `<type>(<scope>): <description>`
   - Types: `feat` / `fix` / `chore` / `docs` / `refactor` / `test` / `perf`
   - Scope: tên module (vd: `products`, `orders`, `auth`)
   - Phân tích diff để gợi ý đúng type
   - Hỏi user confirm hoặc sửa

5. **Add file cụ thể** (KHÔNG `git add .`):
   - List file cần add
   - `git add <file1> <file2> ...`

6. **Commit + push**:
   - `git commit -m "<message>"`
   - `git push` (hoặc `git push -u origin <branch>` nếu lần đầu)

7. **Báo cáo**:
   - Commit hash (short SHA)
   - URL commit trên GitHub: `https://github.com/<owner>/<repo>/commit/<sha>`
   - Số file thay đổi
   - Branch hiện tại

## Cấm

- ❌ `git add .` hoặc `git add -A` (rủi ro stage file lạ).
- ❌ Bypass validate khi fail.
- ❌ Force push lên `main`.
- ❌ Commit `.env`, `.pem`, `.key`, `id_rsa*`.
