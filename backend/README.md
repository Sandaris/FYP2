# FYP2 Backend API

FastAPI service that exposes the property valuation model, housing cycle regime indicator, and the cleaned transactions dataset to a frontend.

## One-time setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Build model artifacts

The notebooks train fresh on every run and don't dump models. `save_models.py` refits the production-shape models and writes them to `backend/artifacts/`:

```powershell
python save_models.py
```

What it produces:
- `artifacts/valuation_model.joblib` — Random Forest pipeline (categorical OHE + numeric scaler). Drop-in replacement slot for FT-Transformer later — keep the artifact dict shape.
- `artifacts/hcr_model.joblib` — logistic regression on 6 macro features. Requires `backend/hcr_quarterly.csv`; the script tells you what columns it expects. Export this from `Data Exploration & Cleaning/HCR_Logit_Regression.ipynb`.
- `artifacts/hcr_latest.json` — most recent quarter's regime probability so `GET /hcr/current` is instant.

The valuation model trains directly off `processed data/Open Transaction Data Cleaned.xlsx` — no extra export needed.

## Run

```powershell
uvicorn api:app --reload
```

- **App (dashboard UI)**: <http://127.0.0.1:8000/> — auto-redirects to the Mytanah landing page
- Interactive docs: <http://127.0.0.1:8000/docs>
- Health: <http://127.0.0.1:8000/health>

The frontend (`../frontend/`) is served as static files at `/app/...` from the same uvicorn process, so the React UI calls the API on the same origin — no CORS, no second server.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health` | Which artifacts loaded |
| `POST` | `/valuation/predict` | Price prediction from property attributes |
| `GET`  | `/valuation/options` | Dropdown values for each categorical field |
| `GET`  | `/hcr/current` | Latest precomputed regime + probability |
| `POST` | `/hcr/predict` | Regime probability for a custom macro vector |
| `GET`  | `/data/query` | Filter the cleaned transactions (district, type, year, price range) |

### Sample valuation call

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
    "area": 2100
  }'
```

### Frontend wiring

CORS is preconfigured for `http://localhost:3000` (CRA/Next dev) and `http://localhost:5173` (Vite). Add more origins in `api.py` if your frontend dev server runs elsewhere.

Minimal fetch from React:

```js
const res = await fetch("http://127.0.0.1:8000/valuation/predict", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const { predicted_price } = await res.json();
```

## Swapping in FT-Transformer

FT-Transformer beat Random Forest by ~15% on RMSE. To productionize it:
1. In `Model Selection/ftTransformer.ipynb` add a final cell that saves the trained `nn.Module` state dict + the tokenizers / scalers used at inference.
2. Replace `train_valuation()` in `save_models.py` with a function that loads those artifacts and wraps them behind a `.predict(DataFrame)` method matching the current artifact dict (`model`, `cat_cols`, `cat_categories`, `num_cols`, `target_log`).
3. Add `torch` to `requirements.txt`. No API changes needed.
