#!/usr/bin/env bash
# Install Cloudflare Tunnel to expose local CLR (port 3100) on your hostname
set -euo pipefail

TUNNEL_NAME="${CLR_TUNNEL_NAME:-clr-tunnel}"
HOSTNAME="${CLR_PUBLIC_HOSTNAME:-clr.example.com}"
LOCAL_SERVICE="${CLR_LOCAL_URL:-http://127.0.0.1:3100}"
LABEL="${CLR_TUNNEL_LAUNCHD_LABEL:-com.cursor-local-remote.cloudflared}"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
DOMAIN="gui/$(id -u)"
LOG_DIR="$HOME/.cursor-local-remote/logs"
CF_DIR="$HOME/.cloudflared"

usage() {
  cat <<EOF
Usage: $(basename "$0") [install|uninstall|status]

  install    brew install cloudflared, create tunnel, route DNS, launchd
  uninstall  stop tunnel launch agent
  status     tunnel list + launchctl

Requires: Cloudflare account with your zone on Cloudflare. First run opens browser for:
  cloudflared tunnel login
EOF
}

ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    return 0
  fi
  if command -v brew >/dev/null 2>&1; then
    brew install cloudflared
  else
    echo "Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
    exit 1
  fi
}

ensure_login() {
  if [[ -f "$CF_DIR/cert.pem" ]]; then
    return 0
  fi
  echo "Opening Cloudflare login — authorize access to your zone in the browser…"
  cloudflared tunnel login
}

tunnel_id() {
  cloudflared tunnel list 2>/dev/null | awk -v n="$TUNNEL_NAME" '$0 ~ n {print $1; exit}'
}

write_config() {
  local tid cred
  tid="$(tunnel_id)"
  [[ -n "$tid" ]] || { echo "Tunnel $TUNNEL_NAME not found" >&2; exit 1; }
  cred="$CF_DIR/${tid}.json"
  [[ -f "$cred" ]] || { echo "Missing credentials: $cred" >&2; exit 1; }

  mkdir -p "$CF_DIR"
  cat >"$CF_DIR/config.yml" <<YAML
# CLR — Cloudflare Tunnel (managed by install-cloudflare-tunnel.sh)
tunnel: ${tid}
credentials-file: ${cred}

ingress:
  - hostname: ${HOSTNAME}
    service: ${LOCAL_SERVICE}
    originRequest:
      connectTimeout: 60s
      keepAliveTimeout: 120s
      noHappyEyeballs: false
  - service: http_status:404
YAML
  echo "Wrote $CF_DIR/config.yml"
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
    <string>$(command -v cloudflared)</string>
    <string>tunnel</string>
    <string>--no-autoupdate</string>
    <string>run</string>
    <string>${TUNNEL_NAME}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/cloudflared.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/cloudflared.err.log</string>
</dict>
</plist>
PLIST
}

cmd_install() {
  ensure_cloudflared
  ensure_login

  if [[ -z "$(tunnel_id)" ]]; then
    echo "Creating tunnel: $TUNNEL_NAME"
    cloudflared tunnel create "$TUNNEL_NAME"
  fi

  echo "Routing DNS: $HOSTNAME"
  cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME" 2>/dev/null || \
    cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME" --overwrite-dns || true

  write_config
  write_plist

  launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$PLIST"
  launchctl kickstart -k "$DOMAIN/$LABEL" 2>/dev/null || true

  echo ""
  echo "Tunnel installed. Public URL (after DNS propagates):"
  echo "  https://${HOSTNAME}/?token=<see ~/.cursor-local-remote/auth-token.json>"
  echo ""
  echo "Recommended: Cloudflare Zero Trust → Access → protect ${HOSTNAME}"
}

cmd_uninstall() {
  launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed launch agent $PLIST (tunnel object kept in Cloudflare)"
}

cmd_status() {
  cloudflared tunnel list 2>/dev/null || true
  launchctl print "$DOMAIN/$LABEL" 2>/dev/null | head -20 || echo "Tunnel agent not loaded"
}

case "${1:-install}" in
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  status) cmd_status ;;
  *) usage; exit 1 ;;
esac
