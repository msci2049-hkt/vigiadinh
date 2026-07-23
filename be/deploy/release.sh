#!/usr/bin/env bash
# ============================================================================
# deploy/release.sh — chạy Ở MÁY DEV trước khi lên VPS: validate → test → push.
# (validate đã gồm: typecheck + biome + check:boundaries + check:env-parity.)
# Sau khi push: SSH vào VPS chạy `bash deploy/deploy.sh`.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "❌ Đang ở nhánh '$BRANCH' — release chỉ chạy từ main."
  exit 1
fi

echo "==> [1/3] bun run validate"
bun run validate

echo "==> [2/3] bun test"
bun test

echo "==> [3/3] git push origin main"
git push origin main

echo "✅ Đã push. Bước tiếp: SSH vào VPS → bash deploy/deploy.sh"
