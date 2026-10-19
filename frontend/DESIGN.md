# RegLens — Design direction

## Visual concept: "Lens on the ledger"
A dark, quiet canvas: near-black with faint violet light, like looking through a precision instrument.
Data is the hero. Colour is used sparingly: one electric-violet accent for intent (actions, focus,
the "lens") and three semantic risk colours, always paired with an icon and a word. Motion explains
causality: things enter in the order the pipeline produces them (transaction → rules → retrieval →
LLM → guardrail → human → audit), so the animation *is* the explanation.

## Colour tokens (CSS variables, `src/index.css`, Tailwind v4 `@theme inline`)
| Token | Dark | Light | Use |
|---|---|---|---|
| `--background` | oklch(0.135 0.014 275) | oklch(0.985 0.004 275) | page |
| `--foreground` | oklch(0.97 0.006 275) | oklch(0.2 0.025 275) | text |
| `--card` | oklch(0.175 0.016 275) | oklch(1 0 0) | surfaces (with 70% glass variant) |
| `--muted-foreground` | oklch(0.72 0.02 275) | oklch(0.46 0.025 275) | secondary text (AA on bg) |
| `--border` | white / 8% | ink / 10% | 1px hairlines |
| `--brand` | oklch(0.66 0.23 288) | oklch(0.52 0.25 288) | accent, focus ring, primary buttons |
| `--risk-low` | oklch(0.76 0.16 162) | oklch(0.5 0.13 162) | emerald + ShieldCheck |
| `--risk-medium` | oklch(0.83 0.15 80) | oklch(0.56 0.14 65) | amber + AlertTriangle |
| `--risk-high` | oklch(0.7 0.2 15) | oklch(0.54 0.21 15) | rose + Siren |

## Type scale (8px grid)
Geist Variable for UI, Geist Mono Variable for IDs, amounts and hashes (always `tabular-nums`).
`display 56/60 -0.04em` · `h1 30/36 -0.02em` · `h2 20/28` · `body 14/22` · `small 12/16` · `mono 12/16`.
INR uses Indian grouping (`₹12,34,567`) and compact lakh/crore (`₹12.5 L`, `₹1.2 Cr`).

## Motion principles (`src/lib/motion.ts`)
- **Springs, not curves**, for anything the user touches: `snappy` (stiffness 420, damping 32),
  `gentle` (220/26), `bouncy` (320/18). Tweens only for opacity/colour: `ease.out = [0.22, 1, 0.36, 1]`.
- **Durations**: micro 0.15s · base 0.3s · page 0.45s · hero 1.2s.
- **Stagger**: lists 0.04s, cards 0.07s, hero words 0.08s.
- Only `transform`, `opacity` and `filter` are animated. Layout changes use Motion `layout`/`layoutId`.
- `MotionConfig reducedMotion="user"`: with reduced motion, transforms are dropped and only fades remain;
  ambient loops (aurora, beams, particles, marquee) are paused.
- `LazyMotion` + `m.*` keeps the base bundle small; the `domMax` feature set (layout, drag) is loaded
  asynchronously in its own chunk after first paint (`src/lib/motion-features.ts`).

## Component map (21st.dev → where)
| 21st.dev component | Used in |
|---|---|
| Aurora Background, Spotlight, Particles, Dot Pattern | Landing hero |
| Text Generate Effect, Word Rotate, Animated Gradient Text | Landing tagline / headings |
| Animated Beam | Landing "how it works" pipeline |
| Shimmer Button | Landing CTA, primary actions |
| Marquee | Landing regulations strip |
| Bento Grid + Magic Card | Landing features, Dashboard |
| Number Ticker | Dashboard KPIs, Evaluation |
| Border Beam | Highlighted cards (live run, STR) |
| Ripple | Dashboard "risk pulse" |
| Animated List | Run Analysis live feed |
| Animated Circular Progress Bar | Run Analysis progress ring, Evaluation gauges |
| File Upload | Run Analysis CSV drop zone, KB upload |
| Timeline | Dashboard deadlines, KB version history |
| Animated Tooltip | Reviewer avatars |
| Blur Fade | Section reveals everywhere |
