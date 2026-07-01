#!/usr/bin/env bash
# Install launchd job to rotate CLR token every 90 days (+ check on boot).
set -euo pipefail

LABEL="com.rawshn.clr-token-rotation"
SCRIPT="${CLR_ROTATE_SCRIPT:-$HOME/Projects/cursor-local-remote/scripts/deploy/rotate-auth-token.sh}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
DOMAIN="gui/$(id -u)"
LOG_DIR="$HOME/.cursor-local-remote/logs"

usage() {
  echo "Usage: $(basename "$0") [install|uninstall]"
}

write_plist() {
  mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"
  cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SCRIPT}</string>
  </array>
  <key>StartInterval</key>
  <integer>7776000</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/token-rotation.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/token-rotation.err.log</string>
</dict>
</plist>
PLIST
}

cmd_install() {
  [[ -x "$SCRIPT" ]] || chmod +x "$SCRIPT"
  write_plist
  launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$PLIST"
  echo "Installed $PLIST (checks on login + every 90 days; skips if token not expired)"
  "$SCRIPT" || true
}

cmd_uninstall() {
  launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed $PLIST"
}

case "${1:-install}" in
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  *) usage; exit 1 ;;
esac
