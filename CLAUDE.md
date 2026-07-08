# Claude Agent Entry — Cursor Local Remote

Bootstrap: `/Users/rawshn/AGENTS.md` (global skills registry).

## Project

Local-network PWA to control Cursor CLI from phone/browser. Stack: Next.js, Tailwind v4 (`@theme` in `globals.css`), TypeScript.

Key paths:

- `src/app/globals.css` — design tokens
- `src/components/` — UI (chat, sidebar, settings, git, terminal)
- `docs/USER_GUIDE.md` — end-user docs
- `deploy/` — Cloudflare remote access

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.

All font choices, colors, spacing, and aesthetic direction are defined there. Do not deviate without explicit user approval.

In QA mode, flag any code that does not match `DESIGN.md`.

## Conventions

- Semantic Tailwind tokens (`bg-bg-surface`, `text-text-muted`), not ad hoc hex in components.
- Mobile-first: safe areas, touch targets, scroll pin behavior documented in `docs/USER_GUIDE.md`.
- No em dashes in user-facing strings or docs.
