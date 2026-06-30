# Mytanah — Design System

> Malaysian Residential Property Intelligence. An editorial, light, warm
> data product — Bloomberg numbers with luxury-magazine typography.

This folder is the source of truth for **Mytanah**'s visual language:
colour tokens, type, spacing, motion, iconography, and a working UI kit
that recreates the dashboard. Use it any time you design a screen, slide,
prototype, or marketing surface for the brand.

---

## Sources

This system was built from a **product specification** (the master prompt
shared at project start). No external codebase or Figma file was attached
when this system was authored — every rule below is faithful to that spec.

- **Spec doc**: see the company description in the project chat history.
- **Codebase**: none attached. If a Next.js implementation appears later
  (`app/`, `components/`, `lib/`), prefer it over this system on conflicts.
- **Figma**: none attached.

---

## What Mytanah is

A Malaysian residential property intelligence app. Three core surfaces:

1. **Valuation** — AVM (automated valuation model) producing a lower /
   central / upper estimate plus contributing factors and district medians.
2. **Sentiment Index (MHSI)** — composite market sentiment 0–100 with a
   semicircle gauge (Bearish / Neutral / Bullish) and a time-series.
3. **Risk Factor (HCR)** — composite housing-cycle risk: *Upward Pressure*,
   *Stable*, *Downward Pressure*, with six indicator scorecards and a long
   historical area chart.

The product opens with a **cinematic Earth-zoom intro** (Three.js globe →
Malaysia → cream dashboard), followed by a **location selector modal**
before the dashboard reveals.

---

## Brand vibe in one paragraph

Cream paper, dark forest ink, a single warm earth-brown accent. Headlines
set in **Cormorant Garamond** like the cover of a property journal; UI in
**DM Sans**; numbers in **JetBrains Mono** like a trading terminal. There
is exactly **one** persistent dark surface — the sidebar — anchoring an
otherwise light, editorial world. No gradients-as-decoration. No emoji.
No neon. Confidence comes from restraint.

---

## Index — files in this folder

| Path | What's in it |
|---|---|
| `colors_and_type.css` | All design tokens as CSS variables (colours, type, spacing, radii, shadows, motion) + base element styles |
| `fonts/` | Notes on fonts (we load from Google Fonts via CSS `@import`) |
| `assets/` | Logos, brand marks, key imagery |
| `preview/` | Cards that populate the Design System tab (Colors, Type, Spacing, Components, Brand) |
| `ui_kits/dashboard/` | High-fidelity React/JSX recreation of the Mytanah dashboard with Valuation, Sentiment, and Risk pages |
| `SKILL.md` | Skill entrypoint for Claude Code / agent invocations |

---

## CONTENT FUNDAMENTALS — how copy is written

**Tone.** Editorial, measured, analyst-grade. We sound like a property
research desk, not a SaaS landing page. Restrained, never breathless. We
do not say "amazing", "powerful", or "game-changing".

**Voice.** Third-person and instructional. The product narrates the
market; the user is addressed sparingly and directly when needed. We use
**you** for direct prompts ("Where is your property?") but never **we**
or **us** as a product persona. No first-person.

**Casing.**
- **Page titles & section headings** — Title Case in Cormorant Garamond
  (e.g. *Market Commentary*, *Contributing Factors*).
- **Eyebrows / section labels** — UPPERCASE in DM Sans 11px with wide
  tracking, in earth-brown (e.g. `PROPERTY DETAILS`, `MARKET COMMENTARY`).
- **Body copy** — sentence case.
- **Button labels** — Sentence case, often with a thin trailing arrow
  ("Analyse Property →", "Re-estimate", "Skip intro →").

**Spelling.** British/Malaysian English. Use **Analyse**, not Analyze;
**Behaviour**, not Behavior; **Centre**, not Center; **Modelled**.

**Numbers.** Always real and specific. Currency as `RM 450,000` (capital
RM, thin non-breaking space, comma thousands). Percentages with one
decimal: `+2.4%`. Quarters as `Q1 2025`. Periods as `2020 Q1 – 2025 Q1`.

**Property language.** Use precise NAPIC-style terms: *tenure*,
*freehold*, *leasehold*, *built-up area*, *land area*, *median price*,
*district*. Never "house value" — say *valuation* or *central estimate*.

**Signal language.** Three named risk states only:
*Upward Pressure*, *Stable*, *Downward Pressure*. Sentiment uses
*Bearish*, *Neutral*, *Bullish*. Never "good/bad", never traffic-light
emoji.

**Emoji.** **Never.** Not in UI, not in copy, not in marketing. Icons
come from Lucide (see ICONOGRAPHY).

**Examples (do this).**
- *"Reading Malaysian property market…"* — ellipsis, calm, sentence case
- *"Where is your property?"* — direct, one short question
- *"Median Prices by District — Selangor"* — em-dash specificity
- *"Data: NAPIC 2021–2025"* — provenance, en-dash range
- *"Property Age"* slider — noun phrase, no helper text

**Examples (avoid).**
- "🏠 Find your dream home!" — emoji, exclamation, marketing voice
- "Awesome valuation results" — superlative
- "$450,000" — wrong currency

---

## VISUAL FOUNDATIONS

### Colour
- **Cream is the world.** `#DCD7C9` is the page background everywhere
  (sentiment chart, valuation page, risk page, location modal backdrop).
  `#EDE9E1` (cream-raised) is the card colour.
- **Forest is authority.** `#2C3930` is the sidebar — the ONE persistent
  dark surface — and the colour of all primary text on cream. The HCR
  hero banner is the only other dark card.
- **Earth is the accent.** `#A27B5C` shows up in tiny doses: CTAs,
  uppercase eyebrows, active nav border (3px left), the gauge needle's
  accent ring, the sentiment "NLP score" dashed line. Use sparingly — it
  earns attention because it's rare.
- **Signal colours are muted, never neon.** Deep red `#A63228`, amber
  `#8B6914`, deep green `#2D7A4F`. They appear as 3px card top-borders,
  thin progress bars, faint background bands (`opacity 0.05–0.10`) on
  charts, never as full button fills.

### Type
- **Display: Cormorant Garamond** (300/400/500/600). Editorial,
  high-contrast serif. Page titles, hero labels, italic commentary, the
  "Mytanah" wordmark.
- **UI: DM Sans** (300/400/500). Clean and humanist. Body, buttons,
  labels, nav, form fields.
- **Data: JetBrains Mono** (400/500/600). Every number — prices, scores,
  percentages, quarter codes, axis ticks.
- **Tracking** is wide and uppercase on eyebrow labels (`0.14em`,
  uppercase, 11px). Body and headings sit at `-0.01em` to read tighter.
- **Balance & pretty.** Headings use `text-wrap: balance`; body uses
  `text-wrap: pretty`.

### Spacing
4-based scale (`4/8/12/16/20/24/32/40/56/72px`). Cards pad **28px**;
dashboard gutters **24px**. Components breathe — there is intentional
white (cream) space between every group.

### Backgrounds
- **No gradients** as decoration. The only place a gradient-like effect
  exists is the **radial wipe** at the end of the intro (from Malaysia
  outward into cream).
- No repeating patterns, no textures, no grain. The brand looks like
  paper because of *paper colour*, not paper texture.
- One full-bleed image exists in the product: the Earth in the intro.
  After that the world is flat and warm.
- The dashboard is rectilinear. Cards stack on cream, separated by gap
  and by 1px `#C8C3B8` borders.

### Borders
- Default 1px solid `--cream-border` (`#C8C3B8`) on cards and inputs.
- **3px top borders** on metric cards encode signal (red / earth / green).
- **4px bottom border** on the HCR hero banner encodes the named state.
- **3px left border** on the active sidebar item — in earth-brown.
- Modal panel uses 1px `--earth` at 30% opacity for a warmer frame.
- Inputs get a 1px `--earth` at 25% opacity (`#A27B5C40`); focus
  promotes it to solid `--earth`.

### Shadows
Warm and soft, never grey/blue. The system has four steps:
`xs` (hover hint), `sm` (resting card), `md` (popovers / hovered cards),
`lg` `0 32px 80px rgba(44,57,48,0.18)` (modal panel). All use the
forest-deep RGB so shadow tints toward green, not black.

### Corner radii
`6 / 8 / 12 / 16` — and a `pill` (9999) for tenure/model selector chips
and signal badges. Cards `12–16`, buttons `8`, inputs `8`.

### Cards
`background: var(--cream-raised); border: 1px solid var(--cream-border);
border-radius: 12–16px; padding: 20–28px;` plus `--shadow-sm` resting.
**Hover** lifts to `--shadow-md` and `scale(1.01)` over 200ms. **Press**
returns to `--shadow-xs` and `scale(0.995)`. No glow, no fancy border
animations.

### Hover & press
- Buttons: forest-deep → forest-mid background; cream text. A subtle
  shimmer sweep is allowed on the primary CTA.
- Nav items: text from `#DCD7C9 @ 60%` → 100%; background to 40% mid-green.
- Cards: lift shadow + 1% scale-up.
- Press: brief shrink to `scale(0.995)`, shadow reduces.

### Transparency & blur
Used in three deliberate places only:
1. `--earth-faint` (`#A27B5C20`) for badge backgrounds and faint chart
   bands.
2. Chart band fills at `opacity 0.05–0.10`.
3. Sidebar nav text at 60% opacity when inactive.
**Backdrop-blur is not used.** This is paper, not glass.

### Animation
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` — a soft overshoot-free
  ease-out. Page transitions use this. Same curve everywhere.
- **Durations**: 160ms hover, 240ms component, 500ms reveal, 600ms page.
- **Card reveals**: stagger 60–80ms, each enters with `translateY(20px)`
  and `opacity 0 → 1`.
- **Number counters**: every metric counts up from 0 on mount via
  `useCountUp`.
- **Chart lines**: Recharts' built-in draw animation on mount.
- **No bounces, no springs.** Calm, decisive, exhale.

### Imagery
Warm, daylit, architectural. Photo treatment leans toward unbleached
cream + olive-green. Avoid bright whites, blue skies, neon glass towers.
Black-and-white is acceptable. Grain is not.

### Layout rules
- Sidebar is **persistent left**, 220px desktop, icon-only at 48px on
  tablet, bottom-tab on mobile.
- Header is **persistent top**, 56px, cream background.
- Content area sits on cream; lives inside a max-width column on long
  pages with a 24px gutter.
- The location modal is centred, max-width ~640px, on a dark forest
  backdrop *before* the dashboard reveals.

### Charts
- Background is the card colour (`--cream-raised`), not transparent.
- Axes are `--forest-mid`. Grid lines are barely there (1px `--cream-border`).
- Primary line is `--forest-deep` 2–2.5px.
- Secondary line is `--earth` dashed.
- Tertiary line is `--forest-mid` dotted at 70%.
- Tooltips are dark: `--forest-deep` bg, cream text, earth eyebrow.
- Reference lines are dashed `--earth`.

---

## ICONOGRAPHY

**Icon system: [Lucide](https://lucide.dev)** — the same library used in
the spec (`lucide-react`). Lucide's outline geometry (1.5px stroke,
rounded caps, 24×24 grid) matches the editorial restraint of the brand.

**How to use.**
- In React / JSX: `import { Home, TrendingUp, AlertTriangle } from 'lucide-react'`.
- In static HTML: load via CDN
  `<script src="https://unpkg.com/lucide@latest"></script>` then call
  `lucide.createIcons()`, or inline an SVG from `lucide.dev`.
- This design system ships a small inlined subset in `assets/icons/` for
  the dashboard recreation (Home, TrendingUp, AlertTriangle, ChevronDown,
  ArrowRight, MapPin, Loader2).

**Stroke & size.**
- Default stroke `1.5px`, default size **18px** in nav and buttons,
  **20px** in card headers, **14px** in inline labels.
- Colour follows surrounding text (`currentColor`) — usually
  `--forest-deep` on cream, `--cream` on forest-deep, `--earth` for
  active markers.

**Logo mark.** A small house glyph in `--earth` next to the
"Mytanah" wordmark in Cormorant Garamond cream. See
`assets/logo.svg` and `assets/logo-mark.svg`. The wordmark works at any
size; the mark stands alone at 24px+.

**Custom marks.** None beyond the house glyph. We do **not** invent
illustrative iconography for empty states or onboarding — empty states
use a single Lucide icon at 40px and a one-line caption in
Cormorant italic.

**Emoji.** **Never.** Not anywhere in product or marketing.

**Unicode glyphs.** A small set is acceptable inline in copy:
- `→` (arrow) in CTA labels, never used as a standalone icon.
- `—` (em dash) for section separators in titles.
- `–` (en dash) for numeric ranges.

If Lucide doesn't have what you need, the next-best fallback is
[Phosphor](https://phosphoricons.com) "Regular" weight. Flag any
substitution in code review.

---

## Font substitutions / status

All three families load reliably from Google Fonts — no local files are
shipped here:

- **Cormorant Garamond** → Google Fonts. ✅ Exact.
- **DM Sans** → Google Fonts. ✅ Exact.
- **JetBrains Mono** → Google Fonts. ✅ Exact.

If the user wants the brand to ship self-hosted, please supply the
licensed font files and we'll move them into `fonts/`.

---

## Iterate with me

This system is a faithful translation of the master spec. Where we
guessed (logo mark geometry, specific Malaysian property copy beyond the
spec, the exact icon for "Risk Factor"), we'd love your eye. **Tell us
what's off** — the colour ratios, the type hierarchy, the names you'd
use for surfaces — and we'll tighten.
