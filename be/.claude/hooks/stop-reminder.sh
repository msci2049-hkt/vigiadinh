#!/usr/bin/env bash
# Fires when Claude finishes a turn. Remind to update CODE_BASE_MAP if
# files were created/deleted in src/ but map not touched.

set -euo pipefail

# Check if src/ was modified since last CODE_BASE_MAP update
if [ ! -d "src" ] || [ ! -f ".claude/CODE_BASE_MAP.md" ]; then
  exit 0
fi

# Newest src/ file
newest_src=$(find src -type f -name "*.ts" -newer ".claude/CODE_BASE_MAP.md" 2>/dev/null | head -3)

if [ -n "$newest_src" ]; then
  count=$(echo "$newest_src" | wc -l | tr -d ' ')
  reminder="📝 ${count}+ file(s) in src/ newer than CODE_BASE_MAP.md. Update .claude/CODE_BASE_MAP.md before committing:\\n${newest_src}"
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "additionalContext": "${reminder}"
  }
}
EOF
fi

exit 0
