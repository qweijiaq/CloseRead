#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export CSC_IDENTITY_AUTO_DISCOVERY=false
pnpm exec electron-builder --mac --dir
app="$(find desktop-dist -maxdepth 2 -name 'CloseRead.app' -type d | head -1)"
if [ -z "$app" ]; then
  echo "CloseRead.app was not produced" >&2
  exit 1
fi
rm -f desktop-dist/CloseRead-unsigned.dmg
hdiutil create -volname CloseRead -srcfolder "$app" -ov -format UDZO desktop-dist/CloseRead-unsigned.dmg
echo "DMG: desktop-dist/CloseRead-unsigned.dmg"
