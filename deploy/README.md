# Remote web access (CLR on your Mac)

**CLR cannot run on Vercel.** It spawns the local Cursor `agent` CLI, reads your filesystem, and runs shell commands on your Mac. Vercel/serverless has no access to that.

Web access works by exposing the **local** CLR server (`localhost:3100`) through **Cloudflare Tunnel** on a hostname you own (e.g. `clr.rawshn.com`). Your Mac must stay **awake** while agents run.

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

## One-time setup

```bash
cd ~/Projects/cursor-local-remote

# 1. Strong auth token (rotates every 90 days)
./scripts/deploy/rotate-auth-token.sh --force
./scripts/deploy/install-token-rotation.sh install

# 2. Cloudflare Tunnel (requires Cloudflare login + rawshn.com on Cloudflare)
./scripts/deploy/install-cloudflare-tunnel.sh install

# 3. Reinstall CLR launch agent (reads token from ~/.cursor-local-remote/auth-token.json)
~/bin/clr-service-install.sh install
```

## URLs

| Where | URL |
|-------|-----|
| Local | `http://127.0.0.1:3100/?token=<token>` |
| Internet | `https://clr.rawshn.com/?token=<token>` |

Current token: `~/.cursor-local-remote/auth-token.json` (field `token`).

## Security

- Rotate token every 90 days (launchd job).
- **Cloudflare Access:** `scripts/deploy/install-cloudflare-access.sh` (requires API token in `~/.cursor-local-remote/cloudflare-api-token`)
- Never port-forward `:3100` on your router.

## Full API & deployment reference

See **[deploy/API.md](./API.md)** for endpoints, auth layers, launchd labels, setup commands, and troubleshooting.

## Mac sleep

CLR stops when the Mac **sleeps**. Display off + system awake is fine. Use AC power and disable system sleep for long remote jobs.

## macOS file access (Privacy)

CLR reads Cursor session files on disk. Use the **CLR Server** app bundle (not generic node):

```bash
~/Projects/cursor-local-remote/scripts/deploy/install-clr-app.sh
~/bin/clr-service-install.sh restart
```

Creates **`~/Applications/CLR.app`** (bundle ID `com.rawshn.clr`, shows as **CLR Server**).

**Full Disk Access:**

1. **System Settings → Privacy & Security → Full Disk Access**
2. Click **+** and select **`~/Applications/CLR.app`**
3. Enable the toggle for **CLR Server**

Or drag `CLR.app` from Finder into the list.

`clr-service-install.sh install` runs the app install step automatically.
