#!/usr/bin/env bash
# WordPress plugin ZIP builder.
# - Copies working tree to a temp dir
# - Applies exclude rules from .distignore (single source of truth)
# - Creates build/woo-donation-popup.zip
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE_DIR_NAME="woo-donation-popup"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$PLUGIN_ROOT/build"
OUT_ZIP="$PLUGIN_ROOT/build/woo-donation-popup.zip"
DEST="$TMP/$ARCHIVE_DIR_NAME"
mkdir -p "$DEST"
DISTIGNORE_FILE="$PLUGIN_ROOT/.distignore"

if ! command -v rsync >/dev/null 2>&1; then
  echo "error: rsync is required (install Xcode CLT on macOS)." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required for remote-guard." >&2
  exit 1
fi
node "$PLUGIN_ROOT/scripts/lib/remote-guard.mjs" --assert-local-pack || exit 1
if ! command -v zip >/dev/null 2>&1; then
  echo "error: zip CLI not found." >&2
  exit 1
fi

RSYNC_ARGS=(-a)

# Baseline excludes in case .distignore is missing.
DEFAULT_EXCLUDES=(
  "node_modules/"
  ".git/"
  ".git"
  ".claude/"
  "CLAUDE.md"
  ".cursor/"
  ".vscode/"
  "/build/"
  ".DS_Store"
  "*.zip"
)

for pattern in "${DEFAULT_EXCLUDES[@]}"; do
  RSYNC_ARGS+=(--exclude="$pattern")
done

if [[ -f "$DISTIGNORE_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Trim whitespace.
    pattern="$(echo "$line" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    # Skip comments and empty lines.
    [[ -z "$pattern" || "${pattern:0:1}" == "#" ]] && continue
    RSYNC_ARGS+=(--exclude="$pattern")
  done < "$DISTIGNORE_FILE"
fi

node "$PLUGIN_ROOT/scripts/lib/remote-guard.mjs" --exec --local-pack -- rsync "${RSYNC_ARGS[@]}" "$PLUGIN_ROOT/" "$DEST/"

# Dagitim koku YALNIZ izinli girdiler (ayrintisi: .distignore basligi); digerleri silinir.
ALLOWED_TOP=(woo-donation-popup.php uninstall.php readme.txt src assets templates blocks languages)
for entry in "$DEST"/* "$DEST"/.[!.]*; do
  [[ -e "$entry" ]] || continue
  name="$(basename "$entry")"
  keep=0
  for a in "${ALLOWED_TOP[@]}"; do [[ "$name" == "$a" ]] && keep=1; done
  [[ $keep -eq 1 ]] || rm -rf "$entry"
done
# Calisma zamani disi dosyalar (belge/test/kaynak haritasi) paketten cikar.
# OS artiklari (.DS_Store, Thumbs.db, ._*) pakete girmez.
find "$DEST" -type f \( -name ".DS_Store" -o -name "Thumbs.db" -o -name "._*" \) -delete
find "$DEST" -type f \( -name "*.md" -o -name "*.map" -o -name "*.test.*" \) -delete
find "$DEST" -type d \( -name tests -o -name __tests__ \) -prune -exec rm -rf {} +

cd "$TMP"
rm -f "$OUT_ZIP"
zip -qr "$OUT_ZIP" "$ARCHIVE_DIR_NAME"

echo "Created: $OUT_ZIP ($(du -h "$OUT_ZIP" | cut -f1))"
echo "Install in WordPress: upload ZIP; extracted folder should be \"$ARCHIVE_DIR_NAME/\"."
