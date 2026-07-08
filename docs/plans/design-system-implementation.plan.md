# Plan: CLR Design System Implementation

**Status:** Reviewed (autoplan) · **Date:** 2026-07-08  
**Premise:** CLR has functional UX (scroll pin, redaction strip, PWA) but no design source of truth. Tokens are generic dark gray + Inter. This plan aligns code with `DESIGN.md` (Night Cockpit) without feature creep.

---

## Premise Gate (human-confirmed via product context)

| Question | Answer |
|----------|--------|
| Problem | UI reads as anonymous dark SaaS; typography and accent do not reinforce "calm cockpit" positioning |
| Success | `DESIGN.md` exists; `globals.css` tokens match; Plex fonts load; top surfaces visually coherent on phone |
| Out of scope | Light theme, marketing site, logo rebrand, new features |

**Memorable thing:** Calm cockpit control of your Mac's agent from anywhere.

---

## Scope

### In scope

1. Update `@theme` tokens in `globals.css` per `DESIGN.md`
2. Add `next/font/google` IBM Plex Sans + Mono in `layout.tsx`; wire CSS variables
3. Add `prefers-reduced-motion` rules in `globals.css`
4. Visual pass on high-traffic components:
   - `message-list.tsx` (empty state, Follow live, streaming row)
   - `chat-input.tsx` (composer, mode/model chips)
   - `message-bubble.tsx` (user bubble radius)
   - `session-sidebar.tsx` (list density, active row)
   - `settings-panel.tsx` (sheet, toggles)
   - `tool-call-card.tsx`, `markdown.tsx` (code blocks)
5. Update `viewport.themeColor` to match new `bg`
6. Cross-link `DESIGN.md` from `README.md` (one line under Features or dev section)

### Out of scope

- Screenshot refresh in README/demo
- Git panel diff color overhaul (semantic colors already work)
- Terminal xterm theme (follow-up if contrast fails QA)

---

## Implementation Steps

### Step 1: Tokens (globals.css)

Replace current palette with DESIGN.md neutrals + cyan accent. Add:

```css
--color-primary: #5eead4;
--color-primary-dim: #5eead418;
--font-sans: var(--font-plex-sans), ...;
--font-mono: var(--font-plex-mono), ...;
```

Map legacy `--color-accent` to primary or text per usage audit (accent was near-white; migrate "live" usages to `primary`).

### Step 2: Fonts (layout.tsx)

```tsx
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
```

Apply variable classes on `<html>` or `<body>`.

### Step 3: Component audit

Grep for `text-[`, hardcoded grays, `bg-success` stays. Replace streaming indicators to use `text-primary` / `bg-primary` where appropriate.

### Step 4: Motion guard

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Step 5: Verify

- `npm run build`
- Manual: phone or narrow viewport — chat scroll, Follow live, settings sheet
- Contrast spot-check muted text on `bg-surface`

**Estimated effort:** < 1 day, ~8–12 files touched.

---

## Alternatives Considered

| Approach | Effort | Risk | Verdict |
|----------|--------|------|---------|
| A. Tokens only, no font change | Low | Leaves Inter "AI slop" signal | Rejected (P1 completeness) |
| B. Full plan above | Medium | Low | **Chosen** |
| C. Rewrite all components with new component library | High | Scope creep | Rejected |

---

## GSTACK REVIEW REPORT

### Phase 0 — CEO Review

**Dream state**

```
CURRENT          THIS PLAN              12-MONTH IDEAL
────────         ─────────              ──────────────
Works, generic   Branded cockpit UI     CLR = reference
dark UI          + DESIGN.md truth      for remote dev UX
```

**Scope decisions (auto)**

| Item | Decision | Principle | Class |
|------|----------|-----------|-------|
| Include font swap | Yes | P1 completeness | Mechanical |
| Touch all 6+ components | Yes | P2 boil lakes | Mechanical |
| Terminal theme in v1 | No | P3 pragmatic defer | Mechanical |
| README DESIGN link | Yes | P1 doc completeness | Mechanical |

**CEO issues:** None blocking. Plan solves positioning gap without new product surface area.

---

### Phase 1 — Design Review

**Examined:** `DESIGN.md`, `globals.css`, component class patterns, mobile scroll/Follow live UX from prior fixes.

**Alignment checklist**

| Requirement | Plan covers? |
|-------------|--------------|
| Memorable thing drives accent | Yes (cyan = live) |
| No Inter | Yes (Plex) |
| Not pure black | Yes (#0c0c0e) |
| 44px touch | Existing pattern preserved |
| Reduced motion | Step 4 added |

**Taste decisions (surface at approval gate)**

1. **Accent hue:** Phosphor cyan `#5eead4` vs keep neutral white for "accent". **Auto-decision:** cyan for live states only; body text stays neutral. Rationale: memorable thing needs one recognizable signal.
2. **IBM Plex vs Geist:** **Auto-decision:** Plex (documented in DESIGN.md). Geist is also common in dev tools; Plex is more distinct.
3. **User bubble style:** Slight radius increase to `md` (10px). **Auto-decision:** approve per DESIGN.md component table.

**Design issues:** None. Plan implements existing DESIGN.md; no drift.

---

### Phase 2 — Eng Review

**Examined:** Tailwind v4 `@theme`, `layout.tsx`, component token usage, build pipeline.

**Dependency graph (ASCII)**

```
layout.tsx (fonts)
    └── globals.css (@theme tokens)
            └── components/*.tsx (semantic classes)
            └── markdown.tsx / tool-call-card.tsx
```

**Risks**

| Risk | Mitigation |
|------|------------|
| `--color-accent` usages break | Grep accent/accent-dim before merge |
| Font CLS | `next/font` with `display: swap` |
| PWA themeColor mismatch | Update viewport in same PR |

**Eng issues:** None. Explicit token migration (P5); no new abstractions.

---

### Phase 3 — DX Review

**Examined:** `CLAUDE.md`, `DESIGN.md`, `docs/USER_GUIDE.md`, README.

| DX item | Status |
|---------|--------|
| Agent onboarding | CLAUDE.md points to DESIGN.md |
| User docs | USER_GUIDE unchanged (behavior, not visuals) |
| Contributor path | DESIGN.md + token file single source |

**Suggestion (non-blocking):** Add "Design" bullet to README dev section linking `DESIGN.md`.

**DX issues:** None blocking.

---

## Decision Audit Trail

| # | Phase | Question | Auto-answer | Principle | Class |
|---|-------|----------|-------------|-----------|-------|
| 1 | CEO | Font swap in v1? | Yes | P1 | Mechanical |
| 2 | CEO | Defer terminal colors? | Yes | P3 | Mechanical |
| 3 | Design | Cyan accent | Yes, live only | P1+P5 | Taste |
| 4 | Design | Plex fonts | Yes | P1 | Taste |
| 5 | Eng | New UI kit? | No | P5 | Mechanical |
| 6 | DX | README link | Yes | P1 | Mechanical |

---

## Final Approval Gate

### Ready to implement

- [x] `DESIGN.md` written
- [x] `CLAUDE.md` written
- [x] Plan reviewed CEO → Design → Eng → DX
- [ ] **User approval** to implement token + font + component pass

### Taste items for your call

1. **Phosphor cyan** for live/streaming/Follow live — keep or prefer neutral white accent?
2. **IBM Plex** — keep or prefer Geist / system stack only?

Default if you say "go": ship as documented in `DESIGN.md`.

### User challenges

None. Models did not override stated direction.

---

*End of GSTACK REVIEW REPORT*
