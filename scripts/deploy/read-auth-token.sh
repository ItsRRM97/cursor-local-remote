#!/bin/bash
# Read CLR AUTH_TOKEN from ~/.cursor-local-remote/auth-token.json (stdout only).
set -euo pipefail
AUTH_FILE="${CLR_AUTH_FILE:-$HOME/.cursor-local-remote/auth-token.json}"
if [[ -f "$AUTH_FILE" ]]; then
  python3 - "$AUTH_FILE" <<'PY'
import json, sys
print(json.load(open(sys.argv[1]))["token"])
PY
  exit 0
fi
# Legacy fallback
echo "${AUTH_TOKEN:-}"