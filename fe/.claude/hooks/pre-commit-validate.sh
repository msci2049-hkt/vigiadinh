#!/usr/bin/env bash
# PreToolUse(Bash) — if the command is a `git commit`, run `pnpm validate` first and
# BLOCK the commit (exit 2) when it fails. Keeps broken code out of history.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.command)||"")}catch{}})' 2>/dev/null || true)

case "$cmd" in
  *"git commit"*)
    log="${TMPDIR:-/tmp}/mau-validate.log"
    if ! pnpm validate >"$log" 2>&1; then
      echo "❌ pnpm validate failed — commit blocked. Fix these first:" >&2
      tail -25 "$log" >&2
      exit 2
    fi
    ;;
esac
exit 0
