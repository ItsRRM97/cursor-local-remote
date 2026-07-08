# Design System — Cursor Local Remote (CLR)

## Product Context

- **What this is:** A local-network PWA that lets you chat with Cursor's CLI agent, manage sessions, git, and terminal from phone or browser.
- **Who it's for:** Developers who already use Cursor on a Mac and want remote control without cloud accounts or extra infrastructure.
- **Space/industry:** Developer tools, remote IDE control, terminal-adjacent productivity.
- **Project type:** Mobile-first web app (PWA), dark-only.

## Memorable Thing

**Calm cockpit control of your Mac's agent from anywhere.**

Every screen should feel like a focused ops console: readable at arm's length, never flashy, always clear what the agent is doing and what you can do next.

## Aesthetic Direction

- **Direction:** Night Cockpit
- **Decoration level:** Intentional (structure and hierarchy, almost no ornament)
- **Mood:** Quiet confidence. Dense information when needed, generous touch targets when acting. No "AI startup" gradients or purple glow.
- **Reference posture:** Terminal discipline (iTerm, Warp) plus mobile chat ergonomics (Telegram, iMessage composer patterns), not marketing SaaS dashboards.

## Typography

- **Display/Hero:** IBM Plex Sans 600 — technical but human; distinct from Inter/Geist defaults.
- **Body:** IBM Plex Sans 400 — long transcript readability at 13–15px on phone.
- **UI/Labels:** IBM Plex Sans 500 — mode pills, settings rows, sidebar labels.
- **Data/Tables:** IBM Plex Sans 400 with `font-variant-numeric: tabular-nums` on git stats, timestamps, model IDs.
- **Code:** IBM Plex Mono — tool output, diffs, inline code; pairs with sans without feeling like a different product.
- **Loading:** `next/font/google` for Plex Sans + Plex Mono (self-hosted, no runtime CDN dependency).
- **Scale:**
  - `2xs` 10px / 0.625rem — meta labels (Queued, timestamps)
  - `xs` 11px / 0.6875rem — section labels, uppercase tracking
  - `sm` 12px / 0.75rem — secondary UI, Follow live pill
  - `base` 13px / 0.8125rem — chat body, settings rows (default)
  - `md` 14px / 0.875rem — emphasized body
  - `lg` 16px / 1rem — empty states, sheet titles
  - `xl` 20px / 1.25rem — rare page titles only

## Color

- **Approach:** Restrained. One accent hue for "live" and primary actions; neutrals carry most of the UI.
- **Primary (live / focus):** `#5eead4` (phosphor cyan) — streaming dot, Follow live, focus rings, active mode. Use sparingly.
- **Secondary:** `#94a3b8` (cool slate) — links, secondary buttons, icon default on hover path.
- **Neutrals (cool charcoal, not pure black):**
  - `bg` `#0c0c0e`
  - `bg-elevated` `#121214`
  - `bg-surface` `#18181b`
  - `bg-hover` `#222226`
  - `bg-active` `#2a2a2f`
  - `border` `#2e2e33`
  - `border-subtle` `#1f1f23`
  - `text` `#ececf0`
  - `text-secondary` `#a1a1aa`
  - `text-muted` `#71717a`
- **Semantic:**
  - success `#34d399` — done, toggle on, connected
  - warning `#fbbf24` — queue, caution banners
  - error `#f87171` — failures, destructive hover
  - info `#60a5fa` — optional tips (use rarely)
- **Dark mode:** Single theme only. Surfaces step up in lightness; accent saturation unchanged. Avoid pure `#000` backgrounds (OLED crush, harsh scroll edges).

## Spacing

- **Base unit:** 4px
- **Density:** Comfortable-mobile (44px min touch targets on primary actions)
- **Scale:** 2xs(2) xs(4) sm(8) md(12) lg(16) xl(24) 2xl(32) 3xl(48)
- **Chat:** Message vertical rhythm `py-3` (12px). Composer safe area via `env(safe-area-inset-bottom)`.

## Layout

- **Approach:** Single-column chat with overlay sheets (sidebar, settings, QR).
- **Grid:** Full viewport; no multi-column desktop requirement. `sm:` breakpoint widens settings sheet to 300px rail.
- **Max content width:** None for chat (full bleed). Markdown `max-w-none` with comfortable line length via `prose` tuning (~70ch where prose applies).
- **Border radius:**
  - `sm` 6px — inputs, small chips
  - `md` 10px — user bubbles, cards
  - `lg` 14px — sheets, modals
  - `full` 9999px — Follow live pill, toggles

## Motion

- **Approach:** Minimal-functional
- **Easing:** enter `cubic-bezier(0, 0, 0.2, 1)` · exit `cubic-bezier(0.4, 0, 1, 1)` · move `cubic-bezier(0.4, 0, 0.2, 1)`
- **Duration:** micro 80ms · short 150ms · medium 250ms · long 400ms
- **Allowed:** Sheet slide, opacity on overlays, streaming pulse on status dot, haptics on send/stop (native bridge when available).
- **Forbidden:** Parallax, bounce, decorative loaders, auto-playing layout shifts during scroll.

## Component Patterns

| Pattern | Rule |
|--------|------|
| User message | `bg-surface`, `rounded-md`, 13px body, no avatar clutter |
| Assistant | Full-width markdown, no bubble border |
| Tool cards | `border-border`, mono for paths/commands, collapsible |
| Follow live | `rounded-full`, elevated surface, cyan border tint when streaming |
| Settings toggles | Green when on (success), not iOS blue |
| Git panel | Tabular nums for line counts; diff colors unchanged semantically |
| Header project label | `text-clr-header-project` (14px coarse / 13px fine), `flex-1 min-w-0 truncate`, `title` for full name |
| Project picker | "Current project" pill with check + accent; starred rows use `project-picker-active`; "Browse all projects" opens full list |

## Accessibility

- Contrast: body text on `bg` ≥ 7:1; muted text ≥ 4.5:1 on surfaces.
- Focus: visible `ring-2 ring-[primary] ring-offset-2 ring-offset-bg` on keyboard focus (desktop).
- Touch: minimum 44×44px hit area for icon buttons (padding negative margin pattern already used).
- Motion: respect `prefers-reduced-motion` (disable pulse, shorten transitions).

## Implementation Notes

- Tokens live in `src/app/globals.css` under `@theme` and must match this document.
- Components use Tailwind semantic classes (`bg-bg-surface`, `text-text-muted`) not raw hex in TSX.
- New UI work: read this file first; flag QA mismatches in review.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-08 | Night Cockpit direction | Serves memorable thing: calm remote control, not generic AI chat |
| 2026-07-08 | IBM Plex Sans + Mono | Replace overused Inter; dev-tool appropriate, excellent legibility |
| 2026-07-08 | Phosphor cyan accent | Single memorable hue for "live" without purple AI cliché |
| 2026-07-08 | Cool charcoal vs pure black | Better scroll edges, less eye strain on OLED phones |
| 2026-07-08 | Dark-only | Product is used at night/on couch; no light theme maintenance cost |
