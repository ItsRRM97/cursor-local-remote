#!/usr/bin/env bash
# Build ~/Applications/CLR.app for macOS Full Disk Access (shows as "CLR Server").
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLR_APP="${CLR_APP:-${HOME}/Applications/CLR.app}"
CLR_REPO="${CLR_REPO:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
BUNDLE_ID="${CLR_BUNDLE_ID:-com.cursor-local-remote.server}"
MACOS_DIR="${CLR_APP}/Contents/MacOS"
RES_DIR="${CLR_APP}/Contents/Resources"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found on PATH" >&2
  exit 1
fi

NODE_SRC="$(command -v node)"
NODE_DST="${MACOS_DIR}/clr-server"

mkdir -p "${MACOS_DIR}" "${RES_DIR}"
cp -f "${NODE_SRC}" "${NODE_DST}"
chmod +x "${NODE_DST}"

cat >"${CLR_APP}/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>clr-server</string>
  <key>CFBundleIdentifier</key>
  <string>${BUNDLE_ID}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>CLR Server</string>
  <key>CFBundleDisplayName</key>
  <string>CLR Server</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

if [[ -f "${CLR_REPO}/scripts/clr-preload.cjs" ]]; then
  cp -f "${CLR_REPO}/scripts/clr-preload.cjs" "${RES_DIR}/clr-preload.cjs"
fi

if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep --sign - "${CLR_APP}" 2>/dev/null || \
    codesign --force --sign - "${NODE_DST}" 2>/dev/null || true
fi

mkdir -p "${HOME}/.cursor-local-remote/bin"
ln -sf "${NODE_DST}" "${HOME}/.cursor-local-remote/bin/clr-server"

echo "Installed ${CLR_APP}"
echo "Bundle ID: ${BUNDLE_ID}"
echo "Executable: ${NODE_DST}"
echo ""
echo "Full Disk Access:"
echo "  1. Open System Settings → Privacy & Security → Full Disk Access"
echo "  2. Click + and choose: ${CLR_APP}"
echo "     (shows as CLR Server)"
