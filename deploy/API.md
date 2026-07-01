# CLR remote deployment & API reference

Private fork: https://github.com/ItsRRM97/cursor-local-remote

## Architecture

```
Browser / phone (anywhere)
    │  HTTPS
    ▼
Cloudflare Edge (TLS, optional Access OAuth)
    │  Cloudflare Tunnel (outbound from Mac)
    ▼
cloudflared (launchd) ──► http://127.0.0.1:3100
    ▼
cursor-local-remote (Next.js)
    ▼
agent CLI ──► local filesystem + shell
```

**CLR cannot run on Vercel or serverless.** The Mac must stay **awake** while agents execute.

---

## Live endpoints

| Environment | Base URL |
|-------------|----------|
| **Internet** | `https://clr.rawshn.com` |
| **LAN** | `http://<mac-lan-ip>:3100` |
| **Local** | `http://127.0.0.1:3100` |

### Bookmark URL (phone)

```
https://clr.rawshn.com/?token=<token-from-auth-file>
```

Current token file: `~/.cursor-local-remote/auth-token.json` (field `token`).

Read token:

```bash
python3 -c "import json; print(json.load(open('$HOME/.cursor-local-remote/auth-token.json'))['token'])"
```

Token rotates every **90 days** (launchd: `com.rawshn.clr-token-rotation`).

---

## Auth layers

### 1. Cloudflare Access (recommended, internet only)

- **Status:** configure via `scripts/deploy/install-cloudflare-access.sh`
- **Purpose:** Google/GitHub/email OTP login before traffic reaches CLR
- **Policy:** allow `mishra.roshanraj@gmail.com` only
- **Dashboard:** [Zero Trust → Access → Applications](https://one.dash.cloudflare.com/?to=/:account/access/applications)

When Access is active, visiting `https://clr.rawshn.com` redirects to Cloudflare login first.

### 2. CLR app token (always required)

| Method | Usage |
|--------|--------|
| Query param | `?token=<token>` — sets `cr_session` httpOnly cookie (7 days) |
| Cookie | `cr_session` after first visit with token |
| Header | `Authorization: Bearer <token>` for API calls |

Without a valid CLR token: **401 Unauthorized**.

---

## CLR HTTP API

All `/api/*` routes require CLR auth (cookie or `Bearer`).

Base: `https://clr.rawshn.com` or `http://127.0.0.1:3100`

### Info & health

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.cursor-local-remote/auth-token.json'))['token'])")
curl -sS -H "Authorization: Bearer $TOKEN" https://clr.rawshn.com/api/info | python3 -m json.tool
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/info` | GET | Workspace path, network URL, auth URL |
| `/api/models` | GET | Available models (`agent models`, cached 5 min) |
| `/api/projects` | GET | Discovered Cursor projects |
| `/api/settings` | GET | CLR settings |
| `/api/settings` | PATCH | `{ "key", "value" }` |

### Chat & sessions

| Endpoint | Method | Body / query | Description |
|----------|--------|--------------|-------------|
| `/api/chat` | POST | `{ prompt, sessionId?, model?, mode?, workspace? }` | Send prompt to agent |
| `/api/sessions` | GET | `?workspace=&archived=true` | List sessions |
| `/api/sessions` | PATCH | `{ action, sessionId? }` | Archive/unarchive |
| `/api/sessions` | DELETE | `{ sessionId }` | Delete session |
| `/api/sessions/active` | GET | — | Running agent session IDs |
| `/api/sessions/active` | DELETE | `{ sessionId }` | Kill running agent |
| `/api/sessions/history` | GET | `?id=&workspace=` | Full transcript |
| `/api/sessions/watch` | GET | `?id=&workspace=` | SSE live updates |

### Git, terminal, uploads

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/git` | GET | `?workspace=&detail=status\|diff\|branches` |
| `/api/git` | POST | `{ action, workspace?, message?, files?, branch? }` |
| `/api/terminal` | POST | Start terminal session |
| `/api/terminal/stream` | GET | Terminal output stream |
| `/api/terminal/input` | POST | Send terminal input |
| `/api/upload` | POST | multipart image upload |
| `/api/notifications/test` | POST | Test webhook notification |

### Example: send a prompt

```bash
curl -sS -X POST https://clr.rawshn.com/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"List files in workspace","workspace":"/Users/rawshn/Projects"}'
```

---

## macOS services (launchd)

| Label | Purpose |
|-------|---------|
| `com.rawshn.cursor-local-remote` | CLR server (`clr-start.sh`, port 3100, KeepAlive) |
| `com.rawshn.clr-cloudflared` | Cloudflare Tunnel (`clr-rawshn` → `clr.rawshn.com`) |
| `com.rawshn.clr-token-rotation` | Rotate AUTH_TOKEN every 90 days |

### Manage CLR

```bash
~/bin/clr-service-install.sh status
~/bin/clr-service-install.sh restart
launchctl kickstart -k gui/$(id -u)/com.rawshn.cursor-local-remote
```

### Manage tunnel

```bash
~/Projects/cursor-local-remote/scripts/deploy/install-cloudflare-tunnel.sh status
launchctl kickstart -k gui/$(id -u)/com.rawshn.clr-cloudflared
```

### Rotate token manually

```bash
~/Projects/cursor-local-remote/scripts/deploy/rotate-auth-token.sh --force
# Update phone bookmark with new token from auth-token.json
```

---

## One-time setup (reference)

```bash
cd ~/Projects/cursor-local-remote

# 1. Auth token + rotation
./scripts/deploy/rotate-auth-token.sh --force
./scripts/deploy/install-token-rotation.sh install

# 2. Cloudflare Tunnel
./scripts/deploy/install-cloudflare-tunnel.sh install

# 3. Cloudflare Access (needs API token — see below)
# Save token: ~/.cursor-local-remote/cloudflare-api-token
./scripts/deploy/install-cloudflare-access.sh install

# 4. CLR launch agent
~/bin/clr-service-install.sh install
```

### Cloudflare API token (for Access script)

Create at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) with **Edit Cloudflare Zero Trust** permission.

```bash
chmod 600 ~/.cursor-local-remote/cloudflare-api-token
# paste token into file, then:
~/Projects/cursor-local-remote/scripts/deploy/install-cloudflare-access.sh install
```

**Composio Cloudflare MCP:** if `CLOUDFLARE_LIST_ACCOUNTS` returns `Invalid format for X-Auth-Key`, reconnect the Cloudflare integration in Composio with a valid **API Token** (not Global API Key).

---

## Configuration files

| Path | Purpose |
|------|---------|
| `~/.cursor-local-remote/auth-token.json` | CLR token + expiry |
| `~/.cursor-local-remote/cloudflare-api-token` | Cloudflare API token (optional) |
| `~/.cloudflared/config.yml` | Tunnel ingress (`clr.rawshn.com` → `:3100`) |
| `~/Library/LaunchAgents/com.rawshn.cursor-local-remote.plist` | CLR service |
| `~/Library/LaunchAgents/com.rawshn.clr-cloudflared.plist` | Tunnel service |
| `~/bin/clr-start.sh` | CLR start wrapper |
| `~/bin/clr-service-install.sh` | Install/reload CLR plist |

### Environment variables (CLR launch agent)

| Variable | Value |
|----------|--------|
| `AUTH_TOKEN` | From `auth-token.json` (via `clr-service-install.sh`) |
| `CURSOR_DEFAULT_MODEL` | `auto` |
| Workspace | `/Users/rawshn` (plist `ProgramArguments`) |

---

## Security checklist

- [ ] Cloudflare Access on `clr.rawshn.com` (owner email only)
- [ ] Strong random CLR token (90-day rotation enabled)
- [ ] Do **not** port-forward `:3100` on router
- [ ] Mac awake on AC for remote sessions
- [ ] `CURSOR_TRUST` unset (agent asks before destructive actions)
- [ ] Bookmark URL treated as secret

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 401 on public URL | Add `?token=` or `Authorization: Bearer` header |
| Cloudflare login loop | Complete Access policy for your email |
| Tunnel down | `launchctl kickstart -k gui/$(id -u)/com.rawshn.clr-cloudflared` |
| Agent stops mid-task | Mac slept — disable system sleep on AC |
| Composio Cloudflare MCP fails | Reconnect with API Token permissions |
| Old token (`wagon-kiosk`) | Use current token from `auth-token.json` |

---

*Last updated: July 2026*
