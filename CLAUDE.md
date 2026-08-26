# Claude Agent Entry — Cursor Local Remote

## Project

Local-network PWA to control Cursor CLI from phone/browser. Stack: Next.js, Tailwind v4 (`@theme` in `globals.css`), TypeScript.

CLR runs on your Mac (launchd or `clr` CLI), not Vercel. Optional internet access via Cloudflare Tunnel.

## Key paths

| Path | Purpose |
|------|---------|
| `src/lib/workspace-paths.ts` | **No folder** dir (`~/.cursor-local-remote/no-folder`) |
| `src/lib/workspace.ts` | Default workspace resolution |
| `src/lib/cursor-workspaces.ts` | Project list from Cursor IDE `state.vscdb` |
| `src/app/globals.css` | Design tokens, coarse-pointer scale (`@media (pointer: coarse)`) |
| `src/components/chat-input.tsx` | Composer: send, modes, images, Enter key behavior |
| `src/components/message-list.tsx` | Scroll pin, Follow live, touch scroll |
| `src/components/session-sidebar.tsx` | Project picker (**No folder** pinned) |
| `bin/cursor-remote.mjs` | CLI entry (`clr`), starts Next.js on port 3100 |
| `scripts/deploy/clr-start.sh` | LaunchAgent start wrapper |
| `scripts/deploy/clr-service-install.sh` | Install/restart CLR launchd service |
| `docs/USER_GUIDE.md` | End-user docs (scroll, queue, PWA, composer) |
| `deploy/README.md` | Cloudflare Tunnel setup |
| `deploy/API.md` | Full API, auth, launchd, troubleshooting |

## Design system

Always read `DESIGN.md` before any visual or UI decisions.

All font choices, colors, spacing, and aesthetic direction are defined there. Do not deviate without explicit user approval.

In QA mode, flag any code that does not match `DESIGN.md`.

## Conventions

- Semantic Tailwind tokens (`bg-bg-surface`, `text-text-muted`), not ad hoc hex in components.
- Mobile-first: safe areas, touch targets (`--clr-touch-min`), scroll pin in `message-list.tsx`.
- Coarse pointer detection: `useCoarsePointer()` hook mirrors `globals.css` `(pointer: coarse)` media query.
- No em dashes in user-facing strings or docs.
- Default workspace is **No folder**, not `$HOME`.

## Mobile UX (agent checklist)

- **Enter key:** On coarse pointer (phone/tablet), Enter = newline; send via ↑ button. Desktop: Enter = send, Shift+Enter = newline (`chat-input.tsx`).
- **Scroll while streaming:** User can scroll up; auto-scroll only when pinned to bottom. **Follow live** pill resumes (`message-list.tsx`).
- **Touch targets:** 44px min via `--clr-touch-min` and `.icon-btn` in `globals.css`.

## Local development

```bash
cd cursor-local-remote
npm install
npm run dev          # dev server (port from bin/dev.mjs)
npm run build        # production build (.next/) required before launchd restart
npm run lint
```

## Deploy / restart (launchd)

```bash
cd cursor-local-remote
npm run build
~/bin/clr-service-install.sh restart
# or: launchctl kickstart -k gui/$(id -u)/com.cursor-local-remote.server
```

Tunnel (if installed): `launchctl kickstart -k gui/$(id -u)/com.cursor-local-remote.cloudflared`

Auth token: `~/.cursor-local-remote/auth-token.json` (field `token`).

## API quick reference

All `/api/*` require `cr_session` cookie or `Authorization: Bearer <token>`.

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/chat` | POST | `{ prompt, sessionId?, model?, mode?, workspace? }` |
| `/api/sessions` | GET/PATCH/DELETE | List, archive, delete |
| `/api/sessions/watch` | GET (SSE) | Live session updates |
| `/api/git` | GET/POST | Status, diff, commit, push |
| `/api/info` | GET | Workspace, network URL |
| `/api/projects` | GET | Projects + **No folder** |

Full reference: `deploy/API.md`.

## Troubleshooting (agents)

| Issue | Where to look |
|-------|---------------|
| 401 on remote | `auth-token.json`, Cloudflare Access, `?token=` |
| Agent failed to start | Cursor CLI auth: run `agent login` on the Mac. Logs: `~/.cursor-local-remote/logs/clr.err.log` |
| Changes not live | Run `npm run build` then `clr-service-install.sh restart` |
| MCP fails remotely | Settings → Workspace trust; pick project with MCP auth on Mac; optional `CLR_MCP_WORKSPACE` |
| Mac file access popup | `scripts/deploy/install-clr-app.sh`, Full Disk Access for CLR Server |

More: `deploy/API.md#troubleshooting`, `docs/USER_GUIDE.md`.
