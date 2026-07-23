#!/usr/bin/env bash
# Statusline: model | dir | branch | context% | cost
# Requires jq (auto-skip gracefully if missing).

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  # Fallback: show working directory name
  cwd=$(echo "$input" | sed -n 's/.*"current_dir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  echo "[$(basename "${cwd:-claude}")]"
  exit 0
fi

model=$(echo "$input" | jq -r '.model.display_name // "Claude"')
cwd=$(echo "$input" | jq -r '.workspace.current_dir // ""')
dir=$(basename "${cwd:-pwd}")
ctx=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0' | awk '{printf "%.2f", $1}')

# Git branch (if in repo)
branch=""
if [ -n "$cwd" ] && [ -d "$cwd/.git" ]; then
  branch=$(git -C "$cwd" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null || echo "")
fi

# Color helpers
RST=$'\033[0m'
DIM=$'\033[2m'
B=$'\033[1m'
CYAN=$'\033[36m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RED=$'\033[31m'

# Context color
if   [ "${ctx:-0}" -gt 85 ]; then ctx_c="$RED"
elif [ "${ctx:-0}" -gt 60 ]; then ctx_c="$YELLOW"
else                              ctx_c="$GREEN"
fi

line="${B}${CYAN}${model}${RST}"
line+=" ${DIM}|${RST} 📁 ${dir}"
[ -n "$branch" ] && line+=" ${DIM}|${RST} 🌿 ${branch}"
line+=" ${DIM}|${RST} ${ctx_c}${ctx}%${RST} ctx"
line+=" ${DIM}|${RST} \$${cost}"

echo -e "$line"
