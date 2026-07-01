#!/usr/bin/env bash
# Generate or rotate CLR AUTH_TOKEN (default: every 90 days).
set -euo pipefail

AUTH_FILE="${CLR_AUTH_FILE:-$HOME/.cursor-local-remote/auth-token.json}"
ROTATION_DAYS="${CLR_TOKEN_ROTATION_DAYS:-90}"
FORCE=false
NOTIFY="${CLR_TOKEN_NOTIFY:-}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--force] [--notify URL]

  --force   Rotate even if current token is not expired
  --notify  POST JSON to webhook after rotation (optional)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=true; shift ;;
    --notify) NOTIFY="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown: $1" >&2; usage >&2; exit 1 ;;
  esac
done

mkdir -p "$(dirname "$AUTH_FILE")"

now_epoch() { date -u +%s; }
iso_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

needs_rotation() {
  [[ "$FORCE" == true ]] && return 0
  [[ ! -f "$AUTH_FILE" ]] && return 0
  python3 - "$AUTH_FILE" <<'PY'
import json, sys, time
from pathlib import Path
p = Path(sys.argv[1])
try:
    data = json.loads(p.read_text())
    exp = data.get("expires_at_epoch")
    if not exp:
        raise SystemExit(0)
    raise SystemExit(0 if int(exp) <= int(time.time()) else 1)
except (json.JSONDecodeError, OSError):
    raise SystemExit(0)
PY
}

if ! needs_rotation; then
  echo "Token still valid — no rotation needed. Use --force to override."
  python3 - "$AUTH_FILE" <<'PY'
import json, sys
from datetime import datetime, timezone
d = json.load(open(sys.argv[1]))
exp = datetime.fromtimestamp(d["expires_at_epoch"], tz=timezone.utc)
print(f"Expires: {exp.isoformat()}")
print(f"Token preview: {d['token'][:8]}…")
PY
  exit 0
fi

TOKEN="$(openssl rand -hex 32)"
CREATED_EPOCH="$(now_epoch)"
EXPIRES_EPOCH="$((CREATED_EPOCH + ROTATION_DAYS * 86400))"

python3 - "$AUTH_FILE" "$TOKEN" "$CREATED_EPOCH" "$EXPIRES_EPOCH" "$ROTATION_DAYS" <<'PY'
import json, sys
from datetime import datetime, timezone
path, token, created, expires, days = sys.argv[1:6]
created_i, expires_i = int(created), int(expires)
data = {
    "token": token,
    "created_at": datetime.fromtimestamp(created_i, tz=timezone.utc).isoformat(),
    "expires_at": datetime.fromtimestamp(expires_i, tz=timezone.utc).isoformat(),
    "created_at_epoch": created_i,
    "expires_at_epoch": expires_i,
    "rotation_days": int(days),
}
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
chmod = 0o600
import os
os.chmod(path, chmod)
print(f"Wrote {path} (expires {data['expires_at']})")
PY

chmod 600 "$AUTH_FILE"

if [[ -x "$HOME/bin/clr-service-install.sh" ]]; then
  "$HOME/bin/clr-service-install.sh" install
elif command -v launchctl >/dev/null 2>&1; then
  DOMAIN="gui/$(id -u)"
  launchctl kickstart -k "$DOMAIN/com.rawshn.cursor-local-remote" 2>/dev/null || true
fi

if [[ -n "$NOTIFY" ]]; then
  curl -fsS -X POST -H "Content-Type: application/json" \
    -d "{\"event\":\"clr_token_rotated\",\"expires_at_epoch\":$EXPIRES_EPOCH}" \
    "$NOTIFY" >/dev/null || true
fi

echo ""
echo "New CLR token (save in password manager; update phone bookmark):"
python3 -c "import json; print(json.load(open('$AUTH_FILE'))['token'])"
