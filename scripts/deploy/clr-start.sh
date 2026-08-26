#!/bin/bash
# Start cursor-local-remote (CLR) — Cursor CLI agent on LAN.
# Default port: 3100. Persistent daemon: launchd via clr-service-install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# When installed to ~/bin, repo path comes from CLR_REPO (set in launchd plist).
if [[ -n "${CLR_REPO:-}" && -f "${CLR_REPO}/bin/cursor-remote.mjs" ]]; then
  CLR_ROOT="${CLR_REPO}"
elif [[ -f "${SCRIPT_DIR}/../Projects/cursor-local-remote/bin/cursor-remote.mjs" ]]; then
  CLR_ROOT="$(cd "${SCRIPT_DIR}/../Projects/cursor-local-remote" && pwd)"
elif [[ -f "${SCRIPT_DIR}/../../bin/cursor-remote.mjs" ]]; then
  CLR_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
else
  CLR_ROOT="${CLR_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
fi
PORT="${CLR_PORT:-3100}"
CLR_NODE="${CLR_NODE:-${HOME}/Applications/CLR.app/Contents/MacOS/clr-server}"
CLR_NODE_FALLBACK="${HOME}/.cursor-local-remote/bin/clr-server"
NO_FOLDER="${HOME}/.cursor-local-remote/no-folder"

export CURSOR_DEFAULT_MODEL="${CURSOR_DEFAULT_MODEL:-auto}"
export CLR_NODE

CLR_DATA_DIR="$HOME/.cursor-local-remote"
mkdir -p "$CLR_DATA_DIR" "$NO_FOLDER"
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$CLR_DATA_DIR/sessions.db" \
    "CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
     INSERT OR REPLACE INTO config (key, value) VALUES ('default_model', '$CURSOR_DEFAULT_MODEL');" \
    2>/dev/null || true
fi

if [[ ! -f "$CLR_ROOT/bin/cursor-remote.mjs" ]]; then
  echo "ERROR: CLR not found at $CLR_ROOT" >&2
  echo "Clone: git clone https://github.com/ItsRRM97/cursor-local-remote.git" >&2
  exit 1
fi

if [[ ! -x "$CLR_NODE" ]]; then
  CLR_NODE="$CLR_NODE_FALLBACK"
fi

if [[ ! -x "$CLR_NODE" ]]; then
  INSTALL_APP="${CLR_ROOT}/scripts/deploy/install-clr-app.sh"
  INSTALL_NODE="${CLR_ROOT}/scripts/deploy/install-clr-node.sh"
  if [[ -x "$INSTALL_APP" ]]; then
    "$INSTALL_APP"
    CLR_NODE="${HOME}/Applications/CLR.app/Contents/MacOS/clr-server"
  elif [[ -x "$INSTALL_NODE" ]]; then
    "$INSTALL_NODE"
    CLR_NODE="$CLR_NODE_FALLBACK"
  else
    echo "ERROR: CLR Server binary missing" >&2
    echo "Run: $CLR_ROOT/scripts/deploy/install-clr-app.sh" >&2
    exit 1
  fi
fi

if ! command -v agent >/dev/null 2>&1; then
  echo "ERROR: 'agent' CLI not on PATH (install via Cursor → Shell Command)" >&2
  exit 1
fi

if [[ -z "${AUTH_TOKEN:-}" ]]; then
  READ_TOKEN="${CLR_ROOT}/scripts/deploy/read-auth-token.sh"
  if [[ -x "${READ_TOKEN}" ]]; then
    AUTH_TOKEN="$("${READ_TOKEN}" 2>/dev/null || true)"
  fi
  if [[ -z "${AUTH_TOKEN:-}" ]]; then
    echo "ERROR: Set AUTH_TOKEN or create ~/.cursor-local-remote/auth-token.json" >&2
    exit 1
  fi
  export AUTH_TOKEN
fi

# Usage: clr-start.sh [workspace] [clr flags...]
exec "$CLR_NODE" "$CLR_ROOT/bin/cursor-remote.mjs" --port "$PORT" "$@"
