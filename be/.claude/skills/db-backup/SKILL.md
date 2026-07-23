---
name: db-backup
description: Setup backup tự động Postgres lên R2/S3. Dùng khi user gõ "backup", "setup backup db".
---

# Backup workflow

1. **Tạo `scripts/backup.ts`** với logic:
   - `pg_dump` database
   - `gzip` output
   - Upload lên R2 (`Bun.S3Client`)
   - Naming: `backup-<env>-<YYYYMMDD-HHmmss>.sql.gz`
   - Retention: giữ **30 ngày**, xoá file cũ hơn

2. **Cron job** (3 option):

   a. **Server-side cron** (production VPS):
      - crontab:
        ```
        0 2 * * * cd /var/www/app && bun scripts/backup.ts >> /var/log/db-backup.log 2>&1
        ```
      - Monitor qua Cronitor.io (skill `setup-monitoring`)

   b. **BullMQ cron** (nếu có worker chạy 24/7):
      - Thêm vào `src/jobs/backup-db/`
      - Pattern: `0 2 * * *` (2h sáng daily)
      - Đọc skill `new-cron` để biết pattern Redlock

   c. **GitHub Actions schedule** (đơn giản nhất):
      - `.github/workflows/db-backup.yml`
      - `schedule: cron '0 2 * * *'`
      - Backup từ external IP (cần expose DB port HOẶC qua SSH tunnel)

3. **Restore script** `scripts/restore.ts`:
   - List backup từ R2
   - User chọn backup
   - Download + gunzip + `psql` restore
   - **CẢNH BÁO** trước khi overwrite DB

4. **Test restore** (quan trọng — backup không test là backup không tồn tại):
   - Hàng tháng test restore vào DB staging
   - Verify data integrity (row count tables chính)

## Cấm

- ❌ Backup lưu cùng VPS với DB — VPS chết là mất sạch.
- ❌ Không có retention → R2 phình dần.
- ❌ Không test restore → ngày cần thì mới biết corrupt.
- ❌ `pg_dump` không có `--no-owner --no-acl` → restore vào DB khác fail vì user owner sai.
