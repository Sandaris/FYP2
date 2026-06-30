# Dashboard Development Guide

## Project Architecture

The dashboard is a **React SPA** served by a **FastAPI** backend. There are two layers:

| Layer | Path | Role |
|---|---|---|
| Backend | `backend/api.py` | FastAPI — ML inference, data endpoints, serves built frontend |
| Frontend source | `frontend/dashboard-app/` | Vite + React + shadcn/ui project (new) |
| Frontend output | `frontend/dist/` | Built assets — FastAPI serves this |
| Legacy frontend | `frontend/ui_kits/dashboard/` | CDN-based landing page plus old dashboard fallback |

---

## Tech Stack

### Frontend (post-migration)
- **Vite** — build tool and dev server
- **React 18** (proper npm install, not CDN)
- **Tailwind CSS v3** — utility-first styling
- **shadcn/ui** — component library (components live in `src/components/ui/`)
- **ECharts** via `echarts-for-react` — all data charts
- **D3 + TopoJSON** — choropleth map (MalaysiaMap)
- **lucide-react** — icons

### Backend
- FastAPI + Uvicorn
- ML models: Random Forest, XGBoost, FT-Transformer (valuation)
- LiteLLM + Gemini — rent comps AI agent

---

## Running the Project Locally

Two terminals required:

**Terminal 1 — Backend:**
```bash
cd /Users/zixuanhar/FYP2/backend
uvicorn api:app --reload --port 8000
```

**Terminal 2 — Frontend dev server:**
```bash
cd /Users/zixuanhar/FYP2/frontend/dashboard-app
npm run dev
# Opens at http://localhost:5173
```

Visit `http://localhost:5173` in the browser. Vite proxies all API calls (`/valuation`, `/hcr`, `/data`, `/rent-comps`) to FastAPI on port 8000 automatically.

For the Mytanah pitch landing page during local development, use the same Vite
origin. The local root serves the legacy landing page without changing the URL:

```text
http://localhost:5173/
```

Do not use the VM IP for local development. API calls should stay same-origin
through the Vite proxy, or go directly to `http://localhost:8000` when testing
FastAPI endpoints.

> Hot-reload is active — saving any `.jsx` file instantly updates the browser.

---

## Building for Production

```bash
cd /Users/zixuanhar/FYP2/frontend/dashboard-app
npm run build
# Output lands in frontend/dist/
```

FastAPI serves `frontend/dist/` at the `/app` route. The built output is what gets deployed to the VM.

> **Before deploying:** always run `npm run build` first so `frontend/dist/` is up-to-date.

---

## Design System

### Color Palette

All colors are defined as CSS variables in `frontend/dashboard-app/src/index.css` and mapped to shadcn/ui's theme system.

| Token | Hex | Role |
|---|---|---|
| Cream light | `#EDE9E1` | Page background |
| Cream mid | `#DCD7C9` | Card surface |
| Forest deep | `#2C3930` | Primary text, nav, buttons |
| Forest mid | `#3F4F44` | Secondary text |
| Earth brown | `#A27B5C` | Accent, CTAs |
| Earth light | `#C49A7A` | Hover accent |
| Border | `#C8C3B8` | Dividers, input borders |
| Signal up | `#2D7A4F` | Positive values |
| Signal down | `#A63228` | Negative values |
| Signal stable | `#8B6914` | Neutral/stable |

### Typography

Three typefaces, all from Google Fonts:

| Font | Use |
|---|---|
| Cormorant Garamond | Display headlines (page titles, hero numbers) |
| DM Sans | UI text (labels, body, buttons) |
| JetBrains Mono | Data values (prices, percentages, numeric data) |

### Component Library

shadcn components live in `src/components/ui/`. Do **not** edit these files directly — they are managed by shadcn CLI. Customize via Tailwind classes or CSS variables.

Shared wrapper components (stat cards, section headers, etc.) live in `src/components/shared/`.

---

## Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/` | Mytanah landing page | Legacy pitch landing page served at the clean root URL |
| `/dashboard` | `TransactionMapPage` | Map + location search + transaction explorer (default) |
| `/dashboard/market` | `MarketOverviewPage` | National market stats + ECharts chart suite |
| `/dashboard/roi` | `RoiCalculator` | Loan simulator + earnings projection |
| `/dashboard/sentiment` | `SentimentPage` | Housing Cycle Index + HCR charts |

The Mytanah landing page's demo CTA opens the dashboard with `?from=intro`, so
the dashboard can still use its first-load reveal without keeping the old Vite
intro page.

---

## API Endpoints

All served by FastAPI at port 8000. Vite dev proxy forwards these automatically.

| Endpoint | Method | Purpose |
|---|---|---|
| `/valuation/predict` | POST | AVM inference (property value estimate) |
| `/valuation/options` | GET | Cascading dropdown data (states/districts/mukims) |
| `/valuation/roads` | GET | Road list for a given scheme |
| `/hcr/current` | GET | Housing cycle regime (probability, contributions) |
| `/data/query` | GET | Transaction data (filterable) |
| `/rent-comps` | GET | Exa-powered live rental comparable estimate for ROI |

---

## Visualization Libraries

### ECharts theming

All ECharts instances share a registered theme (`mytanah`) and helpers in `src/lib/chartTheme.js`. Import `chartOpts` for ReactECharts and use `chartTooltip()`, `chartGrid()`, `chartSplitLine()`, etc. when building options. The theme is registered once in `main.jsx`.

### What uses ECharts
- Quarterly transaction volume (bar)
- Property type distribution (bar)
- Top districts by volume (bar)
- Price histogram (bar)
- Tenure mix (pie/donut)
- State average prices (bar)
- HCR indicator time-series (6× line/bar)
- ROI earnings vs debt chart (dual line)
- Yearly average price trend (line)

### What uses D3
- Malaysia choropleth map with state/district selection (`MalaysiaMap.jsx`)
- Mytanah landing page scroll globe (`frontend/ui_kits/dashboard/ScrollGlobe.jsx`)

### What uses custom SVG
- HP-filter cyclical decomposition chart (`CyclicalChart.jsx`)
- Loan amortization schedule (`RoiCalculator`)

> ECharts and D3 components are kept as-is from the original implementation. They are wrapped in shadcn `Card` containers but their internal rendering logic is not changed.

---

## Project File Structure

```
frontend/
  dashboard-app/          ← Vite source (edit here)
    src/
      components/
        ui/               ← shadcn auto-generated (don't edit)
        layout/           ← AppShell, Sidebar
        shared/           ← StatCard, SectionHeader, etc.
      pages/              ← one file per route
      lib/
        api.js            ← FastAPI fetch wrapper
        utils.js          ← shadcn cn() utility
      index.css           ← Tailwind directives + theme CSS vars
    public/               ← static assets (GeoJSON, fonts, video)
    vite.config.js
    tailwind.config.js
  dist/                   ← built output (auto-generated, served by FastAPI)
  ui_kits/dashboard/      ← landing page and legacy fallback

backend/
  api.py                  ← FastAPI app (serves frontend/dist/ at /app)
```

---

## Adding a New shadcn Component

```bash
cd frontend/dashboard-app
npx shadcn@latest add <component-name>
# Example: npx shadcn@latest add dialog
```

The component appears in `src/components/ui/<component-name>.jsx`. Import it normally:

```jsx
import { Dialog, DialogContent } from '@/components/ui/dialog'
```

---

## Common Tasks

### Change a color token
Edit the CSS variable in `src/index.css` under `:root` and `.dark`. The change propagates everywhere via Tailwind.

### Add a new chart
1. Import `ReactECharts` from `echarts-for-react`
2. Define your ECharts `option` object
3. Wrap in a shadcn `<Card>`

```jsx
import ReactECharts from 'echarts-for-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

<Card>
  <CardHeader><CardTitle>My Chart</CardTitle></CardHeader>
  <CardContent>
    <ReactECharts option={chartOption} style={{ height: 300 }} />
  </CardContent>
</Card>
```

### Add a new page
1. Create `src/pages/MyPage.jsx`
2. Add a `<Route>` in `src/App.jsx`
3. Add a nav link in `src/components/layout/AppShell.jsx`
