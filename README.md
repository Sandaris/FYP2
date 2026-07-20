# Mytanah FYP2

Mytanah is a Malaysian residential property intelligence project built for an
FYP2 demonstration. It combines cleaned NAPIC-style transaction data, valuation
models, housing-cycle risk analysis, rental comparable research, and a polished
React dashboard served by a FastAPI backend.

The live product is designed for examiners and demo audiences: it should make
the modelling work understandable through a usable property dashboard rather
than leaving the work inside notebooks.

## What It Does

- Predicts residential property prices from property type, district, mukim,
  scheme, tenure, land area, and built-up area.
- Supports multiple deployed valuation models: XGBoost, Random Forest, and
  FT-Transformer.
- Returns valuation confidence bands, price-per-square-foot metrics, and nearby
  comparable transactions.
- Exposes transaction filtering and aggregate market statistics for dashboard
  maps and charts.
- Provides a housing-cycle regime endpoint based on macro/property indicators.
- Estimates mukim-level rental comparables through Exa, Hermes, or a local
  Playwright/Gemini agent when API keys are configured.
- Serves a React/Vite dashboard at `/dashboard/*` and a landing page at `/`.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `backend/` | FastAPI service, model training/export scripts, rental-comps agent, API docs |
| `backend/artifacts/` | Local trained model artifacts loaded by the API |
| `frontend/dashboard-app/` | Active Vite + React + Tailwind dashboard source |
| `frontend/dist/` | Built dashboard output served by FastAPI at `/dashboard/*` |
| `frontend/ui_kits/dashboard/` | Landing page and legacy dashboard fallback served at `/` |
| `processed data/` | Cleaned runtime data, transaction parquet, location hierarchy |
| `property data/` | Original source spreadsheets |
| `Data Exploration & Cleaning/` | Data exploration and cleaning notebooks |
| `Model Selection/` | Model experimentation notebooks |
| `Code/` | Evaluation charts and supporting analysis scripts |
| `PRODUCT.md` | Product and design intent |
| `modeldeployment.md` | Multi-model deployment rationale and 2026 hold-out results |

## Prerequisites

- Python 3.10 or newer
- Node.js and npm
- PowerShell on Windows, or equivalent shell commands on macOS/Linux
- Optional API keys for rental-comps:
  - `EXA_API_KEY`
  - `GEMINI_API_KEY`
  - `HERMES_URL`

## Backend Setup

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a local environment file if you need live rental comparable search:

```powershell
Copy-Item .env.example .env
```

Then fill in any required keys in `backend/.env`. The `.env` file is ignored by
git.

## Model Artifacts

The API loads model artifacts from `backend/artifacts/`. The current local repo
contains the main valuation artifacts, including:

- `valuation_model.joblib` - default XGBoost valuation model
- `valuation_ft.joblib` - FT-Transformer valuation model
- `valuation_rf.joblib` - Random Forest valuation model, ignored by git because
  it is larger than GitHub's 100 MB file limit

To rebuild artifacts from the cleaned data:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python save_models.py
```

You can also pass specific targets:

```powershell
python save_models.py valuation
python save_models.py rf
python save_models.py ft
python save_models.py hcr
```

The HCR trainer expects `backend/hcr_quarterly.csv` if you want to regenerate
the housing-cycle model and latest snapshot.

## Run The API

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn api:app --reload
```

Useful local URLs:

- Landing page: <http://127.0.0.1:8000/>
- Dashboard: <http://127.0.0.1:8000/dashboard>
- API docs: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/health>

## Frontend Development

The active dashboard source is `frontend/dashboard-app/`.

```powershell
cd frontend/dashboard-app
npm install
npm run dev
```

Vite runs on <http://localhost:5173>. Its dev server proxies API calls to the
FastAPI backend on <http://localhost:8000>, so keep the backend running while
developing dashboard features.

Build the production dashboard with:

```powershell
npm run build
```

The build output is written to `frontend/dist/`, which FastAPI serves at
`/dashboard/*`.

## API Surface

Primary endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service, artifact, and dataset status |
| `POST` | `/valuation/predict` | Property valuation prediction |
| `GET` | `/valuation/options` | Cascading dropdown options and numeric ranges |
| `GET` | `/valuation/roads` | Road names for a selected district/mukim/scheme |
| `GET` | `/hcr/current` | Latest housing-cycle regime snapshot |
| `POST` | `/hcr/predict` | Housing-cycle regime prediction for custom inputs |
| `GET` | `/data/query` | Filtered transaction data and aggregate stats |
| `GET` | `/rent-comps` | Mukim-level rental comparable estimate |

Example valuation request:

```bash
curl -X POST http://127.0.0.1:8000/valuation/predict \
  -H "Content-Type: application/json" \
  -d '{
    "property_type": "2 - 2 1/2 Storey Terraced",
    "district": "Petaling",
    "mukim": "Damansara",
    "scheme": "Bandar Utama",
    "tenure": "Freehold",
    "land": 1800,
    "area": 2100,
    "model": "xgboost"
  }'
```

## Data Notes

Runtime data is loaded from `processed data/`. The API prefers
`transactions.parquet` for faster startup and falls back to
`Open Transaction Data Cleaned.xlsx` if the parquet file is unavailable.

Location lookup data is loaded from `processed data/location_hierarchy.json`.
The hierarchy and scheme index can be regenerated with:

```powershell
cd backend
python build_location_hierarchy.py
python build_scheme_mukim_index.py
```

## Additional Documentation

- [backend/README.md](./backend/README.md) - backend setup and older endpoint notes
- [PRODUCT.md](./PRODUCT.md) - product audience, brand, and design principles
- [modeldeployment.md](./modeldeployment.md) - deployed model comparison and rationale
- [frontend/README.md](./frontend/README.md) - design system notes
