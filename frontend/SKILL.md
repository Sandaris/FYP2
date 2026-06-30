---
name: mytanah-design
description: Use this skill to generate well-branded interfaces and assets for Mytanah, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc),
copy assets out and create static HTML files for the user to view. If
working on production code, you can copy assets and read the rules here
to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what
they want to build or design, ask some questions, and act as an expert
designer who outputs HTML artifacts _or_ production code, depending on
the need.

## Quick map of this skill
- `README.md` — brand context, content fundamentals, visual foundations, iconography
- `colors_and_type.css` — all design tokens (CSS variables) + base element styles
- `assets/` — logo SVGs (cream, on-dark, mark-only)
- `fonts/` — fonts notes (we load Google Fonts via CSS @import)
- `preview/` — card-sized specimens for each token group
- `ui_kits/dashboard/` — working React/JSX recreation of the dashboard
  (Valuation, Sentiment Index, Risk Factor) with shared primitives

## Core rules to never break
- Cream `#DCD7C9` is the page world. Cards are `#EDE9E1`. The sidebar is
  the ONE persistent dark surface (`#2C3930`).
- Earth-brown `#A27B5C` is reserved for CTAs, eyebrow labels, and tiny
  accents. Never used as a body fill.
- Numbers always set in JetBrains Mono. Headings in Cormorant Garamond.
  UI in DM Sans.
- Signal colours are muted, used as 3–4px borders, badge tints, or chart
  bands at 0.05–0.10 opacity. Never as full button fills.
- No emoji. No gradients. No backdrop blur. No neon. No bouncy springs.
- British/Malaysian English. "Analyse", "Behaviour". Currency `RM 450,000`.
