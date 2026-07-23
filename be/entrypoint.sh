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
  log "Running migrations..."
  bun run ./dist/migrate.js
  log "Migrations done"
fi

log "Starting: $*"
exec "$@"
