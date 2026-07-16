"""FastAPI backend exposing the FYP2 property models.

Endpoints
---------
GET  /health                 — service + artifact status
POST /valuation/predict      — price prediction (Random Forest by default)
GET  /valuation/options      — valid dropdown values for categorical inputs
GET  /hcr/current            — latest housing cycle regime probability + label
POST /hcr/predict            — regime probability for a custom macro vector
GET  /data/query             — filtered slice of the cleaned transactions

Artifacts expected in ./artifacts/ (produced by save_models.py):
    valuation_model.joblib   {model, num_cols, cat_cols, cat_categories,
                              target_log: bool}
    hcr_model.joblib         {model, feature_cols, scaler}
    hcr_latest.json          {period, probability, regime, features}
"""

from __future__ import annotations

import gc
import json
import re
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Registers FTTransformerRegressor so joblib.load can resolve the "ft" artifact's
# class. Cheap at import time: ft_transformer keeps torch lazy (imported only on
# the first FT prediction), so this does not pull torch into the API process
# unless someone actually selects the FT-Transformer model.
import ft_transformer  # noqa: F401

ROOT = Path(__file__).parent
ARTIFACTS = ROOT / "artifacts"
# Prefer the Parquet for faster startup; fall back to the original Excel.
_PARQUET = ROOT.parent / "processed data" / "transactions.parquet"
_XLSX = ROOT.parent / "processed data" / "Open Transaction Data Cleaned.xlsx"
_LOCATION_HIERARCHY = ROOT.parent / "processed data" / "location_hierarchy.json"
DATA_FILE = _PARQUET if _PARQUET.exists() else _XLSX

app = FastAPI(title="FYP2 Property API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

state: dict[str, Any] = {
    "valuation_meta": None,  # shared cat_cols/num_cols/cat_categories (from default model)
    "hcr": None,
    "hcr_latest": None,
    "transactions": None,
    "location_hierarchy": None,
}

# Selectable valuation models -> artifact filenames. "xgboost" is the default
# and the back-compat artifact; "rf"/"ft" are optional and skipped if missing.
# The "ft" artifact unpickles ft_transformer.FTTransformerRegressor (imported
# below so joblib.load can resolve the class; torch stays lazy until predict).
VALUATION_MODEL_FILES = {
    "xgboost": "valuation_model.joblib",
    "rf": "valuation_rf.joblib",
    "ft": "valuation_ft.joblib",
}
DEFAULT_MODEL = "xgboost"

# Lazy, single-slot model cache. The VM is memory-constrained (~1 GB) and the
# Random Forest artifact alone is ~200 MB resident, so we never keep more than
# one valuation model in RAM: a model loads from disk on first request and the
# least-recently-used one is evicted. The lock serializes load+predict so two
# concurrent requests can't pull two big models in at once and blow the budget.
# The frontend computes only the *selected* model and caches results per search,
# so each model is loaded at most once per search (instant on switch-back).
_MODEL_CACHE: "OrderedDict[str, Any]" = OrderedDict()
_MODEL_CACHE_MAX = 1
_MODEL_LOCK = threading.RLock()


def _load_model_cached(key: str) -> Any:
    """Artifact for `key`, loading from disk (evicting the LRU model) if not
    resident. Caller must hold _MODEL_LOCK. Unknown/missing keys fall back to
    the default model."""
    if key not in VALUATION_MODEL_FILES or not (ARTIFACTS / VALUATION_MODEL_FILES[key]).exists():
        key = DEFAULT_MODEL
    path = ARTIFACTS / VALUATION_MODEL_FILES.get(key, "")
    if not path.exists():
        return None
    if key in _MODEL_CACHE:
        _MODEL_CACHE.move_to_end(key)
        return _MODEL_CACHE[key]
    while len(_MODEL_CACHE) >= _MODEL_CACHE_MAX:
        _MODEL_CACHE.popitem(last=False)
        gc.collect()  # release the evicted model's arrays before loading the next
    _MODEL_CACHE[key] = joblib.load(path)
    return _MODEL_CACHE[key]


def _available_models() -> list[str]:
    return [k for k, f in VALUATION_MODEL_FILES.items() if (ARTIFACTS / f).exists()]


@app.on_event("startup")
def load_artifacts() -> None:
    # Pre-warm the default model and extract the shared category metadata the
    # dropdown endpoints need (identical across models — same training split).
    with _MODEL_LOCK:
        default = _load_model_cached(DEFAULT_MODEL)
    if default is not None:
        state["valuation_meta"] = {
            "cat_cols": default["cat_cols"],
            "num_cols": default["num_cols"],
            "cat_categories": default["cat_categories"],
            "name": default.get("name"),
        }

    hcr_path = ARTIFACTS / "hcr_model.joblib"
    if hcr_path.exists():
        state["hcr"] = joblib.load(hcr_path)

    hcr_latest = ARTIFACTS / "hcr_latest.json"
    if hcr_latest.exists():
        state["hcr_latest"] = json.loads(hcr_latest.read_text())

    if DATA_FILE.exists():
        if DATA_FILE.suffix == ".parquet":
            state["transactions"] = pd.read_parquet(DATA_FILE)
        else:
            state["transactions"] = pd.read_excel(DATA_FILE)

    if _LOCATION_HIERARCHY.exists():
        state["location_hierarchy"] = json.loads(_LOCATION_HIERARCHY.read_text(encoding="utf-8"))


@app.get("/health")
def health() -> dict[str, Any]:
    df = state["transactions"]
    meta = state.get("valuation_meta")
    hcr_latest = state["hcr_latest"]
    return {
        "status": "ok",
        "version": app.version,
        "valuation": {
            "loaded": meta is not None,
            "model": meta.get("name") if meta else None,
            "available": _available_models(),
            "cached": list(_MODEL_CACHE.keys()),
        },
        "hcr": {
            "model_loaded": state["hcr"] is not None,
            "latest_period": hcr_latest.get("period") if hcr_latest else None,
            "latest_regime": hcr_latest.get("regime") if hcr_latest else None,
        },
        "transactions": {
            "loaded": df is not None,
            "rows": int(len(df)) if df is not None else 0,
            "date_range": [
                df["Transaction Date"].min().isoformat(),
                df["Transaction Date"].max().isoformat(),
            ]
            if df is not None and "Transaction Date" in df.columns
            else None,
        },
    }


class ValuationRequest(BaseModel):
    property_type: str = Field(..., examples=["2 - 2 1/2 Storey Terraced"])
    district: str = Field(..., examples=["Petaling"])
    mukim: str = Field(..., examples=["Damansara"])
    scheme: str = Field(..., examples=["Bandar Utama"])
    tenure: str = Field(..., examples=["Freehold"])
    land: float = Field(..., gt=0, description="Plot size in sqft")
    area: float | None = Field(None, ge=0, description="Built-up sqft (optional for high-rise)")
    model: str = Field("xgboost", description="Which valuation model: xgboost | rf | ft")


class Comparable(BaseModel):
    price: float
    land: float | None
    area: float | None
    district: str
    scheme: str
    transaction_date: str | None


class ValuationResponse(BaseModel):
    predicted_price: float
    price_low: float
    price_high: float
    price_per_sqft_land: float | None
    price_per_sqft_area: float | None
    currency: str = "RM"
    model: str
    val_mape: float | None = None  # median abs % error on the 2025 hold-out
    confidence: str  # "high" | "medium" | "low"
    inputs_used: dict[str, Any]
    comparables: list[Comparable]


_Z80 = 1.2816  # z-score for an 80% interval (10th–90th percentile)


def _predict_with_band(art, X: pd.DataFrame) -> tuple[float, float, float, float]:
    """Returns (y_mean, y_lo, y_hi, rel_spread) in the model's native (log) space.

    Band source, in order of preference:
      1. trained quantile heads (α=0.1/0.9) -> a per-input 80% band,
      2. a RandomForest's per-tree spread,
      3. a fixed ±1.28σ band from the saved validation residual std.
    `rel_spread` is an equivalent log-σ (half-width / z80) so the confidence
    thresholds stay comparable across all three paths.
    """
    pipe = art["model"]
    y_mean = float(pipe.predict(X)[0])

    q_lo, q_hi = art.get("quantile_lo"), art.get("quantile_hi")
    if q_lo is not None and q_hi is not None:
        # CQR: widen by the calibrated conformal offset so the band hits its
        # nominal 80% coverage; clamp to guard against quantile crossing.
        E = float(art.get("quantile_conformal", 0.0))
        y_lo = min(float(q_lo.predict(X)[0]) - E, y_mean)
        y_hi = max(float(q_hi.predict(X)[0]) + E, y_mean)
        rel_spread = (y_hi - y_lo) / 2.0 / _Z80
        return y_mean, y_lo, y_hi, rel_spread

    steps = pipe.named_steps
    if "rf" in steps:
        pre, rf = steps["pre"], steps["rf"]
        Xt = pre.transform(X)
        tree_preds = np.array([t.predict(Xt)[0] for t in rf.estimators_])
        y_mean = float(tree_preds.mean())
        half = (np.percentile(tree_preds, 90) - np.percentile(tree_preds, 10)) / 2.0
        return (
            y_mean,
            float(np.percentile(tree_preds, 10)),
            float(np.percentile(tree_preds, 90)),
            float(half / _Z80),
        )

    sigma = float(art.get("band_log_std", 0.2))
    return y_mean, y_mean - _Z80 * sigma, y_mean + _Z80 * sigma, sigma


def _find_comparables(req: ValuationRequest, n: int = 5) -> list[Comparable]:
    df = state["transactions"]
    if df is None:
        return []
    same = df[
        (df["Property Type"] == req.property_type)
        & (df["District"] == req.district)
        & (df["Tenure"] == req.tenure)
    ]
    if len(same) == 0:
        same = df[(df["Property Type"] == req.property_type) & (df["District"] == req.district)]
    if len(same) == 0:
        return []
    # rank by land similarity (cheap proxy)
    same = same.assign(_d=(same["Land"] - req.land).abs()).nsmallest(n, "_d")
    out: list[Comparable] = []
    for _, r in same.iterrows():
        out.append(
            Comparable(
                price=float(r["Price"]),
                land=None if pd.isna(r["Land"]) else float(r["Land"]),
                area=None if pd.isna(r["Area"]) else float(r["Area"]),
                district=str(r["District"]),
                scheme=str(r["Scheme Name/Area"]),
                transaction_date=r["Transaction Date"].isoformat()
                if isinstance(r["Transaction Date"], pd.Timestamp)
                else None,
            )
        )
    return out


@app.post("/valuation/predict", response_model=ValuationResponse)
def valuation_predict(req: ValuationRequest) -> ValuationResponse:
    req.district = _resolve_district(req.district)  # map map-name -> dataset name

    row = {
        "Property Type": req.property_type,
        "District": req.district,
        "Mukim": req.mukim,
        "Scheme Name/Area": req.scheme,
        "Tenure": req.tenure,
        "Land": req.land,
        "Area": req.area if req.area is not None else 0.0,
        "Area_Applicable": 1 if req.area is not None else 0,
    }
    X = pd.DataFrame([row])

    # Load + predict under the lock so only one (memory-heavy) model is resident
    # at a time on the constrained VM. Comparables come from the dataframe and are
    # built outside the lock.
    with _MODEL_LOCK:
        art = _load_model_cached(req.model)
        if art is None:
            raise HTTPException(503, "Valuation model not loaded. Run save_models.py first.")

        unseen: list[str] = []
        for col in art["cat_cols"]:
            known = art["cat_categories"].get(col, [])
            if X.at[0, col] not in known and known:
                unseen.append(col)
                X.at[0, col] = known[0]

        y_mean, y_lo, y_hi, rel_spread = _predict_with_band(art, X)
        target_log = art.get("target_log")
        model_name = art.get("name", "valuation")
        model_mape = art.get("val_mape")

    if target_log:
        price = float(np.expm1(y_mean))
        price_lo = float(np.expm1(y_lo))
        price_hi = float(np.expm1(y_hi))
    else:
        price, price_lo, price_hi = y_mean, y_lo, y_hi

    # Confidence = how tight this property's band is vs typical. Thresholds are
    # the ~33rd/66th percentiles of rel_spread over 2025 validation, so the band
    # width (now input-specific via the conformal quantile heads) maps to roughly
    # tightest / middle / widest third.
    if unseen:
        confidence = "low"
    elif rel_spread < 0.18:
        confidence = "high"
    elif rel_spread < 0.23:
        confidence = "medium"
    else:
        confidence = "low"

    return ValuationResponse(
        predicted_price=round(price, 2),
        price_low=round(price_lo, 2),
        price_high=round(price_hi, 2),
        price_per_sqft_land=round(price / req.land, 2) if req.land else None,
        price_per_sqft_area=round(price / req.area, 2) if req.area else None,
        model=model_name,
        val_mape=model_mape,
        confidence=confidence,
        inputs_used={**row, "unseen_categories": unseen},
        comparables=_find_comparables(req, n=5),
    )


def _node_items(nodes: list[dict[str, Any]], key: str = "name") -> list[dict[str, Any]]:
    return [{"value": str(n[key]), "count": int(n.get("tx_count", 0))} for n in nodes]


def _norm_district(name: str) -> str:
    """Normalize a district label so the GeoJSON map names and the dataset names
    line up: drops 'W.P.'/'Bahagian'/'Daerah', folds Hulu<->Ulu, Bharu/Baharu->
    Bahru, Highlands->Highland, and removes 'dan'."""
    s = str(name).lower().strip()
    s = re.sub(r"[.\-,]", " ", s)
    s = re.sub(r"\bw\s*p\b", " ", s)
    s = re.sub(r"\bbahagian\b", " ", s)
    s = re.sub(r"\bdaerah kecil\b", " ", s)
    s = re.sub(r"\bdaerah\b", " ", s)
    s = re.sub(r"\bhulu\b", "ulu", s)
    s = re.sub(r"\b(bharu|baharu|bahru)\b", "baru", s)
    s = re.sub(r"\bhighlands\b", "highland", s)
    s = re.sub(r"\bdan\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _district_index() -> dict[str, Any]:
    """Cached {exact names set, normalized->canonical map} from the hierarchy."""
    idx = state.get("_district_index")
    if idx is None:
        tree = state.get("location_hierarchy") or {}
        names = [d["name"] for d in tree.get("districts", [])]
        idx = {"exact": set(names), "norm": {}}
        for n in names:
            idx["norm"].setdefault(_norm_district(n), n)
        state["_district_index"] = idx
    return idx


def _resolve_district(name: str | None) -> str | None:
    """Map a GeoJSON/UI district name to the dataset's district name.

    The map labels some districts differently from the transaction data
    ('W.P. Kuala Lumpur' -> 'Kuala Lumpur', 'Ulu Langat' -> 'Hulu Langat',
    'Kuching' -> 'Bahagian Kuching', ...). Resolve by exact then normalized
    match; unknown names pass through unchanged (graceful empty result)."""
    if not name:
        return name
    idx = _district_index()
    if name in idx["exact"]:
        return name
    return idx["norm"].get(_norm_district(name), name)


def _location_district(name: str | None) -> dict[str, Any] | None:
    tree = state.get("location_hierarchy")
    if not tree or not name:
        return None
    name = _resolve_district(name)
    for district in tree.get("districts", []):
        if district.get("name") == name:
            return district
    return None


def _location_mukim(district_node: dict[str, Any] | None, name: str | None) -> dict[str, Any] | None:
    if not district_node or not name:
        return None
    for mukim_node in district_node.get("mukims", []):
        if mukim_node.get("name") == name:
            return mukim_node
    return None


def _aggregate_options(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for item in items:
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        counts[name] = counts.get(name, 0) + int(item.get("tx_count", 0))
    return [
        {"value": name, "count": count}
        for name, count in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


def _scheme_matches(
    district_node: dict[str, Any] | None,
    mukim_name: str | None = None,
    scheme_name: str | None = None,
    road_name: str | None = None,
) -> list[dict[str, Any]]:
    if not district_node:
        return []
    matches: list[dict[str, Any]] = []
    for mukim_node in district_node.get("mukims", []):
        if mukim_name and mukim_node.get("name") != mukim_name:
            continue
        for scheme_node in mukim_node.get("schemes", []):
            if scheme_name and scheme_node.get("name") != scheme_name:
                continue
            if road_name:
                roads = [
                    r for r in scheme_node.get("roads", [])
                    if str(r.get("name", "")).strip() == road_name.strip()
                ]
                for road_node in roads:
                    matches.append(
                        {
                            "mukim": mukim_node,
                            "scheme": scheme_node,
                            "road": road_node,
                            "tx_count": int(road_node.get("tx_count", 0)),
                        }
                    )
            else:
                matches.append(
                    {
                        "mukim": mukim_node,
                        "scheme": scheme_node,
                        "road": None,
                        "tx_count": int(scheme_node.get("tx_count", 0)),
                    }
                )
    return sorted(matches, key=lambda m: (-m["tx_count"], m["mukim"]["name"], m["scheme"]["name"]))


@app.get("/valuation/options")
def valuation_options(
    district: str | None = Query(None, description="Filter mukim/scheme to this district"),
    mukim: str | None = Query(None, description="Filter scheme to this mukim"),
    scheme: str | None = Query(None, description="Filter mukim to the parent of this scheme"),
    road: str | None = Query(None, description="Infer the mukim/scheme that owns this road"),
) -> dict[str, Any]:
    """Dropdown payload for the valuation form.

    Returns category lists *with transaction counts* so the UI can sort by
    popularity, plus cascading filters (district → mukim → scheme) and numeric
    ranges for slider inputs. Passing `scheme` lets the UI infer the parent
    mukim when the user already knows the scheme but not the mukim; passing
    `road` lets it infer both the mukim and scheme that own a known road.
    """
    meta = state.get("valuation_meta")
    df = state["transactions"]
    if meta is None:
        raise HTTPException(503, "Valuation model not loaded.")

    district = _resolve_district(district)  # map map-name -> dataset name

    def counted(col: str, frame: pd.DataFrame | None, top: int = 500) -> list[dict[str, Any]]:
        if frame is None or col not in frame.columns:
            vals = meta["cat_categories"].get(col, [])[:top]
            return [{"value": v, "count": None} for v in vals]
        vc = frame[col].value_counts().head(top)
        return [{"value": str(v), "count": int(c)} for v, c in vc.items()]

    district_node = _location_district(district)
    mukim_node = _location_mukim(district_node, mukim)
    road_clean = road.strip() if road else None

    mukim_options: list[dict[str, Any]] | None = None
    scheme_options: list[dict[str, Any]] | None = None

    if district_node:
        if road_clean:
            matches = _scheme_matches(district_node, mukim_name=mukim, scheme_name=scheme, road_name=road_clean)
            mukim_options = _aggregate_options([m["mukim"] | {"tx_count": m["tx_count"]} for m in matches])
            scheme_options = _aggregate_options([m["scheme"] | {"tx_count": m["tx_count"]} for m in matches])
        elif scheme:
            matches = _scheme_matches(district_node, mukim_name=mukim, scheme_name=scheme)
            mukim_options = _aggregate_options([m["mukim"] | {"tx_count": m["tx_count"]} for m in matches])
            scheme_options = _aggregate_options([m["scheme"] | {"tx_count": m["tx_count"]} for m in matches])
        elif mukim_node:
            mukim_options = _node_items([mukim_node])
            scheme_options = _node_items(mukim_node.get("schemes", []))
        else:
            mukim_options = _node_items(district_node.get("mukims", []))
            all_schemes = [
                scheme_node
                for mukim_candidate in district_node.get("mukims", [])
                for scheme_node in mukim_candidate.get("schemes", [])
            ]
            scheme_options = _aggregate_options(all_schemes)
    else:
        scope = df
        if scope is not None and district:
            scope = scope[scope["District"] == district]
        if scope is not None and mukim:
            scope = scope[scope["Mukim"] == mukim]
        if scope is not None and scheme:
            scope = scope[scope["Scheme Name/Area"] == scheme]
        if scope is not None and road_clean and "Road Name" in scope.columns:
            scope = scope[scope["Road Name"].fillna("").astype(str).str.strip() == road_clean]
        mukim_options = counted("Mukim", scope)
        scheme_options = counted("Scheme Name/Area", scope)

    tree = state.get("location_hierarchy")
    district_options = _node_items(tree.get("districts", [])) if tree else counted("District", df)

    payload: dict[str, Any] = {
        "property_type": counted("Property Type", df),
        "tenure": counted("Tenure", df),
        "district": district_options,
        "mukim": mukim_options or [],
        "scheme": scheme_options or [],
    }

    if df is not None:
        payload["ranges"] = {
            "land": {
                "min": float(df["Land"].min()),
                "median": float(df["Land"].median()),
                "max": float(df["Land"].quantile(0.99)),  # cap at p99 to skip outliers
            },
            "area": {
                "min": float(df["Area"].min()),
                "median": float(df["Area"].median()),
                "max": float(df["Area"].quantile(0.99)),
            },
        }
    return payload


@app.get("/valuation/roads")
def valuation_roads(
    district: str | None = Query(None, description="Scope roads to this district"),
    mukim: str | None = Query(None, description="Scope roads to this mukim"),
    scheme: str | None = Query(None, description="Scope roads to this scheme/area"),
    limit: int = Query(15000, ge=1, le=30000),
) -> dict[str, Any]:
    """Real road names for the selected scope (district -> mukim -> scheme).

    The road list is the actual `Road Name` column, not a generated mock. Names
    are whitespace-trimmed, de-duplicated and sorted; the count can be large at
    the district level (the UI type-filters client-side), so it's capped by
    `limit`. `total` reports the true unique count before the cap.
    """
    df = state["transactions"]
    district = _resolve_district(district)  # map map-name -> dataset name
    district_node = _location_district(district)
    if district_node:
        matches = _scheme_matches(district_node, mukim_name=mukim, scheme_name=scheme)
        road_counts: dict[str, int] = {}
        for match in matches:
            for road_node in match["scheme"].get("roads", []):
                name = str(road_node.get("name", "")).strip()
                if not name:
                    continue
                road_counts[name] = road_counts.get(name, 0) + int(road_node.get("tx_count", 0))
        roads = [
            name for name, _ in sorted(road_counts.items(), key=lambda kv: (-kv[1], kv[0]))
        ]
        return {"roads": roads[:limit], "total": len(roads)}

    if df is None or "Road Name" not in df.columns:
        return {"roads": [], "total": 0}

    scope = df
    if district:
        scope = scope[scope["District"] == district]
    if mukim:
        scope = scope[scope["Mukim"] == mukim]
    if scheme:
        scope = scope[scope["Scheme Name/Area"] == scheme]

    names = scope["Road Name"].dropna().astype(str).str.strip()
    names = names[names != ""]
    unique_sorted = sorted(names.unique().tolist())
    return {"roads": unique_sorted[:limit], "total": len(unique_sorted)}


class HCRRequest(BaseModel):
    sales_vol_yoy: float
    unsold_co: float
    unsold_uc: float
    planned_supply_yoy: float
    impaired_ratio: float
    credit_gdp_yoy: float


FEATURE_LABELS = {
    "sales_vol_yoy": "Transaction volume (YoY %)",
    "unsold_co": "Completed unsold units",
    "unsold_uc": "Under-construction unsold units",
    "planned_supply_yoy": "Planned supply (YoY %)",
    "impaired_ratio": "Property loan impaired ratio",
    "credit_gdp_yoy": "Credit-to-GDP growth (pp)",
}


class FeatureContribution(BaseModel):
    name: str
    label: str
    raw_value: float
    standardized_value: float
    coefficient: float
    contribution: float  # signed log-odds contribution
    direction: str  # "up" | "down"


class HCRResponse(BaseModel):
    probability: float
    regime: str  # "high" or "low"
    confidence: str  # "high" | "medium" | "low" — based on distance from 0.5
    interpretation: str
    contributions: list[FeatureContribution]


def _hcr_explain(features: dict[str, float]) -> HCRResponse:
    art = state["hcr"]
    cols = art["feature_cols"]
    raw = np.array([[features[c] for c in cols]], dtype=float)
    std = art["scaler"].transform(raw)[0]
    coef = art["model"].coef_[0]
    intercept = float(art["model"].intercept_[0])
    contribs = std * coef
    logit = float(contribs.sum() + intercept)
    p = 1.0 / (1.0 + np.exp(-logit))

    regime = "high" if p >= 0.5 else "low"
    margin = abs(p - 0.5)
    confidence = "high" if margin > 0.3 else "medium" if margin > 0.15 else "low"
    top = sorted(zip(cols, contribs), key=lambda kv: abs(kv[1]), reverse=True)[:3]
    drivers = ", ".join(FEATURE_LABELS.get(c, c) for c, _ in top)
    interpretation = (
        f"Model estimates a {p*100:.1f}% probability of an UP-trend housing regime "
        f"({regime.upper()}). Top drivers: {drivers}."
    )

    return HCRResponse(
        probability=round(float(p), 4),
        regime=regime,
        confidence=confidence,
        interpretation=interpretation,
        contributions=[
            FeatureContribution(
                name=c,
                label=FEATURE_LABELS.get(c, c),
                raw_value=float(features[c]),
                standardized_value=float(std[i]),
                coefficient=float(coef[i]),
                contribution=float(contribs[i]),
                direction="up" if contribs[i] >= 0 else "down",
            )
            for i, c in enumerate(cols)
        ],
    )


@app.get("/hcr/current")
def hcr_current() -> dict[str, Any]:
    latest = state["hcr_latest"]
    if latest is None:
        raise HTTPException(503, "HCR latest snapshot not loaded.")
    out: dict[str, Any] = {
        "period": latest.get("period"),
        "probability": latest.get("probability"),
        "regime": latest.get("regime"),
        "features": latest.get("features", {}),
    }
    # If the live model is loaded, attach contributions & interpretation
    if state["hcr"] is not None and isinstance(latest.get("features"), dict):
        try:
            explained = _hcr_explain(latest["features"])
            out["confidence"] = explained.confidence
            out["interpretation"] = explained.interpretation
            out["contributions"] = [c.model_dump() for c in explained.contributions]
        except Exception:
            pass
    return out


@app.post("/hcr/predict", response_model=HCRResponse)
def hcr_predict(req: HCRRequest) -> HCRResponse:
    if state["hcr"] is None:
        raise HTTPException(503, "HCR model not loaded.")
    return _hcr_explain({c: getattr(req, c) for c in state["hcr"]["feature_cols"]})


SORTABLE = {"Price", "Land", "Area", "Transaction Date", "Year"}


@app.get("/data/query")
def data_query(
    state_name: str | None = Query(None, alias="state", description="Malaysian state/territory name"),
    district: str | None = None,
    mukim: str | None = None,
    scheme: str | None = None,
    road: str | None = None,
    property_type: str | None = None,
    tenure: str | None = None,
    year: int | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    sort_by: str = Query("Transaction Date", description=f"One of {sorted(SORTABLE)}"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    full_stats: bool = Query(
        False,
        description="Include the heavier breakdowns (histogram/price_bands/tenure). "
        "Off by default — most callers only need price/yearly/by_type, and the VM is memory-constrained.",
    ),
) -> dict[str, Any]:
    df = state["transactions"]
    if df is None:
        raise HTTPException(503, "Transaction dataset not loaded.")
    if sort_by not in SORTABLE:
        raise HTTPException(400, f"sort_by must be one of {sorted(SORTABLE)}")

    district = _resolve_district(district)  # map map-name -> dataset name

    out = df
    if state_name:
        from district_income import district_state_map
        out = out[out["District"].map(district_state_map()) == state_name]
    if district:
        out = out[out["District"] == district]
    if mukim:
        out = out[out["Mukim"] == mukim]
    if scheme:
        out = out[out["Scheme Name/Area"] == scheme]
    if road:
        out = out[out["Road Name"].fillna("").astype(str).str.strip() == road.strip()]
    if property_type:
        out = out[out["Property Type"] == property_type]
    if tenure:
        out = out[out["Tenure"] == tenure]
    if year:
        out = out[out["Year"] == year]
    if min_price is not None:
        out = out[out["Price"] >= min_price]
    if max_price is not None:
        out = out[out["Price"] <= max_price]

    total = int(len(out))

    # Aggregate stats — what the frontend needs to render KPI cards / charts
    stats: dict[str, Any] = {}
    if total > 0:
        prices = out["Price"].astype(float)
        stats["price"] = {
            "count": total,
            "mean": float(prices.mean()),
            "median": float(prices.median()),
            "min": float(prices.min()),
            "max": float(prices.max()),
            "p25": float(prices.quantile(0.25)),
            "p75": float(prices.quantile(0.75)),
        }
        # Yearly trend for line charts
        yearly = (
            out.groupby("Year")["Price"]
            .agg(["count", "mean", "median"])
            .reset_index()
            .sort_values("Year")
        )
        stats["yearly"] = [
            {
                "year": int(r["Year"]),
                "count": int(r["count"]),
                "mean": float(r["mean"]),
                "median": float(r["median"]),
            }
            for _, r in yearly.iterrows()
        ]
        # Average / median price per property type (over all matched rows,
        # not just the returned page) — drives the "avg price by type" card.
        by_type = (
            out.groupby("Property Type")["Price"]
            .agg(["count", "mean", "median"])
            .reset_index()
            .sort_values("mean", ascending=False)
        )
        stats["by_type"] = [
            {
                "type": str(r["Property Type"]),
                "count": int(r["count"]),
                "mean": float(r["mean"]),
                "median": float(r["median"]),
            }
            for _, r in by_type.iterrows()
        ]
        # Heavier breakdowns — only computed when the caller asks for them
        # (full_stats=true). Most dataQuery callers (map page, valuation
        # dashboard) only read price/yearly/by_type, so skipping this by
        # default halves the aggregation work on every request — this VM
        # runs with ~2GB RAM alongside the loaded ML models.
        if full_stats:
            price_arr = prices.to_numpy()  # single array, reused below — no extra copies

            # Price histogram (10 bins on log scale → readable buckets)
            log_prices = np.log10(np.clip(price_arr, 1, None))
            counts, edges = np.histogram(log_prices, bins=10)
            stats["histogram"] = [
                {
                    "range": [round(10 ** edges[i]), round(10 ** edges[i + 1])],
                    "count": int(counts[i]),
                }
                for i in range(len(counts))
            ]

            # Fixed RM-band price distribution (matches the dashboard's default
            # bands). np.digitize + bincount is a single vectorized pass with no
            # intermediate Categorical/groupby allocation, unlike pd.cut(...).value_counts().
            band_labels = ["<200k", "200-300k", "300-400k", "400-500k", "500-700k", "700k-1m", "1-1.5m", ">1.5m"]
            band_upper = np.array([200_000, 300_000, 400_000, 500_000, 700_000, 1_000_000, 1_500_000], dtype=np.float64)
            band_idx = np.digitize(price_arr, band_upper)  # 0..7
            band_counts = np.bincount(band_idx, minlength=len(band_labels))
            stats["price_bands"] = [
                {"band": label, "count": int(band_counts[i])} for i, label in enumerate(band_labels)
            ]

            # Tenure split (freehold / leasehold / other) — tiny, low-cardinality column
            tenure_counts = out["Tenure"].value_counts()
            stats["tenure"] = [
                {"tenure": str(name), "count": int(count)} for name, count in tenure_counts.items()
            ]

    out = out.sort_values(sort_by, ascending=(order == "asc"), na_position="last")
    page = out.iloc[offset : offset + limit]

    rows = page.to_dict(orient="records")
    for r in rows:
        for k, v in r.items():
            if isinstance(v, pd.Timestamp):
                r[k] = v.isoformat()
            elif isinstance(v, float) and np.isnan(v):
                r[k] = None

    return {
        "total_matched": total,
        "returned": len(rows),
        "offset": offset,
        "limit": limit,
        "sort_by": sort_by,
        "order": order,
        "stats": stats,
        "rows": rows,
    }


@app.get("/rent-comps")
def rent_comps_endpoint(
    mukim: str = Query(..., min_length=1),
    scheme: str | None = Query(None, description="Scheme / taman / area name"),
    district: str | None = Query(None),
    state: str | None = Query(None),
    property_type: str | None = Query(None, description="Property type label for comparable rentals"),
    force_refresh: bool = Query(False, description="Bypass the empty-result cache and re-run the Exa search"),
) -> dict:
    from rent_comps import get_rent_estimate
    try:
        estimate = get_rent_estimate(
            mukim,
            scheme=scheme,
            district=district,
            state=state,
            property_type=property_type,
            force_refresh=force_refresh,
        )
        return estimate.__dict__
    except Exception as exc:
        raise HTTPException(503, f"Rent comps unavailable: {exc}") from exc


# ---------------------------------------------------------------------------
# Frontend static hosting — serves the Mytanah frontend
# at /app, so the React UI shares the API's origin (no CORS in the browser).
# ---------------------------------------------------------------------------

FRONTEND_DIR = ROOT.parent / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
DASHBOARD_DIR = FRONTEND_DIR / "ui_kits" / "dashboard"


class RevalidateStaticFiles(StaticFiles):
    """StaticFiles that forces revalidation (`Cache-Control: no-cache`).

    The dashboard is a set of separate `.jsx` files transpiled in the browser.
    Default StaticFiles sends ETag/Last-Modified but no Cache-Control, so
    browsers cache the scripts *heuristically* and may serve a stale copy of one
    file alongside a fresh copy of another after a deploy. A mismatched mix (e.g.
    a new TransactionMapPage.jsx calling getDistrictRoads while PropertyMapData.jsx
    is still the old cached version) throws a ReferenceError at render time and
    blanks the page. `no-cache` keeps the cache but requires an ETag revalidation
    on every load (cheap 304s), so the files always move forward together.
    """

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


if FRONTEND_DIR.exists():
    app.mount("/app", RevalidateStaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

if DIST_DIR.exists():
    @app.get("/dashboard", include_in_schema=False)
    @app.get("/dashboard/{path:path}", include_in_schema=False)
    def dashboard_spa(path: str = "") -> FileResponse:
        response = FileResponse(DIST_DIR / "index.html")
        response.headers["Cache-Control"] = "no-cache"
        return response

if DASHBOARD_DIR.exists():
    # Keep the Mytanah landing page at the public root. The production dashboard
    # lives at /dashboard/* through the built Vite app above.
    app.mount("/", RevalidateStaticFiles(directory=str(DASHBOARD_DIR), html=True), name="root")
else:
    @app.get("/")
    def root() -> RedirectResponse:
        return RedirectResponse(url="/docs")
