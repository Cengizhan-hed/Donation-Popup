#!/usr/bin/env bash
# WordPress plugin ZIP: copies the working tree (including untracked vendor) into a temp folder,
# then zips it. Excludes node_modules, .git, and dev manifests — the usual cause of ~20MB+ archives.
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE_DIR_NAME="woo-donation-popup"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$PLUGIN_ROOT/build"
OUT_ZIP="$PLUGIN_ROOT/build/woo-donation-popup.zip"
DEST="$TMP/$ARCHIVE_DIR_NAME"
mkdir -p "$DEST"

if ! command -v rsync >/dev/null 2>&1; then
  echo "error: rsync is required (install Xcode CLT on macOS)." >&2
  exit 1
fi
if ! command -v zip >/dev/null 2>&1; then
  echo "error: zip CLI not found." >&2
  exit 1
fi

rsync -a \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.cursor' \
  --exclude='.vscode' \
  --exclude='build' \
  --exclude='.DS_Store' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='yarn.lock' \
  --exclude='pnpm-lock.yaml' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*.zip' \
  "$PLUGIN_ROOT/" "$DEST/"

cd "$TMP"
rm -f "$OUT_ZIP"
zip -qr "$OUT_ZIP" "$ARCHIVE_DIR_NAME"

echo "Created: $OUT_ZIP ($(du -h "$OUT_ZIP" | cut -f1))"
echo "Install in WordPress: upload ZIP; extracted folder should be \"$ARCHIVE_DIR_NAME/\"."
