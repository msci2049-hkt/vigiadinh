#!/bin/sh
set -euo pipefail
log() { echo "[entrypoint] $*"; }

: "${DATABASE_URL:?DATABASE_URL must be set}"

HOST_PORT=$(echo "$DATABASE_URL" | sed -E 's|^[a-z]+://[^@]*@([^/]+)/.*|\1|')
DB_HOST="${HOST_PORT%:*}"
DB_PORT="${HOST_PORT##*:}"
[ "$DB_PORT" = "$DB_HOST" ] && DB_PORT=5432

log "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
i=0
until bun --eval "await Bun.connect({hostname:'${DB_HOST}',port:${DB_PORT},socket:{open(s){s.end()},data(){},close(){}}}).catch(()=>process.exit(1))" 2>/dev/null; do
  i=$((i+1))
  [ "$i" -gt 60 ] && log "ERROR: Postgres timeout" && exit 1
  sleep 1
done
log "Postgres is reachable"

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  # Migration cần DDL → chạy bằng DATABASE_URL_OWNER (scripts/migrate.ts tự ưu
  # tiên biến đó). Provision role runtime NGAY SAU migration: 0009 chỉ tạo role
  # NHÓM `app_runtime` (NOLOGIN), còn role ĐĂNG NHẬP mà DATABASE_URL trỏ tới phải
  # do bước này tạo — thiếu nó thì app không kết nối được sau lần deploy đầu.
  log "Running migrations..."
  bun run ./dist/migrate.js
  log "Migrations done"

  if [ -n "${DATABASE_URL_OWNER:-}" ]; then
    log "Provisioning runtime role..."
    bun run ./dist/provision-runtime-role.js
    log "Runtime role ready"
  else
    log "WARNING: DATABASE_URL_OWNER chưa đặt — app đang chạy bằng role OWNER."
    log "WARNING: Tầng REVOKE audit_log (migration 0009) KHÔNG có hiệu lực."
  fi
fi

log "Starting: $*"
exec "$@"
