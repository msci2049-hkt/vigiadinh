#!/usr/bin/env bash
# Inject CODE_BASE_MAP + ERRORS reminder at session start so Claude knows where to look.
# Also remind about scratchpad files Gin asks Claude to maintain.

set -euo pipefail

# Only emit if files exist — fail silent otherwise.
output=""

if [ -f ".claude/CODE_BASE_MAP.md" ]; then
  output+="📍 CODE_BASE_MAP.md exists — read it before creating files (avoid duplicates).\n"
fi

if [ -f ".claude/ERRORS.md" ]; then
  output+="🐛 ERRORS.md exists — check it for known anti-patterns before coding.\n"
fi

# Count file > 300 lines as a warning
if [ -d "src" ]; then
  overlimit=$(find src -name "*.ts" -type f 2>/dev/null | xargs wc -l 2>/dev/null | awk '$1 > 300 && $2 != "total" {print $2}' | wc -l | tr -d ' ')
  if [ "${overlimit:-0}" -gt 0 ]; then
    output+="⚠️  ${overlimit} file(s) currently > 300 lines. Project rule violated. Run: find src -name \"*.ts\" | xargs wc -l | awk '\$1>300'\n"
  fi
fi

# Output goes to Claude's context as additional system info.
if [ -n "$output" ]; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "$(echo -e "$output" | sed 's/"/\\"/g' | tr '\n' ' ')"
  }
}
EOF
fi

exit 0
