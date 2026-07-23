#!/usr/bin/env bash
# WHY: Block git commit nếu `bun run validate` fail. Chặn ngay lúc Claude
# định chạy `git commit`, không để bug typecheck/biome lọt vào history.
# Chỉ chạy khi command match `git commit ...`.

set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# Match `git commit` (có thể có -m, -am, --amend, ...).
if echo "$command" | grep -qE '^\s*git\s+commit(\s|$)'; then
  if [ -f "package.json" ] && grep -q '"validate"' package.json; then
    if ! bun run validate >/tmp/validate.log 2>&1; then
      ERR=$(tail -20 /tmp/validate.log | head -10)
      cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "bun run validate FAILED. Fix typecheck/biome trước khi commit. Last error: $ERR"
  }
}
EOF
      exit 0
    fi
  fi
fi

exit 0
