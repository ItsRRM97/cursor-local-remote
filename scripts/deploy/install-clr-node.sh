#!/usr/bin/env bash
# Symlink legacy path to CLR.app binary (prefer install-clr-app.sh).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "${SCRIPT_DIR}/install-clr-app.sh" "$@"
