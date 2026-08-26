# CLR remote deployment & API reference

Repository: https://github.com/ItsRRM97/cursor-local-remote

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
| **Internet** | `https://<your-hostname>` (set `PUBLIC_URL` / `CLR_PUBLIC_HOSTNAME`) |
| **LAN** | `http://<mac-lan-ip>:3100` |
| **Local** | `http://127.0.0.1:3100` |

### Bookmark URL (phone)

```
https://<your-hostname>/?token=<token-from-auth-file>
```

Current token file: `~/.cursor-local-remote/auth-token.json` (field `token`).

Read token:

```bash
python3 -c "import json; print(json.load(open('$HOME/.cursor-local-remote/auth-token.json'))['token'])"
```

Token rotates every **90 days** when `install-token-rotation.sh` is installed (launchd label: `com.cursor-local-remote.token-rotation` by default).

---

## Auth layers

### 1. Cloudflare Access (internet, optional)

Configure with `install-cloudflare-access.sh`. Set `CLOUDFLARE_ACCOUNT_ID`, `CLR_PUBLIC_HOSTNAME`, and `CLR_ACCESS_EMAIL` before install.

When Access is active, visiting your public hostname redirects to Cloudflare login first.

**CLR token bypass (public URL):** when these env vars are set on the CLR launch agent, a valid `Cf-Access-Jwt-Assertion` header auto-sets the `cr_session` cookie — no `?token=` needed:

| Env | Example |
|-----|---------|
| `AUTH_TRUST_CLOUDFLARE_ACCESS` | `1` |
| `CF_ACCESS_TEAM_DOMAIN` | `your-team.cloudflareaccess.com` |
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

1. Sign in via Cloudflare Access at your public URL (if configured)
2. Enable **Suggest PWA install** in Settings
3. Chrome should show install banner / menu → **Install app**

If no prompt: Chrome ⋮ → **Install app** or **Add to Home screen**. Clear site data only via Settings → Clear cache (re-registers SW on reload).

**iOS:** no `beforeinstallprompt` — use Share → Add to Home Screen.

---

## CLR HTTP API

All `/api/*` routes require CLR auth (cookie or `Bearer`).

Base: `https://<your-hostname>` or `http://127.0.0.1:3100`

### Info & health

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.cursor-local-remote/auth-token.json'))['token'])")
curl -sS -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3100/api/info | python3 -m json.tool
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/info` | GET | Workspace path, network URL, auth URL |
| `/api/models` | GET | Available models (`agent models`, cached 5 min) |
| `/api/projects` | GET | Discovered Cursor projects (includes **No folder**) |
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
curl -sS -X POST http://127.0.0.1:3100/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"List files in workspace","workspace":"'"$HOME"'/.cursor-local-remote/no-folder"}'
```

---

## macOS services (launchd)

Default labels (override via env at install time):

| Label | Purpose |
|-------|---------|
| `com.cursor-local-remote.server` | CLR server (`clr-start.sh`, port 3100, KeepAlive) |
| `com.cursor-local-remote.cloudflared` | Cloudflare Tunnel |
| `com.cursor-local-remote.token-rotation` | Rotate AUTH_TOKEN every 90 days |

### Manage CLR

```bash
cd cursor-local-remote && npm run build   # after UI/code changes
~/bin/clr-service-install.sh status
~/bin/clr-service-install.sh restart
launchctl kickstart -k gui/$(id -u)/com.cursor-local-remote.server
```

### Manage tunnel

```bash
./scripts/deploy/install-cloudflare-tunnel.sh status
launchctl kickstart -k gui/$(id -u)/com.cursor-local-remote.cloudflared
```

### Rotate token manually

```bash
./scripts/deploy/rotate-auth-token.sh --force
# Update phone bookmark with new token from auth-token.json
```

---

## One-time setup (reference)

```bash
cd cursor-local-remote

# 1. Auth token + rotation
./scripts/deploy/rotate-auth-token.sh --force
./scripts/deploy/install-token-rotation.sh install

# 2. Cloudflare Tunnel
export CLR_PUBLIC_HOSTNAME=clr.example.com
./scripts/deploy/install-cloudflare-tunnel.sh install

# 3. Cloudflare Access (optional)
export CLOUDFLARE_ACCOUNT_ID=...
export CLR_PUBLIC_HOSTNAME=clr.example.com
export CLR_ACCESS_EMAIL=you@example.com
# Save API token: ~/.cursor-local-remote/cloudflare-api-token
./scripts/deploy/install-cloudflare-access.sh install

# 4. CLR launch agent
export PUBLIC_URL=https://clr.example.com   # if using tunnel
~/bin/clr-service-install.sh install
```

### Cloudflare API token (for Access script)

Create at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) with **Edit Cloudflare Zero Trust** permission.

```bash
chmod 600 ~/.cursor-local-remote/cloudflare-api-token
# paste token into file, then:
./scripts/deploy/install-cloudflare-access.sh install
```

---

## Configuration files

| Path | Purpose |
|------|---------|
| `~/.cursor-local-remote/auth-token.json` | CLR token + expiry |
| `~/.cursor-local-remote/no-folder/` | Default scratch workspace (**No folder**) |
| `~/.cursor-local-remote/cloudflare-api-token` | Cloudflare API token (optional) |
| `~/.cloudflared/config.yml` | Tunnel ingress (`<hostname>` → `:3100`) |
| `~/Library/LaunchAgents/com.cursor-local-remote.server.plist` | CLR service |
| `~/Library/LaunchAgents/com.cursor-local-remote.cloudflared.plist` | Tunnel service |
| `~/bin/clr-start.sh` | CLR start wrapper |
| `~/bin/clr-service-install.sh` | Install/reload CLR plist |

### Environment variables (CLR launch agent)

| Variable | Description |
|----------|-------------|
| `AUTH_TOKEN` | From `auth-token.json` (via `clr-service-install.sh`) |
| `PUBLIC_URL` | Public HTTPS URL for webhooks and `/api/info` |
| `AUTH_TRUST_CLOUDFLARE_ACCESS` | `1` — skip CLR token when Access JWT validates |
| `CF_ACCESS_TEAM_DOMAIN` | Cloudflare Access team domain |
| `CF_ACCESS_AUD` | Access app AUD from Zero Trust |
| `CLR_PROJECT_ROOTS` | Colon-separated extra project scan roots |
| `CLR_MCP_WORKSPACE` | Optional MCP workspace override |
| `CURSOR_DEFAULT_MODEL` | Default model (e.g. `auto`) |

Default workspace: `~/.cursor-local-remote/no-folder` (not `$HOME`).

---

## Security checklist

- [ ] Cloudflare Access on your hostname (if exposed to internet)
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
| Agent failed to start / not authenticated | Cursor CLI login expired. On the Mac run `agent login`, then retry. Optional: set `CURSOR_API_KEY` on the launch agent. |
| Cloudflare login loop | Complete Access policy for your email |
| Tunnel down | `launchctl kickstart -k gui/$(id -u)/com.cursor-local-remote.cloudflared` |
| Agent stops mid-task | Mac slept — disable system sleep on AC |
| macOS file access popup | Grant access to **CLR Server** (`~/Applications/CLR.app`), not generic node |
| MCP tools fail silently over CLR | Enable **Workspace trust** in Settings. Pick a project with MCP logged in on the Mac. Optional override: `CLR_MCP_WORKSPACE`. |
| Agent uses built-in tools instead of MCP | Selected workspace lacks MCP OAuth. Run `agent mcp login <server>` in that project folder on the Mac. |
| UI changes not visible after deploy | Run `npm run build` then `clr-service-install.sh restart` |
| Chat forces scroll to bottom while agent runs | Update CLR. Scroll up to read history; tap **Follow live** to resume. See [docs/USER_GUIDE.md](../docs/USER_GUIDE.md) |
| Enter sends message instead of newline on phone | Update CLR. Touch devices: Enter = newline, tap **↑** to send. Desktop: Enter = send, Shift+Enter = newline. |
| `[REDACTED]` text in messages | Update CLR (transcript sanitizer). Empty tool-only turns no longer show placeholder text. |

---

*Last updated: August 2026*
