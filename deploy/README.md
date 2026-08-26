# Remote web access (CLR on your Mac)

**CLR cannot run on Vercel.** It spawns the local Cursor `agent` CLI, reads your filesystem, and runs shell commands on your Mac. Vercel/serverless has no access to that.

Web access works by exposing the **local** CLR server (`localhost:3100`) through **Cloudflare Tunnel** on a hostname you own (e.g. `clr.example.com`). Your Mac must stay **awake** while agents run.

## Architecture

```
Phone / browser (anywhere)
    │ HTTPS
    ▼
Cloudflare (TLS + optional Access OAuth)
    │ outbound tunnel
    ▼
cloudflared on Mac ──► http://127.0.0.1:3100 ──► agent CLI ──► your files
```

## Quick start (LAN only)

```bash
git clone https://github.com/ItsRRM97/cursor-local-remote.git
cd cursor-local-remote
npm install
npm run build
npm run dev   # or: npx cursor-local-remote
```

Scan the QR code in the terminal from your phone on the same Wi-Fi.

Default workspace is **No folder** (`~/.cursor-local-remote/no-folder`), matching Cursor IDE "continue without a folder". Pick a project in the sidebar when you need a repo.

## Optional: internet access (Cloudflare)

```bash
cd cursor-local-remote

# 1. Auth token (required for remote API access)
./scripts/deploy/rotate-auth-token.sh --force
./scripts/deploy/install-token-rotation.sh install

# 2. Tunnel (set hostname + Cloudflare login)
export CLR_PUBLIC_HOSTNAME=clr.example.com
./scripts/deploy/install-cloudflare-tunnel.sh install

# 3. Optional: Cloudflare Access (set account + email env vars first)
export CLOUDFLARE_ACCOUNT_ID=...
export CLR_PUBLIC_HOSTNAME=clr.example.com
export CLR_ACCESS_EMAIL=you@example.com
./scripts/deploy/install-cloudflare-access.sh install

# 4. LaunchAgent (reads token from ~/.cursor-local-remote/auth-token.json)
./scripts/deploy/clr-service-install.sh install
```

Set `PUBLIC_URL`, `CF_ACCESS_*` env vars before `clr-service-install.sh install` if you use Cloudflare Access.

## URLs

| Where | URL |
|-------|-----|
| Local | `http://127.0.0.1:3100/?token=<token>` |
| Internet | `https://<your-hostname>/?token=<token>` |

Token file: `~/.cursor-local-remote/auth-token.json` (field `token`).

## Security

- Use a strong random token (`rotate-auth-token.sh --force`).
- Optional Cloudflare Access in front of your hostname.
- Never port-forward `:3100` on your router.

## Full API reference

See **[deploy/API.md](./API.md)** for endpoints, auth, launchd labels, and troubleshooting.

**User guide:** [docs/USER_GUIDE.md](../docs/USER_GUIDE.md)

## Apply code changes

```bash
npm run build
~/bin/clr-service-install.sh restart
```

## macOS file access (Privacy)

Install **CLR Server** for Full Disk Access (not generic node):

```bash
./scripts/deploy/install-clr-app.sh
~/bin/clr-service-install.sh restart
```

Creates **`~/Applications/CLR.app`** (bundle ID `com.cursor-local-remote.server`, shows as **CLR Server**).

System Settings → Privacy & Security → Full Disk Access → add **CLR Server**.
