---
name: rollback
description: Rollback production về commit trước. Dùng khi user gõ "rollback", "revert production", "khôi phục bản cũ".
---

# Rollback workflow

ENV: dùng chung với skill `deploy-vps` (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_PM2_NAME`, `DEPLOY_HEALTH_URL`).

Khi user yêu cầu rollback:

1. **SSH vào VPS**: `ssh $DEPLOY_USER@$DEPLOY_HOST`

2. **List commits gần đây**:
   - `cd $DEPLOY_PATH`
   - `git log --oneline -10 --decorate`
   - Hiển thị cho user

3. **Hỏi user**: rollback về commit nào?
   - Default: `HEAD~1` (commit trước đó)
   - User có thể chỉ định SHA cụ thể

4. **CẢNH BÁO nghiêm trọng — hỏi user confirm 2 lần**:
   - "Rollback KHÔNG revert migration đã apply."
   - "Nếu commit mới đã thêm column/bảng, rollback code nhưng DB vẫn có column đó (OK, an toàn)."
   - "Nếu commit mới đã DROP column thì DỮ LIỆU MẤT — không khôi phục được từ rollback code."
   - "Có backup DB trước commit mới không? (skill `db-backup`)"

5. **Execute rollback**:
   - `git reset --hard <target-sha>`
   - `bun install --frozen-lockfile` (trường hợp `package.json` revert)
   - `pm2 restart $DEPLOY_PM2_NAME`

6. **Verify**:
   - `curl -f $DEPLOY_HEALTH_URL` → 200
   - `git log -1 --oneline` — confirm SHA đúng

7. **Báo cáo + ghi vào `.claude/ERRORS.md`**:
   - Entry format:
     ```
     ### [ROLLBACK-YYYYMMDD] Tiêu đề
     - **Từ commit**: <bad-sha> "<message>"
     - **Về commit**: <good-sha> "<message>"
     - **Lý do**: <tả ngắn>
     - **Bài học**: <để lần sau tránh>
     - **Ngày**: YYYY-MM-DD
     - **Tag**: `rollback` / ...
     ```

## Cấm

- ❌ Rollback "êm" mà không cảnh báo về migration.
- ❌ Rollback khi không biết SHA target.
- ❌ Force push commit cũ lên `origin/main` để "đồng bộ" — gây mất commit của người khác.
- ❌ Skip ghi `ERRORS.md` — mỗi rollback là 1 incident học hỏi.
