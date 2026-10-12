#!/usr/bin/env bash
# WordPress plugin ZIP builder.
# - Copies working tree (including untracked runtime vendor files) to a temp dir
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
if ! command -v zip >/dev/null 2>&1; then
  echo "error: zip CLI not found." >&2
  exit 1
fi

RSYNC_ARGS=(-a)

# Baseline excludes in case .distignore is missing.
DEFAULT_EXCLUDES=(
  "node_modules/"
  ".git/"
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

rsync "${RSYNC_ARGS[@]}" "$PLUGIN_ROOT/" "$DEST/"

# Minify admin CSS in the distribution copy only (source stays readable).
if command -v php >/dev/null 2>&1 && [[ -f "$PLUGIN_ROOT/tools/minify-admin-css.php" ]]; then
  echo "Minifying admin CSS for distribution..."
  php "$PLUGIN_ROOT/tools/minify-admin-css.php" "$DEST/assets/css/admin-style.css" || true
fi

# Production ZIP: bundle frontend CSS into a single file when PHP CLI is available.
if command -v php >/dev/null 2>&1 && [[ -f "$DEST/tools/build-css-bundle.php" ]]; then
  echo "Building frontend CSS bundle..."
  (cd "$DEST" && php tools/build-css-bundle.php) || {
    echo "warning: CSS bundle build failed; ZIP will use layered CSS handles." >&2
  }
fi

if command -v php >/dev/null 2>&1 && [[ -f "$DEST/tools/build-js-bundle.php" ]]; then
  echo "Building frontend JS bundle..."
  (cd "$DEST" && php tools/build-js-bundle.php) || {
    echo "warning: JS bundle build failed; ZIP will use modular JS handles." >&2
  }
fi

# Prune development-only files from distribution archive.
rm -rf \
  "$DEST/tests" \
  "$DEST/scripts" \
  "$DEST/docs" \
  "$DEST/.github" \
  "$DEST/.cursor" \
  "$DEST/.vscode"
rm -rf "$DEST/vendor"
rm -f \
  "$DEST/package.json" \
  "$DEST/package-lock.json" \
  "$DEST/yarn.lock" \
  "$DEST/pnpm-lock.yaml" \
  "$DEST/.gitignore" \
  "$DEST/.distignore" \
  "$DEST/composer.json" \
  "$DEST/composer.lock" \
  "$DEST/composer.phar" \
  "$DEST/composer-setup.php" \
  "$DEST/phpunit.xml" \
  "$DEST/phpunit.xml.dist" \
  "$DEST/.phpunit.result.cache"

# Keep only README.md as markdown in distribution root.
find "$DEST" -type f -name "*.md" ! -name "README.md" -delete

if [[ ! -f "$DEST/assets/css/build/manifest.json" ]]; then
  echo "note: assets/css/build/manifest.json not present — dev layered CSS will be used at runtime." >&2
fi

if [[ ! -f "$DEST/assets/js/build/manifest.json" ]]; then
  echo "note: assets/js/build/manifest.json not present — modular JS will be used at runtime." >&2
fi

cd "$TMP"
rm -f "$OUT_ZIP"
zip -qr "$OUT_ZIP" "$ARCHIVE_DIR_NAME"

echo "Created: $OUT_ZIP ($(du -h "$OUT_ZIP" | cut -f1))"
echo "Install in WordPress: upload ZIP; extracted folder should be \"$ARCHIVE_DIR_NAME/\"."
