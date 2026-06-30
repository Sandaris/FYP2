# Mytanah Dashboard — UI Kit

A high-fidelity recreation of the Mytanah dashboard. Built as a
click-through prototype with React via inline JSX (no build step).

## Run
Open `index.html`. Everything is self-contained.

## Components
- `Sidebar.jsx` — persistent left nav (forest-deep) with active state
- `Header.jsx` — 56px cream header with page title + quarter badge
- `LocationPanel.jsx` — initial property selector (modal-style overlay)
- `ValuationPage.jsx` — AVM result cards + district price chart
- `SentimentPage.jsx` — custom SVG gauge + time-series chart
- `RiskPage.jsx` — hero banner + 6 indicator scorecards + area chart
- `Primitives.jsx` — `Pill`, `Eyebrow`, `Card`, `Button`, `Field` shared parts

## What this kit does NOT do
- Globe intro (Stage 1–3 with Three.js) — kit picks up after the cream
  dashboard fades in. The intro is described in the README; not recreated.
- Real data — every chart uses small handcrafted mock arrays.
- Real routing — left nav switches the right pane via React state.

## Iterate
Replace any hex value with the matching CSS var from
`../../colors_and_type.css`. All colours used in this kit map 1:1 to those
tokens.
