#!/usr/bin/env bash
# SessionStart — inject the codebase map into context so the agent starts oriented.
set -uo pipefail

map="${CLAUDE_PROJECT_DIR:-.}/.claude/CODE_BASE_MAP.md"
if [ -f "$map" ]; then
  echo "## Codebase map (.claude/CODE_BASE_MAP.md) — keep this updated after each feature"
  cat "$map"
fi
exit 0
