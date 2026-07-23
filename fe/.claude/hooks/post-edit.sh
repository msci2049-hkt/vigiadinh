#!/usr/bin/env bash
# PostToolUse(Edit|MultiEdit|Write) — format the just-edited file with Biome so the
# tree stays clean and `pnpm validate` has less to complain about.
set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch{}})' 2>/dev/null || true)
[ -z "${file:-}" ] && exit 0

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.json | *.jsonc | *.css)
    biome="${CLAUDE_PROJECT_DIR:-.}/node_modules/.bin/biome"
    if [ -x "$biome" ] && [ -f "$file" ]; then
      "$biome" check --write --no-errors-on-unmatched "$file" >/dev/null 2>&1 || true
    fi
    ;;
esac
exit 0
