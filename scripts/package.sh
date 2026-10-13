#!/bin/sh
# Builds the Chrome Web Store zip with only the files the extension needs.
set -e
cd "$(dirname "$0")/.."
version=$(node -p 'require("./manifest.json").version')
mkdir -p dist
rm -f "dist/localview-$version.zip"
zip -qr "dist/localview-$version.zip" \
  manifest.json background.js content.js core.js \
  popup.html popup.js options.html options.js style.css \
  _locales icons assets/icon.svg fonts \
  -x '*.DS_Store'
echo "dist/localview-$version.zip"
