#!/usr/bin/env bash
# Block destructive bash commands. Exit 2 = block + tell Claude why.
#
# Patterns:
#   - rm -rf on root/home/important dirs
#   - DROP COLUMN / DROP TABLE in SQL or migration files
#   - git push --force
#   - sudo
#   - chmod 777
#   - curl/wget piping to bash

set -euo pipefail

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

if [ -z "$cmd" ]; then exit 0; fi

block() {
  local reason="$1"
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "${reason}"
  }
}
EOF
  exit 0
}

# 1. rm -rf protection
if echo "$cmd" | grep -qE 'rm\s+-rf?\s+(/|/\*|~|\$HOME|/home|/etc|/usr|/var)'; then
  block "Blocked: 'rm -rf' on protected path. Use targeted paths inside the project."
fi

if echo "$cmd" | grep -qE 'rm\s+-rf?\s+\.{1,2}/?$'; then
  block "Blocked: 'rm -rf .' or 'rm -rf ..' wipes too much. Be specific."
fi

# 2. git destructive
if echo "$cmd" | grep -qE 'git\s+push\s+.*--force|git\s+push\s+.*-f(\s|$)'; then
  block "Blocked: 'git push --force' rewrites history on remote. Use --force-with-lease and confirm with user first."
fi

if echo "$cmd" | grep -qE 'git\s+reset\s+--hard\s+(origin/|HEAD~[0-9]+)'; then
  block "Blocked: 'git reset --hard' on remote ref destroys local commits. Confirm with user first."
fi

# 3. SQL destructive in migrations
if echo "$cmd" | grep -qiE 'DROP\s+(COLUMN|TABLE|DATABASE|SCHEMA)'; then
  block "Blocked: DROP COLUMN/TABLE/DATABASE/SCHEMA. Use 3-release deprecation workflow (see .claude/rules/db-schema.md). For drop, user must explicitly approve."
fi

# 4. sudo
if echo "$cmd" | grep -qE '^\s*sudo\s'; then
  block "Blocked: 'sudo'. Project tooling shouldn't require root."
fi

# 5. chmod 777
if echo "$cmd" | grep -qE 'chmod\s+(-R\s+)?7[0-7][0-7]'; then
  block "Blocked: 'chmod 777' is world-writable. Use 755 for dirs, 644 for files."
fi

# 6. curl/wget pipe to shell
if echo "$cmd" | grep -qE '(curl|wget).*\|\s*(bash|sh|zsh)'; then
  block "Blocked: piping remote content to shell is unsafe. Download to file, inspect, then run."
fi

# 7. dotenv read attempts
if echo "$cmd" | grep -qE '\bcat\s+.*\.env\b|\bsource\s+.*\.env\b|\bdotenv\b'; then
  block "Blocked: reading .env files. Env access must go through src/env.ts at runtime."
fi

# 8. db:drop in production
if echo "$cmd" | grep -qE 'db:drop|drizzle-kit\s+drop'; then
  block "Blocked: db:drop is destructive. Confirm with user; only use on local dev DB."
fi

# Allow — output empty
exit 0
