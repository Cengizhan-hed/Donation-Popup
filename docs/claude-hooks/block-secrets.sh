#!/bin/bash
# PreToolUse (Read|Edit|Write|Bash): gizli dosyalara erişimi engeller. stdin: hook JSON.
input=$(cat)
paths=$(printf '%s' "$input" | jq -r '[.tool_input.file_path // empty, .tool_input.command // empty] | join(" ")' 2>/dev/null)
if printf '%s' "$paths" | grep -Eq '(^|[ /"'"'"'])\.env($|[.[:space:]/"'"'"'])|tests/e2e/\.auth/|\.pem($|[[:space:]"'"'"'])|\.key($|[[:space:]"'"'"'])|(^|[ /"'"'"'~])\.ssh(/|$|[[:space:]])|build/handoff/REMOTE_FREEZE'; then
  echo "Engellendi: gizli dosya / SSH anahtarı / REMOTE_FREEZE (CLAUDE.md güvenlik kuralları)." >&2
  exit 2
fi
exit 0
