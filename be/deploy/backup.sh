#!/usr/bin/env bash
# ============================================================================
# deploy/backup.sh — pg_dump DB production → gzip → BACKUP_DIR, retention N ngày.
#
# Chạy TRÊN VPS (root repo). Cron mẫu (3h sáng mỗi ngày — xem deploy/README.md):
#   0 3 * * * cd /home/<user>/apps/<proj> && COMPOSE_PROJECT=<proj> bash deploy/backup.sh >> /var/log/<proj>-backup.log 2>&1
#
# Env (đều có default):
#   COMPOSE_PROJECT  — project name compose (default: tên thư mục repo)
#   BACKUP_DIR       — nơi chứa dump (default: /var/backups/<project>)
#   RETENTION_DAYS   — giữ bao nhiêu ngày (default: 7)
#
# `--prune-only`: chỉ xoá dump quá hạn, không dump mới (dùng cho test + cron dọn).
# ⚠ Backup chưa từng restore thử = KHÔNG có backup — xem deploy/restore.sh.
# ⚠ Dump nằm cùng VPS: mất VPS là mất backup → đẩy off-VPS định kỳ (R2, skill db-backup).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${COMPOSE_PROJECT:-$(basename "$PWD")}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/${PROJECT}}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
ENV_FILE="deploy/.env.production"

prune_old() {
  # -mtime +N = cũ hơn N ngày (tròn xuống). Chỉ đụng *.sql.gz — không xoá gì khác.
  find "$BACKUP_DIR" -maxdepth 1 -name '*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -delete
}

if [ "${1:-}" = "--prune-only" ]; then
  [ -d "$BACKUP_DIR" ] || exit 0
  prune_old
  echo "✅ Prune xong (giữ ${RETENTION_DAYS} ngày) — còn $(find "$BACKUP_DIR" -maxdepth 1 -name '*.sql.gz' | wc -l) bản."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Thiếu $ENV_FILE — backup cần biết POSTGRES_USER/DB."
  exit 1
fi
PGUSER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
PGDB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
if [ -z "$PGUSER" ] || [ -z "$PGDB" ]; then
  echo "❌ Không đọc được POSTGRES_USER/POSTGRES_DB từ $ENV_FILE."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/${PROJECT}-${STAMP}.sql.gz"

echo "==> pg_dump ${PGDB} (project: ${PROJECT}) → ${OUT}"
# exec -T: không cấp TTY (bắt buộc khi pipe). Dump chạy TRONG container postgres
# — DB không publish ra host nên không thể pg_dump từ host trực tiếp.
docker compose -p "$PROJECT" \
  --project-directory deploy \
  --env-file "$ENV_FILE" \
  -f deploy/docker-compose.prod.yml \
  exec -T postgres pg_dump -U "$PGUSER" "$PGDB" | gzip > "$OUT"

# Dump rỗng = pg_dump gãy giữa chừng (pipe nuốt exit code) → coi là fail.
if [ ! -s "$OUT" ]; then
  rm -f "$OUT"
  echo "❌ Backup RỖNG — pg_dump fail. Kiểm: docker compose -p $PROJECT ps postgres"
  exit 1
fi

prune_old
echo "✅ Backup xong: $OUT ($(du -h "$OUT" | cut -f1)). Retention ${RETENTION_DAYS} ngày."
