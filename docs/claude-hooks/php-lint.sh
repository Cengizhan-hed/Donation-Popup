#!/bin/bash
# PostToolUse (Edit|Write): düzenlenen .php dosyasında `php -l`. Sözdizimi hatasında exit 2.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty' 2>/dev/null)
case "$f" in
  *.php) [ -f "$f" ] && out=$(php -l "$f" 2>&1) || { [ -f "$f" ] && { echo "$out" >&2; exit 2; }; } ;;
esac
exit 0
