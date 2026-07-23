#!/usr/bin/env bash
# ============================================================================
# deploy/deploy.sh — chạy TRÊN VPS, trong root repo. Idempotent, chạy lại an toàn.
#
# Pipeline (thứ tự GATE cứng, fail ở đâu DỪNG ở đó — bản cũ vẫn sống):
#   pull → install frozen → GATE env:check → build → GATE migrate (dry-run
#   liệt kê pending + apply) → up → verify /health + /ready → prune image.
# GATE env:check chống crash-loop mù (sự cố thực tế ở một dự án trước). GATE migrate chống
# up app trên schema cũ / migration gãy giữa chừng mới phát hiện.
#
# Yêu cầu 1 lần đầu: bun + docker compose v2 đã cài, và:
#   cp deploy/env.production.example deploy/.env.production   # rồi điền
# Project name (đa project trên 1 VPS): COMPOSE_PROJECT=ten-du-an bash deploy/deploy.sh
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="deploy/.env.production"
PROJECT="${COMPOSE_PROJECT:-$(basename "$PWD")}"

# Mọi lệnh compose dùng CHUNG bộ flag (PHASE 8 runbook) — sai lệch flag giữa
# các bước = chạy nhầm project/env.
compose() {
  docker compose -p "$PROJECT" \
    --project-directory deploy \
    --env-file "$ENV_FILE" \
    -f deploy/docker-compose.prod.yml \
    --profile prod "$@"
}

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Thiếu $ENV_FILE — chạy: cp deploy/env.production.example $ENV_FILE rồi điền giá trị."
  exit 1
fi

echo "==> [1/7] git pull --ff-only origin main"
git pull --ff-only origin main

echo "==> [2/7] bun install --frozen-lockfile"
bun install --frozen-lockfile

echo "==> [3/7] GATE env:check --env-file $ENV_FILE (fail = DỪNG, KHÔNG up)"
bun scripts/env-check.ts --env-file "$ENV_FILE"

export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1

echo "==> [4/7] docker compose build (project: $PROJECT)"
compose build

echo "==> [5/7] GATE migrate: dry-run liệt kê pending rồi apply (fail = DỪNG, KHÔNG up app)"
# `run --rm` tự kéo postgres/dragonfly (depends_on healthy) trong network data.
# App/worker set RUN_MIGRATIONS=false — ĐÂY là nơi duy nhất migrate chạy ở prod.
compose run --rm app bun ./dist/migrate.js --dry-run
compose run --rm app bun ./dist/migrate.js

echo "==> [6/7] docker compose up -d"
compose up -d

echo "==> [7/7] verify /health (liveness) + /ready (DB + Dragonfly)"
APP_PORT="$(grep -E '^APP_HOST_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2)"
APP_PORT="${APP_PORT:-3000}"
for i in $(seq 1 30); do
  if curl -fsS -m 3 "http://127.0.0.1:${APP_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ /health không lên sau 90s — xem log: docker compose -p $PROJECT -f deploy/docker-compose.prod.yml logs app"
    exit 1
  fi
  sleep 3
done
echo "   /health: $(curl -fsS -m 5 "http://127.0.0.1:${APP_PORT}/health")"
echo "   /ready:  $(curl -fsS -m 10 "http://127.0.0.1:${APP_PORT}/ready")"

# Dọn image dangling (layer cũ sau rebuild) — chống đầy disk. CHỈ dangling,
# không đụng image project khác đang chạy.
docker image prune -f >/dev/null
echo "✅ Deploy xong (project: $PROJECT, port host: ${APP_PORT}). Image dangling đã prune."
