# CLR user guide

Quick reference for using **Cursor Local Remote** on phone, tablet, or browser.

## Connect

| Method | Steps |
|--------|--------|
| **LAN (same Wi‑Fi)** | Run `clr` on your Mac. Scan the QR code or open the printed URL. |
| **Internet** | Use your Cloudflare URL (e.g. `https://clr.example.com`). Sign in with Access, then bookmark with `?token=` if needed. See [deploy/README.md](../deploy/README.md). |

Token is printed in the terminal or stored in `~/.cursor-local-remote/auth-token.json` when using launchd.

## Chat while the agent runs

CLR **does not lock you to the bottom** of the chat while the agent is working.

1. **Scroll up** anytime to read earlier messages or tool output.
2. A **Follow live** pill appears above the input when you are not pinned to the bottom.
3. Tap it (or scroll to the bottom) to resume following new output.

Auto-scroll only runs when you are already at the bottom of the thread.

## Modes and queue

| Control | Behavior |
|---------|----------|
| **Agent / Ask / Plan** | Same modes as Cursor desktop CLI. |
| **Stop** | Halts the current agent run. |
| **+ (while streaming)** | Queues your message for after the current turn. |
| **Send now** (queued card) | Stops current run and sends that message immediately. |

## Composer (typing)

| Device | Enter key | Send |
|--------|-----------|------|
| **Phone / tablet** | New line (paragraph break) | Tap the **↑** button |
| **Desktop keyboard** | Send message | **Shift+Enter** for a new line |

On touch devices the hint below the mode pills shows `↵ newline · ↑ send`.

## Sessions and projects

- **Sidebar (☰)** — switch projects, open past sessions, start a new chat.
- Sessions started in CLR may not appear in the desktop sidebar (Cursor limitation). File edits and terminal still run on your Mac.
- **Star** projects in the sidebar to pin them at the top.

## Notifications

- **In-tab:** title flash + sound when the agent finishes (if the tab is in the background).
- **Webhook:** Settings → paste ntfy, Slack, or Discord URL → **Send test**.

## PWA (install to home screen)

- **Android Chrome:** Settings → enable **Suggest PWA install**, or Chrome menu → Install app.
- **iOS Safari:** Share → **Add to Home Screen** (dismissible hint shown once).

Requires HTTPS for remote access.

## Settings worth knowing

| Setting | Why |
|---------|-----|
| **Workspace trust** | Required for MCP tools (Notion, Composio) over remote. |
| **Default model** | Used for new sessions from this browser. |
| **Clear cache** | Fixes stale UI or service worker after upgrades. |

## Troubleshooting

| Problem | What to do |
|---------|------------|
| Chat jumps to bottom while reading | Update CLR (scroll pin fix). Scroll up; use **Follow live** only when you want to catch up. |
| Enter sends instead of newline on phone | Update CLR. On touch devices, Enter adds a line; tap **↑** to send. |
| `[REDACTED]` in old messages | Update CLR; transcripts strip Cursor redaction placeholders. Reload session. |
| MCP / Notion not working | Enable **Workspace trust**. Pick a project that has MCP logged in on the Mac (e.g. `~/Projects/cursor-local-remote`). |
| 401 on remote URL | Add `?token=` from `auth-token.json` or complete Cloudflare Access login. |
| Agent stops mid-task | Mac slept. Keep Mac awake on power for long remote jobs. |
| macOS privacy popup | Install **CLR Server** app: `scripts/deploy/install-clr-app.sh`, grant Full Disk Access to CLR Server. |

Full deployment and API details: [deploy/API.md](../deploy/API.md).
