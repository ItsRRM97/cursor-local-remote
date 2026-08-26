#!/bin/bash
# Install / manage cursor-local-remote (CLR) as a user LaunchAgent.
set -euo pipefail

LABEL="com.rawshn.cursor-local-remote"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/.cursor-local-remote/logs"
CLR_REPO="${CLR_REPO:-${HOME}/Projects/cursor-local-remote}"
CLR_START_SRC="${CLR_REPO}/scripts/deploy/clr-start.sh"
CLR_START="${HOME}/bin/clr-start.sh"
CLR_NODE="${HOME}/Applications/CLR.app/Contents/MacOS/clr-server"
INSTALL_CLR_APP="${CLR_REPO}/scripts/deploy/install-clr-app.sh"
INSTALL_CLR_NODE="${CLR_REPO}/scripts/deploy/install-clr-node.sh"
WORKSPACE="${CLR_WORKSPACE:-${HOME}}"
AUTH_TOKEN_FILE="${CLR_AUTH_FILE:-${HOME}/.cursor-local-remote/auth-token.json}"
READ_TOKEN="${HOME}/Projects/cursor-local-remote/scripts/deploy/read-auth-token.sh"
UID_NUM="$(id -u)"
DOMAIN="gui/${UID_NUM}"

read_auth_token() {
  if [[ -x "${READ_TOKEN}" ]] && [[ -f "${AUTH_TOKEN_FILE}" ]]; then
    "${READ_TOKEN}"
    return
  fi
  echo "${AUTH_TOKEN:-wagon-kiosk}"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [install|uninstall|restart|status]

  install    Write plist, bootstrap LaunchAgent, enable on login
  uninstall  bootout + remove plist (does not kill orphan processes)
  restart    kickstart -k (stop + start)
  status     launchctl print + port 3100 check

Plist: ${PLIST_PATH}
Logs:  ${LOG_DIR}/clr.{out,err}.log
EOF
}

write_plist() {
  local token
  token="$(read_auth_token)"
  mkdir -p "${HOME}/Library/LaunchAgents" "${LOG_DIR}"
  cat >"${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${CLR_START}</string>
    <string>${WORKSPACE}</string>
    <string>--no-open</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${HOME}</string>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/clr.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/clr.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.local/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>AUTH_TOKEN</key>
    <string>${token}</string>
    <key>CURSOR_DEFAULT_MODEL</key>
    <string>auto</string>
    <key>PUBLIC_URL</key>
    <string>${PUBLIC_URL:-https://clr.rawshn.com}</string>
    <key>CF_ACCESS_TEAM_DOMAIN</key>
    <string>${CF_ACCESS_TEAM_DOMAIN:-billowing-limit-310f.cloudflareaccess.com}</string>
    <key>CF_ACCESS_AUD</key>
    <string>${CF_ACCESS_AUD:-8f53549ef7fd28e492bba7feaee7e9e7effee8deb2ed326a54b0d493c9d0f115}</string>
    <key>AUTH_TRUST_CLOUDFLARE_ACCESS</key>
    <string>${AUTH_TRUST_CLOUDFLARE_ACCESS:-1}</string>
    <key>CLR_NODE</key>
    <string>${CLR_NODE}</string>
  </dict>
</dict>
</plist>
PLIST
  echo "Wrote ${PLIST_PATH}"
}

kill_stale() {
  local pids
  pids="$(lsof -ti :3100 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "Killing stale process(es) on :3100: ${pids}"
    kill ${pids} 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti :3100 2>/dev/null || true)"
    [[ -z "${pids}" ]] || kill -9 ${pids} 2>/dev/null || true
  fi
}

cmd_install() {
  [[ -x "${CLR_START_SRC}" ]] || { echo "ERROR: missing ${CLR_START_SRC}" >&2; exit 1; }
  mkdir -p "${HOME}/bin"
  cp "${CLR_START_SRC}" "${CLR_START}"
  chmod +x "${CLR_START}"
  echo "Installed ${CLR_START}"
  if [[ -x "${INSTALL_CLR_APP}" ]]; then
    "${INSTALL_CLR_APP}"
  elif [[ -x "${INSTALL_CLR_NODE}" ]]; then
    "${INSTALL_CLR_NODE}"
  fi
  kill_stale
  write_plist
  launchctl bootout "${DOMAIN}" "${PLIST_PATH}" 2>/dev/null || true
  launchctl bootstrap "${DOMAIN}" "${PLIST_PATH}"
  launchctl enable "${DOMAIN}/${LABEL}" 2>/dev/null || true
  launchctl kickstart -k "${DOMAIN}/${LABEL}" 2>/dev/null || true
  echo "LaunchAgent installed and started."
}

cmd_uninstall() {
  if [[ -f "${PLIST_PATH}" ]]; then
    launchctl bootout "${DOMAIN}" "${PLIST_PATH}" 2>/dev/null || true
    rm -f "${PLIST_PATH}"
    echo "Removed ${PLIST_PATH}"
  else
    echo "Plist not found: ${PLIST_PATH}"
  fi
}

cmd_restart() {
  launchctl kickstart -k "${DOMAIN}/${LABEL}"
}

cmd_status() {
  if [[ -f "${PLIST_PATH}" ]]; then
    echo "Plist: ${PLIST_PATH}"
  else
    echo "Plist: missing"
  fi
  if launchctl print "${DOMAIN}/${LABEL}" 2>/dev/null; then
    :
  else
    echo "Service not loaded in ${DOMAIN}"
  fi
  echo "---"
  if lsof -i :3100 2>/dev/null | head -5; then
    :
  else
    echo "Port 3100: not listening"
  fi
}

case "${1:-install}" in
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
  restart) cmd_restart ;;
  status) cmd_status ;;
  -h|--help|help) usage ;;
  *) echo "Unknown: $1" >&2; usage >&2; exit 1 ;;
esac
