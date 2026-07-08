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

### 1. Cloudflare Access (internet)

- **Status:** active on `clr.rawshn.com`
- **Purpose:** identity login before traffic reaches CLR
- **Policy:** `mishra.roshanraj@gmail.com`, `mishraroshanraj@gmail.com`
- **Login:** Cloudflare account or Email one-time PIN
- **Dashboard:** [Zero Trust → Access → Applications](https://one.dash.cloudflare.com/a032322f2e5401950110e8845849dd4b/access/applications)

When Access is active, visiting `https://clr.rawshn.com` redirects to Cloudflare login first.

**CLR token bypass (public URL):** when these env vars are set on the CLR launch agent, a valid `Cf-Access-Jwt-Assertion` header auto-sets the `cr_session` cookie — no `?token=` needed:

| Env | Example |
|-----|---------|
| `AUTH_TRUST_CLOUDFLARE_ACCESS` | `1` |
| `CF_ACCESS_TEAM_DOMAIN` | `billowing-limit-310f.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Access app AUD (from Zero Trust app settings) |

LAN access (`http://<lan-ip>:3100`) still requires the CLR token (no Cf-Access headers).

### 2. CLR app token (LAN / API / fallback)

| Method | Usage |
|--------|--------|
| Query param | `?token=<token>` — sets `cr_session` httpOnly cookie (7 days) |
| Cookie | `cr_session` after first visit with token |
| Header | `Authorization: Bearer <token>` for API calls |
| Cloudflare Access JWT | auto-session on public URL when trust env is configured |

---

## Phone notifications (webhook)

Settings → **Webhook notifications**. CLR POSTs when an agent finishes.

| Service | URL / setup |
|---------|-------------|
| **ntfy** (recommended) | `https://ntfy.sh/your-secret-topic` — install [ntfy app](https://ntfy.sh), subscribe to same topic |
| **Slack** | Incoming webhook URL |
| **Discord** | Channel webhook URL |
| **Pushover** | `https://api.pushover.net/1/messages.json` (token + user in JSON) |
| **Custom** | Any JSON POST endpoint |

Use **Send test** in Settings to verify. Webhook links use `PUBLIC_URL` when set.

---

## PWA install (Android Chrome)

Requirements: HTTPS, valid manifest, registered service worker (`/sw.js`).

1. Sign in via Cloudflare Access at `https://clr.rawshn.com`
2. Enable **Suggest PWA install** in Settings
3. Chrome should show install banner / menu → **Install app**

If no prompt: Chrome ⋮ → **Install app** or **Add to Home screen**. Clear site data only via Settings → Clear cache (re-registers SW on reload).

**iOS:** no `beforeinstallprompt` — use Share → Add to Home Screen.

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
cd ~/Projects/cursor-local-remote && npm run build   # after UI/code changes
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
| `PUBLIC_URL` | `https://clr.rawshn.com` |
| `AUTH_TRUST_CLOUDFLARE_ACCESS` | `1` — skip CLR token when Access JWT validates |
| `CF_ACCESS_TEAM_DOMAIN` | `billowing-limit-310f.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Access app AUD from Zero Trust |
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
| macOS file access popup | Grant access to **CLR Server** (`~/.cursor-local-remote/bin/clr-server`), not generic node |
| MCP tools fail silently over CLR | Enable **Workspace trust** in Settings (`--force` for headless MCP). Default workspace must have an MCP catalog: `~/Projects` works; bare `~` does not. CLR auto-falls back to `~/Projects` when the selected workspace has no MCP tools. |
| Agent uses Grep/Read instead of notion-search | Workspace lacks MCP OAuth. Use **cursor-local-remote** project (has Notion token) or run `agent mcp login notion` once in that project folder on the Mac. CLR auto-picks the best authenticated workspace. |
| Composio Cloudflare MCP fails | Reconnect with API Token permissions |
| Old token (`wagon-kiosk`) | Use current token from `auth-token.json` |
| Chat forces scroll to bottom while agent runs | Update CLR. Scroll up to read history; tap **Follow live** to resume. See [docs/USER_GUIDE.md](../docs/USER_GUIDE.md) |
| Enter sends message instead of newline on phone | Update CLR. Touch devices: Enter = newline, tap **↑** to send. Desktop: Enter = send, Shift+Enter = newline. |
| `[REDACTED]` text in messages | Update CLR (transcript sanitizer). Empty tool-only turns no longer show placeholder text. |

---

*Last updated: July 2026*
