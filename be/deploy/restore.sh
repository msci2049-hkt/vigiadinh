#!/usr/bin/env bash
# ============================================================================
# deploy/restore.sh — restore 1 file backup .sql.gz vào DB production.
#
#   bash deploy/restore.sh /var/backups/<proj>/<proj>-YYYYmmdd-HHMMSS.sql.gz
#
# ⚠ GHI ĐÈ dữ liệu hiện tại (pg_dump plain: CREATE bị lỗi nếu object đã tồn tại
#   → restore chuẩn là vào DB SẠCH hoặc chấp nhận đè từng object). Quy trình an
#   toàn: backup bản HIỆN TẠI trước (bash deploy/backup.sh) rồi mới restore.
# ⚠ Định kỳ restore THỬ vào DB tạm để chứng minh backup sống — backup chưa từng
#   restore = không có backup.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:?Cách dùng: bash deploy/restore.sh <file.sql.gz>}"
PROJECT="${COMPOSE_PROJECT:-$(basename "$PWD")}"
ENV_FILE="deploy/.env.production"

[ -f "$FILE" ] || { echo "❌ Không thấy file: $FILE"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "❌ Thiếu $ENV_FILE"; exit 1; }
PGUSER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
PGDB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -1 | cut -d= -f2)"

echo "⚠ SẮP RESTORE '$FILE'"
echo "⚠ vào DB '$PGDB' (project: $PROJECT) — dữ liệu hiện tại có thể bị GHI ĐÈ."
printf "Gõ đúng tên database (%s) để xác nhận: " "$PGDB"
read -r CONFIRM
if [ "$CONFIRM" != "$PGDB" ]; then
  echo "Huỷ — không khớp."
  exit 1
fi

echo "==> Restoring..."
gunzip -c "$FILE" | docker compose -p "$PROJECT" \
  --project-directory deploy \
  --env-file "$ENV_FILE" \
  -f deploy/docker-compose.prod.yml \
  exec -T postgres psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1

echo "✅ Restore xong. Verify: curl /ready + kiểm vài row nghiệp vụ quan trọng."
