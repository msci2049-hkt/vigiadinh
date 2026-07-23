#!/usr/bin/env bash
# Runs after every Edit/Write/MultiEdit:
# 1) Auto-format with biome (silent on success).
# 2) Warn if the edited file > 300 lines.
# 3) Warn if creating files in disallowed locations.

set -euo pipefail

# Hook receives JSON on stdin with tool_input.file_path
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [ -z "$file_path" ]; then exit 0; fi
if [ ! -f "$file_path" ]; then exit 0; fi

warnings=""

# 1. Biome format (if TS/JS file and biome available)
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json)
    if [ -f "biome.json" ] && command -v bunx >/dev/null 2>&1; then
      bunx biome format --write "$file_path" >/dev/null 2>&1 || true
    fi
    ;;
esac

# 2. Line count check
lines=$(wc -l < "$file_path" 2>/dev/null | tr -d ' ')
if [ "${lines:-0}" -gt 300 ]; then
  warnings+="⚠️  ${file_path} has ${lines} lines (limit 300). Split into smaller files. "
fi

# 3. Location check — Drizzle schema must be in src/db/schema/
case "$file_path" in
  src/modules/*/schema.ts)
    warnings+="⚠️  Schema file at ${file_path} — should be in src/db/schema/ not in module folder. "
    ;;
esac

# 4. Forbidden patterns: any / @ts-ignore
case "$file_path" in
  *.ts|*.tsx)
    if grep -qE '(\bany\b|@ts-ignore)' "$file_path" 2>/dev/null; then
      hits=$(grep -nE '(\bany\b|@ts-ignore)' "$file_path" 2>/dev/null | head -3)
      warnings+="⚠️  ${file_path} contains 'any' or '@ts-ignore':\n${hits}\n"
    fi
    ;;
esac

# Output warnings to Claude (non-blocking)
if [ -n "$warnings" ]; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "$(echo -e "$warnings" | sed 's/"/\\"/g' | tr '\n' ' ')"
  }
}
EOF
fi

exit 0
