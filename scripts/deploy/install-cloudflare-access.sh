#!/usr/bin/env bash
# Create Cloudflare Access app for CLR + allow policy for your email(s).
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID}"
HOSTNAME="${CLR_PUBLIC_HOSTNAME:?Set CLR_PUBLIC_HOSTNAME (e.g. clr.example.com)}"
APP_NAME="${CLR_ACCESS_APP_NAME:-Cursor Local Remote}"
USER_EMAIL="${CLR_ACCESS_EMAIL:?Set CLR_ACCESS_EMAIL}"
USER_EMAIL_ALT="${CLR_ACCESS_EMAIL_ALT:-}"
TOKEN_FILE="${CLOUDFLARE_API_TOKEN_FILE:-$HOME/.cursor-local-remote/cloudflare-api-token}"
SESSION_DURATION="${CLR_ACCESS_SESSION:-24h}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [install|status]

Requires Cloudflare API token with Zero Trust / Access edit permissions.
Store token in: $TOKEN_FILE (chmod 600) or export CLOUDFLARE_API_TOKEN.

install  Create Access app + allow policy for CLR_ACCESS_EMAIL
status   List Access apps matching hostname
EOF
}

read_token() {
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "$CLOUDFLARE_API_TOKEN"
    return
  fi
  if [[ -f "$TOKEN_FILE" ]]; then
    tr -d '[:space:]' <"$TOKEN_FILE"
    return
  fi
  echo "ERROR: Set CLOUDFLARE_API_TOKEN or create $TOKEN_FILE" >&2
  usage >&2
  exit 1
}

cf_api() {
  local method="$1" path="$2"
  shift 2
  curl -fsS -X "$method" \
    "https://api.cloudflare.com/client/v4${path}" \
    -H "Authorization: Bearer $(read_token)" \
    -H "Content-Type: application/json" \
    "$@"
}

cmd_status() {
  cf_api GET "/accounts/${ACCOUNT_ID}/access/apps/per_account" | python3 -m json.tool
}

cmd_install() {
  echo "Checking for existing Access app on ${HOSTNAME}…"
  local existing
  existing="$(cf_api GET "/accounts/${ACCOUNT_ID}/access/apps" | APP_HOST="$HOSTNAME" python3 -c "
import json, os, sys
host = os.environ.get('APP_HOST', '')
apps = json.load(sys.stdin).get('result', [])
for a in apps:
    d = a.get('domain', '')
    if host in d or d in host:
        print(a['id'])
        break
" 2>/dev/null || true)"

  local app_id
  if [[ -n "$existing" ]]; then
    app_id="$existing"
    echo "Using existing app id: $app_id"
  else
    echo "Creating Access application…"
    app_id="$(APP_NAME="$APP_NAME" APP_HOST="$HOSTNAME" APP_SESSION="$SESSION_DURATION" python3 -c "
import json, os
print(json.dumps({
  'name': os.environ['APP_NAME'],
  'domain': os.environ['APP_HOST'],
  'type': 'self_hosted',
  'session_duration': os.environ['APP_SESSION'],
  'auto_redirect_to_identity': True,
  'http_only_cookie_attribute': True,
  'same_site_cookie_attribute': 'strict',
}))
" | cf_api POST "/accounts/${ACCOUNT_ID}/access/apps" --data @- | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['id'])")"
    echo "Created app id: $app_id"
  fi

  echo "Adding allow policy for ${USER_EMAIL}…"
  if [[ -n "$USER_EMAIL_ALT" ]]; then
    APP_EMAIL="$USER_EMAIL" APP_EMAIL_ALT="$USER_EMAIL_ALT" python3 -c "
import json, os
print(json.dumps({
  'name': 'Allow owner emails',
  'decision': 'allow',
  'precedence': 1,
  'include': [
    {'email': {'email': os.environ['APP_EMAIL']}},
    {'email': {'email': os.environ['APP_EMAIL_ALT']}},
  ],
}))
" | cf_api POST "/accounts/${ACCOUNT_ID}/access/apps/${app_id}/policies" --data @- >/dev/null
  else
    APP_EMAIL="$USER_EMAIL" python3 -c "
import json, os
print(json.dumps({
  'name': 'Allow owner email',
  'decision': 'allow',
  'precedence': 1,
  'include': [{'email': {'email': os.environ['APP_EMAIL']}}],
}))
" | cf_api POST "/accounts/${ACCOUNT_ID}/access/apps/${app_id}/policies" --data @- >/dev/null
  fi

  echo ""
  echo "Cloudflare Access installed for https://${HOSTNAME}"
}

case "${1:-install}" in
  install) cmd_install ;;
  status) cmd_status ;;
  *) usage; exit 1 ;;
esac
