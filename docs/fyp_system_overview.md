# Mytanah — System Overview & Documentation Context

> **Purpose of this document**: this is a briefing document for whoever (human or AI)
> writes/continues the FYP documentation. It explains what the system actually does
> end-to-end *today*, what the data science findings were, and — critically — how
> that compares to what the existing Part 1 IR document (`Voon Kai
> Wen-TP077157-APU3F2511CS(DA)-IR.docx`) already claims, since parts of that document
> describe an earlier version of the project that has since moved on (most notably:
> Google Trends). It is not itself a chapter of the FYP report — it's the reference
> material for writing those chapters.
>
> Companion files:
> - [`fyp_part1_ir_content.md`](./fyp_part1_ir_content.md) — faithful record of what
>   the existing Part 1 docx currently says, chapter by chapter, including every
>   Google Trends mention verbatim.
> - `New IR Structure Guidelines.pdf` (`C:\Users\User\Documents\APU\FYP\`) — APU's
>   official IR chapter template for SOC/SOT (CSDA track). Section 10 below maps this
>   system's content onto that template.
>
> Last verified against the codebase: 2026-07-06 (see git log `d2ae290` and prior).
> Treat specifics (metrics, file paths, line numbers) as a snapshot — re-verify before
> quoting them in the final submitted document.

---

## 0. Goal — what you (the AI reading this) are actually trying to achieve

The end deliverable is the **completed FYP write-up** — Part 1's four IR chapters
brought up to date, and eventually the Part 2 chapters that build on them. This file
is not that deliverable; it's the fact base you draft from. Concretely, your job when
someone points you at this document is:

1. **Read all three sources together** before drafting anything: this file (current
   system truth), `fyp_part1_ir_content.md` (what's already written, verbatim), and
   `New IR Structure Guidelines.pdf` (the required chapter shape). Section 10 above
   is the bridge between them — use it as your outline.
2. **Go chapter by chapter, not section by section in isolation.** Google Trends
   removal alone touches the Abstract, most of Chapter 1, three Lit Review
   subsections, one of four datasets in Chapter 3, and a Chapter 4 gap — treat it as
   one coordinated edit pass, not a find-and-delete.
3. **Default to keeping what's still true.** Large parts of Part 1 (valuation theory,
   hedonic pricing, housing-cycle/EWS literature, the NAPIC/CEIC/BNM dataset
   descriptions, the CRISP-DM choice itself) are accurate and well-cited — reuse
   them. Only rewrite what §10 flags as stale (Google Trends framing, the
   RF+MLP+MLR model story, the Markov-switching/ECM HCR description, price-band
   classification). Don't invent new literature citations to fill gaps — if a claim
   needs a source and none exists in the current References, say so rather than
   fabricating one.
4. **Don't silently resolve §11's open questions.** Title compliance, Part 2 scope
   (does rent-comps/ROI get its own objective?), the HCR artifact reproducibility
   gap, the Objective 2/3 rewrite, and which model headlines the abstract are the
   student's/supervisor's calls. Surface them, propose an option, wait for a
   decision — don't pick one and write around it as settled fact.
5. **Every new factual claim about the system (a metric, a file path, an endpoint, a
   feature) must trace back to this document or a fresh check against the actual
   code** — not be inferred or reconstructed from memory. If something here looks
   like it may have drifted since 2026-07-06 (new commits, changed metrics), verify
   against the live repo before writing it into the report.
6. **Confirm output format before generating full chapter prose** — whether the user
   wants markdown drafts to paste into the `.docx` by hand, or something else. Don't
   assume.

---

## 1. What the system is

**Mytanah** is a Malaysian residential property intelligence web dashboard. It takes
NAPIC's public open transaction data plus several macroeconomic time series and turns
them into four end-user-facing tools behind one FastAPI backend and one React (Vite)
frontend:

1. **Valuation** — predicts a fair-value price range for a specific property (given
   type/location/tenure/land/floor area) from three trained ML models.
2. **Housing Cycle Regime ("Sentiment") indicator** — classifies whether the current
   quarter is a high-price or low-price phase of the Malaysian housing cycle, via a
   Hodrick-Prescott filter + logistic regression on 6 macro indicators.
3. **Market Overview** — a set of precomputed national/state-level charts (price by
   state, transaction volume trend, tenure split, property-type mix, top districts).
4. **ROI Calculator** — a buy-to-rent cash-flow/ROI calculator that pulls a live
   estimated market rent (via an AI rent-comparables agent) as its default income input.

There is also a **rent-comparables AI agent** (`backend/rent_comps/`) that isn't a
user-facing page itself but powers the ROI calculator's rent estimate, using live web
search (Exa) with two fallback paths (a personal "Hermes" scraper service, or a
last-resort LLM+browser agent).

**Not part of the FYP scope**: `fraud_report/` is a separate hackathon side-project
("Trust, Commerce & Fraud" track) — a planned but unimplemented fraud-risk research
report feature. It has a plan document and a PDF-styling skill but no working code,
is not wired into `backend/api.py`, and should not be described as part of this
system unless the student decides to actually fold it in as Part 2 scope.

**Brand framing** (`PRODUCT.md`): built for an FYP examiner audience first (needs to
read as production-quality, not a notebook demo), Malaysian property buyers/investors
second. Cream + forest-green + earth-brown palette, warm/authoritative "knowledgeable
financial advisor" tone, not a generic SaaS dashboard.

---

## 2. Data pipeline end-to-end

**Raw sources** (`property data/`, all secondary/open data — no primary data
collection, consistent with the CSDA track's IR guideline carve-out that survey/
interview is optional for data-analytics projects):

| File | Content |
|---|---|
| `Open Transaction Data.xlsx` | Core NAPIC residential transaction records (raw) |
| `Time Series since 2001.xlsx` | 4 sheets: quarterly property sales volume, house price index, unsold units, planned supply |
| `Quarterly_Impaired_Prop_Loan_Ratio_(98-25).xlsx` + 4 related `Impaired*.xlsx` | BNM impaired property loan ratio, built up from 3 discontinued/overlapping BNM tables |
| `BIS_credittogdp.xlsx` | Household credit-to-GDP (Bank for International Settlements) |
| `Planned Supply_Contemporaneous.xlsx`, `Transaction Volume_Contemporaenous.xlsx`, `Unsold_Contemporaneous.xls` | Supplementary supply/volume series |
| `time_series_MY_keywords.csv` | Google Trends export, 5 MY property keywords, monthly 2004–2026 — **explored but not used in production** (§6) |

**Processed outputs** (`processed data/`):

| File | Produced by | Contents |
|---|---|---|
| `Open Transaction Data Cleaned.xlsx` / `transactions.parquet` | `Data Exploration & Cleaning/Data_Understanding_Open_Transaction.ipynb` | ~416,627 rows × 13 cols, the authoritative dataset every model trains on |
| `location_hierarchy.json` / `_edges.csv` / `_summary.json` | `backend/build_location_hierarchy.py` | District → Mukim → Scheme → Road tree with transaction counts |
| `scheme_mukim_index.csv` | `backend/build_scheme_mukim_index.py` | Scheme/Area → Mukim lookup, backs the rent-comps location resolution |

**Column semantics** (see also [[reference_open_transaction_columns]] memory):
`Land` = total plot/lot size (sqm); `Area` = built-up/internal floor space (sqm, ~26%
missing — structurally 100% missing for strata types: condo/apartment, flat,
low-cost flat, town house, and ~0% missing for landed types). **Everything is in
square metres, not sqft** — a real bug (frontend once multiplied by 10.7639 before
calling the API, inflating a ~RM360k Petaling condo prediction to ~RM4.69M) was fixed
in commit `4815aa6`.

**Cleaning findings** (`Data_Understanding_Open_Transaction.ipynb`):
- Rows with missing `Price` dropped; missing `Area` is preserved (not dropped) —
  handled downstream by an `Area_Applicable` flag per model.
- Five explicit decimal-shift corrections on `Land/Parcel Area` (data-entry errors):
  `159390→159.39`, `31958→319.58`, `20057→200.57`, `8817→88.17`, `2000→200`.
- `Price` is heavily right-skewed (skewness 9.79 raw → 0.14 after `log1p`) — **every**
  valuation model trains on `log1p(Price)`, not raw price.
- Chronological split used consistently across all six model-selection notebooks:
  Train = `Year < 2025` (375,800 rows), Val = `Year == 2025` (35,159), Test =
  `Year == 2026` (5,668). `Road Name` was tested as a feature and consistently
  dropped (median training frequency 1, 35% unseen in the 2026 test set — hurts
  generalisation).

---

## 3. Feature: Valuation

### 3.1 Model trial phase (`Model Selection/*.ipynb`)

Six models were trained and compared, all on the same chronological split and the
same `log1p(Price)` target:

| Notebook | Model | Test R² (log-price) | Test RMSE | Test MedAE | Notebook's verdict |
|---|---|---|---|---|---|
| `linearReg2.ipynb` | OLS, log(Land)/log(Area) + dummies | 0.843 (in-sample, no holdout — not comparable) | — | — | reference baseline only |
| `regressionTree.ipynb` | Pruned decision tree | 0.772 | RM 301,591 | RM 59,954 | interpretability baseline; loses to ensembles |
| `randomForest.ipynb` | `RandomForestRegressor`, untuned 100-tree baseline (kept over a tuned/regularised variant) | **0.820** | RM 222,842 | RM 51,615 | "Adopt Random Forest as production model" |
| `xgBoost.ipynb` | `XGBRegressor` (depth 8, lr 0.1, 300 trees) | 0.807 | RM 256,590 | RM 58,880 | beats regression tree/LSTM, not RF in this notebook's own numbers |
| `lstmNeuralNetwork.ipynb` | PyTorch LSTM over 6-month segment-history sequences + static embeddings | 0.770 | RM 246,544 | RM 64,029 | "does not beat the best tree model" |
| `ftTransformer.ipynb` | PyTorch Feature-Tokenizer + Transformer | **0.833 (best of all six)** | **RM 189,210 (lowest)** | RM 51,434 | "competitive/best; viable candidate" |

**Important nuance for the Results/Model Selection write-up**: the notebooks'
own numbers rank Random Forest and FT-Transformer above XGBoost, yet XGBoost is
what actually ships as the *default* model in production (next section). This is a
legitimate, defensible engineering call — worth stating explicitly as a design
decision rather than letting it read as an oversight — but the reasoning (likely:
XGBoost's ~96MB artifact vs. RF's ~203MB, plus native quantile-regression support for
prediction bands, vs. only a fixed sigma band for FT-Transformer) isn't written down
anywhere in code and should be justified in the report rather than assumed.

### 3.2 What's actually served in production (`backend/api.py`, `backend/save_models.py`)

Three real models, switchable per request (`model=xgboost|rf|ft`), **not** the MLR/RF
classifier/ANN combination described in the Part 1 docx:

- **XGBoost** — default model. Artifact `backend/artifacts/valuation_model.joblib`
  (~96MB, git-tracked).
- **Random Forest (tuned)** — artifact `valuation_rf.joblib` (~203MB, gitignored,
  exceeds GitHub's soft limit; built once and shipped to the VM via `scp`, not
  tracked in git).
- **FT-Transformer** — artifact `valuation_ft.joblib` (~6.5MB, git-tracked). Custom
  PyTorch model served via `backend/ft_transformer.py`'s `FTTransformerRegressor`, a
  joblib wrapper that lazily imports `torch` only on first FT request (~200MB
  resident) and stores weights as raw little-endian float32 bytes specifically to
  dodge a numpy pickle version conflict between the training environment (numpy≥2.0)
  and the VM's numpy 1.26.4 (an `MLPRegressor`'s pickled `RandomState`/`BitGenerator`
  otherwise fails to load cross-version — this is why the third model isn't a
  vanilla sklearn MLP).

**Prediction bands**: XGBoost/RF use conformalized quantile regression (CQR) — the
artifact bundles the mean model plus two quantile heads (α=0.1/0.9) plus a calibrated
conformal offset, giving input-specific band widths (tight for condos, wide for
detached houses). FT-Transformer uses a fixed ±1.28σ log-space band instead (no
quantile heads, since it exposes an empty `.named_steps` to `api.py`'s band logic).

**Operational constraint**: due to VM RAM limits (started at ~1GB, since resized;
OOM has recurred and once required a hard VM reset), `api.py` uses lazy single-slot
LRU model loading — only one of the three models is resident in memory at a time,
loaded on first request and evicted when another model is requested.

### 3.3 What this means for the report

The Literature Review's ML-approach subsection (2.2.4 in the old docx) needs
rewriting: it currently frames Random Forest as primary and MLP as secondary, with
Gradient Boosting/XGBoost explicitly "considered but not selected." The actual system
does the opposite — XGBoost is the shipped default, and there is no MLP/ANN in
production at all (LSTM and FT-Transformer were the neural architectures actually
tried, not a plain MLP). The Methodology chapter's CRISP-DM "Modelling" phase
description (which describes RF as a *classifier* over 4 price *bands*) also no
longer matches — the system is a continuous regression problem end to end, not
classification.

---

## 4. Feature: Housing Cycle Regime ("Sentiment") indicator

This is the feature the old docx calls the "housing market risk factor" /
"Sentiment Index," but its actual mechanics differ substantially from what's written
there.

### 4.1 Methodology actually used

`Data Exploration & Cleaning/HCR_Logit_Regression.ipynb`:

1. Reconstruct a Malaysia mean house price series (anchored at RM 498,590 for
   2025Q2).
2. Apply a **Hodrick-Prescott filter (λ=1600)** to decompose it into trend vs. cycle.
3. Label each quarter binary: `cycle_pos = 1` if price is above trend (high-price
   regime), else 0.
4. Fit a **logistic regression** (not Markov regime-switching, not an ECM — those
   appear in the old docx's Methodology chapter but not in the actual notebook) on 6
   standardized predictors:

   ```
   sales_vol_yoy, unsold_co, unsold_uc, planned_supply_yoy, impaired_ratio, credit_gdp_yoy
   ```

   N = 91 quarterly observations, 2003Q1–2025Q3.

**Google Trends is not one of the 6 predictors.** It was explored in a fully separate
notebook (`Data_Understanding_Google_Trend.ipynb`, 34 cells) that only assesses the
Google Trends data's *suitability* as a demand proxy — it concludes the composite
index's post-2010 decline reflects search-behaviour migration to dedicated property
portals (PropertyGuru/iProperty/Mudah.my) rather than falling actual demand, and
recommends (if ever used) restricting to post-2010, YoY-detrending, and treating
"House for sale" as the primary signal rather than the multi-keyword composite. That
notebook's output is never merged into `HCR_Logit_Regression.ipynb`'s feature set,
never exported to any file the backend reads, and `google`/`trend` do not appear
anywhere in `backend/api.py` or `backend/save_models.py` (the only "trend" string
hits in the backend are unrelated — "UP-trend housing regime" copy text and "yearly
trend for line charts"). **Conclusion: Google Trends was investigated as a candidate
predictor and explicitly not adopted — it's a completed, honestly-documented
dead-end, not an oversight.** This is a defensible, reportable finding in its own
right (the Chapter 4 "gaps for Semester 2" framing in the old docx, which treats
Google Trends as the *current* mechanism and NLP as the *future* upgrade, needs to be
replaced with: "Google Trends was evaluated and rejected as a predictor; the final
model instead relies on 6 macro/transaction-based indicators").

### 4.2 Model performance (from the notebook)

- McFadden pseudo-R² = 0.3875, Nagelkerke R² = 0.5478
- **AUC = 0.9031**, accuracy = 0.84 (threshold 0.5; precision/recall 0.83–0.91 per class)
- AIC = 88.28
- All VIFs < 2 (no multicollinearity concern)
- Hosmer-Lemeshow test **rejects** good calibration (p≈0.0000) despite the strong
  discrimination (AUC) — an honest caveat worth stating in the report rather than
  hiding: the model separates classes well but its predicted probabilities aren't
  perfectly calibrated.
- Statistically significant predictors (p<0.05): `unsold_co` (OR=0.106),
  `unsold_uc` (OR=6.68), `credit_gdp_yoy` (OR=0.390). `impaired_ratio` (OR=1.29,
  p=0.563), `sales_vol_yoy`, and `planned_supply_yoy` are retained in the
  multivariate model but are not individually significant.

### 4.3 Served API vs. what's actually present locally

`GET /hcr/current` and `POST /hcr/predict` (`backend/api.py`) expect the same 6
features and return regime probability + label + per-feature signed log-odds
contributions + a plain-English interpretation string. The model is **not** computed
live — it's a saved `hcr_model.joblib` (LogisticRegression + StandardScaler) and a
precomputed `hcr_latest.json` snapshot, both built by `save_models.py`'s
`train_hcr()`, which itself reads a hand-assembled `backend/hcr_quarterly.csv` that
does **not exist anywhere in this repo checkout** (no notebook or script currently
produces it — `save_models.py` prints "hcr_quarterly.csv missing - skipping HCR model
training" and exits if it's absent).

**Neither `hcr_model.joblib` nor `hcr_latest.json` exists in the local checkout** —
only the three valuation artifacts are present. This means, as checked out locally,
`/hcr/current` and `/hcr/predict` would both return 503. These artifacts likely exist
only on the deployed VM, built there from a manually-placed `hcr_quarterly.csv`. This
is worth resolving before writing the Results/Testing chapters two ways: (1) confirm
directly on the VM that these artifacts are present and current, and (2) consider
adding a script/notebook cell that mechanically produces `hcr_quarterly.csv` from the
same source data the notebook already loads — right now the reproducibility chain
between "notebook that develops the model" and "CSV the production trainer expects"
has a manual, undocumented hand-off, which is a legitimate methodological gap to
either fix or explicitly note as a limitation.

### 4.4 Why the dashboard still says "Sentiment"

`frontend/dashboard-app/src/pages/SentimentPage.jsx` is the page for this feature,
and its UI copy is "Housing cycle sentiment signal" — but the underlying data is the
HCR regime probability described above, **not** a Google-Trends-derived sentiment
score. The page renders: a live-fetched regime gauge (`API.hcrCurrent()`, falling
back silently to a hardcoded snapshot — `period: '2025 Q3', probability: 0.1718,
regime: 'low'` — if the API call fails, which per §4.3 it currently would), a
hardcoded historical HP-filter cycle chart (1989–2025 quarterly), and 6 hardcoded
indicator mini-charts (the same 6 features as §4.1). Because the fallback renders
successfully even when the live endpoint 503s, this is easy to miss in a demo — worth
flagging as a testing/QA item, not just a documentation nuance.

**For the report**: it's accurate to keep calling this the "Sentiment" feature in
user-facing copy if that's the established branding, but the *methodology* chapter
must describe it as a macroeconomic housing-cycle regime classifier, not a
text/Google-Trends sentiment-analysis system — the old docx's Objective 2/3 language
("Malaysian Housing Sentiment Index... from Google Trends") describes a mechanism
that isn't what ships.

---

## 5. Feature: Rent-comparables AI agent

`backend/rent_comps/` — given a location (mukim/scheme/district/state) and optional
property type, produces an aggregate estimated monthly rent (avg/min/max/median,
listing count, confidence tier, sample listings). This isn't a standalone dashboard
page; it's a service consumed by the ROI Calculator (§6).

Three backends tried in priority order (`__init__.py`):

1. **Exa Search API** (`exa.py`) — if `EXA_API_KEY` set: a single structured-output
   search+synthesis call to `api.exa.ai/search`. This is the current live path (most
   recent commits fix NAPIC abbreviation expansion and numeric-mukim-code stripping
   in the query construction, `context.py`).
2. **Hermes desktop agent** (`hermes.py`) — if `HERMES_URL` is set instead: POSTs to
   `<HERMES_URL>/api/scrape-rent`. Per the module docstring, Hermes is a **separate
   script running on a personal machine** (not part of this repo), reached via a
   tunnel URL — an external companion service referenced only by env var.
3. **Local LLM+browser fallback** (`agent.py`) — last resort: a Gemini 2.5 Flash
   agent (via `litellm`) driving a Playwright MCP server to scrape Mudah.my/
   PropertyGuru directly, capped at $2 cost / 40 turns.

All three normalise to one `RentEstimate` schema (`schema.py`), cached to disk
(`backend/.cache/rent_comps/*.json`, 48h TTL for real hits, 1h for empty results).

This entire feature post-dates the Part 1 IR document — it isn't mentioned there at
all. If Part 2 scope includes it, it needs new objective(s)/scope language, since none
of the current 4 objectives cover a rent-market/ROI capability.

---

## 6. Feature: ROI Calculator

`frontend/dashboard-app/src/pages/RoiCalculator.jsx` — a buy-to-rent cash-flow
calculator (loan amortisation, break-even period, gross yield, ROI%), all computed
client-side from user-entered cost/income line items. The one piece of "live" data
is the default rental-income figure, auto-populated via `API.rentComps(...)` (§5) —
this is what the recent commit "ROI live estimate - expand NAPIC abbreviations,
force_refresh on retry" refers to (a rent-comps query-construction fix, not a new ROI
endpoint). There is no dedicated `/roi` backend route; the math lives entirely in the
frontend.

Also post-dates Part 1 — not mentioned there.

---

## 7. Feature: Market Overview page

`frontend/dashboard-app/src/pages/MarketOverviewPage.jsx` — choropleth of average
price by state, transaction-volume trend, price distribution, tenure split,
property-type breakdown, top districts. **All figures are precomputed and hardcoded
directly in the JSX** (comments in the code note they're "actual, from the parquet"
— i.e., derived once from `transactions.parquet` and pasted in, not fetched live at
runtime). Worth noting in the Design/Implementation chapter as a deliberate
performance/simplicity trade-off, and worth double-checking the hardcoded numbers
are still accurate if the underlying dataset is refreshed before final submission.

---

## 8. API surface (`backend/api.py`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Model/data load status, transaction row count + date range |
| POST | `/valuation/predict` | Price prediction (`model=xgboost\|rf\|ft`) — point estimate, 80% band, confidence tier, comparables |
| GET | `/valuation/options` | Cascading dropdown data (type/tenure/district/mukim/scheme) with counts + Land/Area ranges |
| GET | `/valuation/roads` | Real road names for a given scope |
| GET | `/hcr/current` | Latest precomputed regime probability + contributions (503 if artifacts missing, §4.3) |
| POST | `/hcr/predict` | Regime probability for a custom 6-feature macro vector |
| GET | `/data/query` | Filtered/paginated transaction slice + aggregate stats (used by Market/Transaction Map pages) |
| GET | `/rent-comps` | Rent estimate via Exa/Hermes/local-agent fallback chain |
| GET | `/app/*` | Legacy CDN dashboard static mount (fallback) |
| GET | `/dashboard`, `/dashboard/{path}` | Built Vite SPA |
| GET | `/` | CDN landing page (or redirect to `/docs` if absent) |

No `/fraud-risk/*` route exists (confirms §1's scope note).

---

## 9. Frontend structure

`frontend/dashboard-app/` (Vite + React + Tailwind + shadcn/ui) — the active
dashboard target. Routes:

| Route | Page | Notes |
|---|---|---|
| `/dashboard` | `TransactionMapPage.jsx` | Interactive map + the `ValuationDashboard.jsx` prediction form |
| `/dashboard/market` | `MarketOverviewPage.jsx` | Hardcoded/precomputed market analytics (§7) |
| `/dashboard/roi` | `RoiCalculator.jsx` | ROI calculator (§6) |
| `/dashboard/sentiment` | `SentimentPage.jsx` | HCR regime dashboard (§4.4) |

`frontend/ui_kits/dashboard/` is the legacy CDN-React landing page (still served at
`/`) — not where active development happens. `IntroPage.jsx` was recently deleted
(git status shows it as removed) with no remaining reference in `App.jsx`, consistent
with `/` now redirecting straight into `/dashboard`.

---

## 10. Mapping onto the New IR Structure Guidelines (CSDA track)

The guideline PDF (`New IR Structure Guidelines.pdf`) specifies Cover, Acknowledgement,
Abstract (200–250 words, ≤6 keywords), TOC, List of Figures, List of Tables, then:

- **Chapter 1 (Introduction)**: 1.1 Introduction, 1.2 Problem Background, 1.3 Project
  Aim, 1.4 Objectives (3–4, each starting "To..."), 1.5 Scope, 1.6 Potential Benefits,
  1.7 Overview of IR, 1.8 Project Plan. Must relate to a chosen SDG throughout.
- **Chapter 2 (Literature Review)**: 2.1 Introduction, 2.2 Domain Research, 2.3
  Similar Systems/Works, 2.4 Technical Research (hardware/software/IDE/libraries/
  DBMS/OS — several sub-items explicitly optional), 2.5 Summary.
- **Chapter 3 (Methodology) — CSDA-specific variant** (no survey/interview mandated):
  3.1 Introduction, 3.2 Methodology (choice + justification — CRISP-DM/KDD/SEMMA),
  3.3 Data Collection (source + link per dataset), 3.4 Initial Data Pre-processing &
  Data Understanding (missing values, outliers, transformation, standardisation,
  normalisation; variables, observations, histograms/visualisations), 3.5 Summary.
- **Chapter 4 (Conclusion)**: 4.1 achievement of Part 1, 4.2 sufficiency of
  investigation vs. the chosen SDG, 4.3 gaps to explore in Part 2.
- References (APA), then Appendices A–F (PPF, Ethics Forms, Log Sheets, Gantt Chart,
  Respondent Demographics [**optional for CSDA** — no survey/interview required],
  Turnitin Similarity Report ≤20%).

**How this system's content maps in, chapter by chapter:**

- **Ch1**: Aim/Objectives need rewriting to drop the Google Trends-based Objective 2
  wording and to reflect what's actually built (3-model valuation regression, 6-factor
  HCR classifier, plus — if in scope — rent-comps/ROI). SDG 11 framing (housing
  affordability/information asymmetry) still holds up well independent of the Google
  Trends question and doesn't need to change.
- **Ch2 Domain Research**: property valuation theory, hedonic pricing, and housing
  cycle/EWS literature (2.2.1–2.2.4, 2.2.7 in the old docx) are still relevant and
  reusable largely as-is. The two Google-Trends-specific subsections (2.2.5, 2.2.6)
  and the Sumantyo et al. review (2.3.5) either need removing or reframing as "this
  was investigated and found not to add predictive value here" rather than as the
  system's actual mechanism.
- **Ch2 ML Approaches subsection (2.2.4)**: needs rewriting per §3.3 above — XGBoost/
  Random Forest/FT-Transformer are the real story, not RF+MLP+MLR with Gradient
  Boosting rejected.
- **Ch3 Methodology**: CRISP-DM is a reasonable framing to keep (still matches an
  iterative notebook-driven data-analytics workflow), but the "Modelling" phase
  description needs to describe the actual model set (§3) and the actual HCR pipeline
  (HP filter → logistic regression on 6 macro predictors, §4.1) instead of Markov
  regime-switching/ECM and RF-as-classifier.
- **Ch3 Data Collection/Understanding**: Datasets 1–3 (NAPIC transactions, CEIC macro
  series, BNM impaired loans) are accurate and reusable as-is (verify the exact row
  counts against current `transactions.parquet`, §2). Dataset 4 (Google Trends) either
  gets removed or reframed as an investigated-and-rejected candidate feature with its
  existing "Conditionally suitable" findings kept as evidence of due diligence, not as
  a live pipeline input.
- **Ch4 Conclusion**: Gap 1 (NLP for sentiment, framing Google Trends as the interim
  mechanism) needs replacing — there's no sentiment/NLP gap to close if Google Trends
  was already evaluated and rejected; the honest gap is closer to "the housing-cycle
  classifier could be extended with better-calibrated probabilities (Hosmer-Lemeshow
  currently fails) or sub-national/state-level granularity," which is coincidentally
  still consistent with old Gap 2 (sub-market disaggregation).
- **Appendices**: CSDA track makes survey/interview + respondent demographics
  optional — consistent with this project having no primary data collection at all.
  Nothing to change here structurally; just confirm PPF/Ethics/Log Sheets/Turnitin
  appendices are current.

---

## 11. Open questions to resolve before/while drafting

These are judgment calls for the student (and possibly the supervisor), not things to
silently decide:

1. **Title compliance** (see `fyp_part1_ir_content.md` §1) — the current title names
   the system itself ("Automatic Valuation Model (AVM)"), which the guideline's own
   bad-example pattern matches almost exactly. Titles are meant to be locked at IR
   stage; changing it now has real cost/risk — flag to supervisor rather than change
   unilaterally.
2. **Scope of "Part 2"**: does the rent-comps agent + ROI calculator count as new
   objectives/scope for the second half of the FYP, or are they positioned as
   supporting infrastructure for the existing objectives? They currently have no
   objective-level backing at all in the IR.
3. **HCR artifact reproducibility gap** (§4.3): `hcr_quarterly.csv` is hand-assembled
   and not reproducible from any script in this repo, and the served artifacts are
   entirely absent from the local checkout. This should be resolved (either by
   confirming/documenting the VM's build process, or by adding a proper generation
   script) before writing a Testing/Results chapter that claims this feature works
   end-to-end.
4. **Objective 2 & 3 replacement wording**: since Google Trends is out, Objective 2
   ("construct a composite Malaysian Housing Sentiment Index using Google Trends...")
   has no direct replacement target in the current system — decide whether to drop
   it to 3 objectives total (still within the guideline's 3–4 range) or rewrite it
   around a different, currently-implemented capability (e.g., the rent-comps/ROI
   feature, if that's in scope).
5. **Which model is "the" model for the abstract/headline claim**: XGBoost is the
   production default, but Random Forest and FT-Transformer score marginally better
   in the notebooks' own held-out test. Decide how to state this in the abstract/
   results without contradiction (recommendation: report all three, name XGBoost as
   the deployed default, and give the deployment-engineering reason explicitly).
