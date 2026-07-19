# Model Selection — Summary

This document explains, model by model, what was actually done in the six notebooks under
`Model Selection/`: how each model was built, how it was tuned, and how it performed. It was
reconstructed by reading every notebook (code, markdown commentary, and executed outputs) in
full — nothing here is inferred or assumed beyond what the notebooks contain.

**A note on accuracy of figures:** several notebooks have markdown commentary cells that quote
slightly different numbers than the code cell actually printed immediately above/below them —
almost certainly because the notebook was re-run at least once after the prose was drafted, and
the text was never resynced. Wherever this happened, the numbers below use the **last executed
code output** (the authoritative source), not the prose. The qualitative conclusions never change
between the two versions — only the decimals do.

## Shared foundation (identical across all six notebooks)

Every notebook starts from the same base and repeats the same core decisions, so they are
documented once here instead of six times:

- **Data source:** `processed data/Open Transaction Data Cleaned.xlsx` — 416,627 rows × 13
  columns (`Property Type, District, Mukim, Scheme Name/Area, Road Name, Transaction Date,
  Tenure, Land, Area, Unit Level, Price, Year, Month`).
- **Target transform:** `Price` is heavily right-skewed (skew ≈ 9.79 raw vs ≈ 0.14 for
  `log1p(Price)`), so every model except the OLS baseline trains on `log1p(Price)` and inverts
  predictions with `expm1` for reporting. (The OLS notebook uses plain `np.log(Price)` instead of
  `log1p`.)
- **Train/validation/test split — chronological, never random:** Train = `Year < 2025`
  (375,800 rows, 90.2%), Validation = `Year == 2025` (35,159 rows, 8.4%, used only for
  tuning/early-stopping/calibration), Test = `Year == 2026` (5,668 rows, 1.4%, touched once for
  final scoring). The stated reason, repeated in every notebook: an AVM has to price *future*
  transactions from *past* ones, and a random split would let near-duplicate listings leak across
  the train/test boundary and produce an optimistic accuracy estimate. Median training price
  (used as an RMSE-% reference) is RM 370,000.
- **Features excluded from every model, and why:** `Unit Level` (too unit-specific, meaningless
  for most property types), `Year`/`Month`/`Transaction Date` (would let the model shortcut on
  market-timing/inflation instead of learning from property attributes, and would make the
  chronological split meaningless — `Year` is used only to build the split key).
- **`Area` missingness is structural, not random:** 107,740 rows (25.9%) are missing `Area`, and
  it is close to 100% missing for high-rise/strata types (Condo/Apartment, Flat, Low-Cost
  Flat/House, Town House) and ~0% for landed types. Every notebook therefore uses a custom
  `AreaImputer`: landed types get the training-median `Area` **by Property Type**; non-landed
  types get `Area` forced to a sentinel **0** plus a binary `Area_Applicable` flag, rather than a
  fabricated median ("median-imputing floor area onto a condo would manufacture a spurious
  relationship between Property Type and Area").
- **Categorical encoding scaled to cardinality:** `Property Type`, `District`, `Tenure` (low
  cardinality, near-zero unseen-category rate on 2026 data) → one-hot encoding. `Mukim`, `Scheme
  Name/Area` (1,000+ and 20,000+ distinct values) → a custom `FrequencyEncoder` (category →
  training-set transaction count, unseen → 0), since one-hot would explode the column count and
  target-encoding risked leakage.
- **`Road Name` is measured, not assumed:** cardinality 121,825, median training frequency 1,
  35% unseen in the 2026 test data. Nearly every notebook runs an explicit experiment (fit the
  same model with vs without a frequency-encoded Road Name) and drops it because it makes test
  metrics worse while only marginally improving train fit — the signature of a noise feature
  being memorised.
- **Final 7-feature set used by every tree/ensemble/deep model:** `Property Type, District,
  Mukim, Scheme Name/Area, Tenure, Land, Area` (the LSTM and FT-Transformer additionally carry the
  `Area_Applicable` flag as an explicit numeric input).

---

## 1. Linear Regression (OLS) — `linearReg2.ipynb`

**Role:** a fast, classical benchmark — not held to the same evaluation protocol as the other
five models (see below).

**Step by step:**
1. Load the cleaned Excel file, coerce `Land`/`Area`/`Price` to numeric.
2. Drop `Mukim`, `Scheme Name/Area`, `Road Name`, `Unit Level`, `Year`, `Month` — never used as
   features (`Transaction Date` is retained only for a residual-vs-time plot).
3. One-hot encode `Property Type`, `District`, `Tenure` via `pd.get_dummies(drop_first=True)` —
   135 non-intercept features.
4. Target = `np.log(Price)` ("to get percentage effects and reduce skewness").
5. Fit **Model 1**: `statsmodels.OLS` on raw `Land`/`Area` + dummies.
6. Fit **Model 2**: same but with `log_Land`/`log_Area` in place of raw `Land`/`Area`, for
   elasticity-style coefficients.
7. Compute z-scores of Model 2's residuals and drop rows with `|z| ≥ 3` — **4,543 rows removed**
   (308,865 → 304,322).
8. Fit **Model 3** (`model_final`) on the trimmed sample, reported with `HAC` (heteroskedasticity-
   and autocorrelation-consistent) robust standard errors, 1 lag.

**No train/test split exists anywhere in this notebook** — every model is fit and scored on the
full (cleaned) sample. There is also **no hyperparameter tuning**: plain OLS has nothing to
search over, and no `GridSearchCV`/manual loop appears. The only "tuning-adjacent" choice is the
fixed `HAC maxlags=1` setting.

**Results (in-sample only):**

| Model | R² | Adj. R² | AIC | Durbin-Watson |
|---|---|---|---|---|
| 1: raw Land/Area | 0.653 | 0.653 | 3.04×10⁵ | 0.607 |
| 2: log Land/Area | 0.801 | 0.801 | 1.31×10⁵ | 0.737 |
| 3: log features, outliers trimmed, HAC SE | 0.843 | 0.843 | 2.15×10⁴ | 0.757 |

No RMSE/MAE/MAPE is ever computed — only statsmodels' native summary statistics. Diagnostics on
the final model show real problems that the notebook surfaces but does not resolve: Durbin-Watson
= 0.757 (far from 2 → strong positive residual autocorrelation) and a Breusch-Pagan test
(LM = 24,279, p ≈ 0) confirming heteroskedasticity is statistically present. A VIF
(multicollinearity) cell exists in the code but was **never executed**. Several `Property Type`
dummy coefficients also collapse to ~1e-14 with matching tiny standard errors — a numerical
artifact of near-singularity in the design matrix, not a real effect.

**Verdict:** the notebook ends immediately after the diagnostic prints — there is no closing
summary cell and no explicit "kept or discarded" decision. Because it has no chronological
holdout, its R² = 0.843 is **not comparable** to the other five models' held-out test scores, and
every later notebook that cites it flags this explicitly.

---

## 2. Decision Tree (Regression Tree) — `regressionTree.ipynb`

**Role:** an interpretable, single-tree reference point — explicitly built to fail informatively
("if it overfits badly, which is the expected, textbook behaviour for an unconstrained tree, that
is itself the finding").

**Step by step:**
1. Apply the shared preprocessing/split (above). Encode with `ColumnTransformer` (OneHot for
   low-cardinality fields, `FrequencyEncoder` for `Mukim`/`Scheme Name/Area`).
2. Run the `Road Name` experiment: fit an unconstrained `DecisionTreeRegressor(random_state=42)`
   with vs without a frequency-encoded `Road Name`. Result was a close call (with-Road-Name
   edged ahead on R²(log)/RMSE/MAE, without-Road-Name kept a slightly better MedAE and a less
   overfit train profile) — **Road Name dropped**, consistent with the other notebooks, but the
   notebook is explicit the margin "could plausibly tip the other way" under different settings.
3. Fit the **baseline**: `DecisionTreeRegressor(random_state=42)`, otherwise all sklearn defaults
   (`max_depth=None`, `min_samples_split=2`, `min_samples_leaf=1`). Result: severe overfitting —
   Train R²(log) = 0.978 vs Test R²(log) = 0.749 (a 0.230 gap), 147,989 leaves.
4. **Diagnose via cost-complexity pruning path:** `cost_complexity_pruning_path` on the full
   375,800-row training set timed out at 30 minutes, so it was computed on a fixed 40,000-row
   subsample instead, yielding 22,981 candidate `ccp_alpha` values. Evaluating 20 log-spaced
   alphas from that path located a validation-R²(log) optimum around `ccp_alpha ≈ 3×10⁻⁵`.
5. **Tune with `RandomizedSearchCV` + `PredefinedSplit`** (not k-fold — a shuffled k-fold would
   let a 2024 row "validate" a model partly fitted on 2025 data in a different fold, leaking
   future information). `PredefinedSplit` assigns all `Year < 2025` rows to "never validate" and
   all `Year == 2025` rows as the single validation fold. Search space (25 candidates):
   - `max_depth`: `[6, 8, 10, 12, 14, 16, 18, 20, None]`
   - `min_samples_split`: `[2, 5, 10, 20, 50, 100]`
   - `min_samples_leaf`: `[1, 2, 5, 10, 20, 50]`
   - `max_features`: `[None, 'sqrt', 'log2', 0.5, 0.7]`
   - `ccp_alpha`: `np.geomspace(1e-6, 1e-2, 30)` — two orders of magnitude either side of the
     pruning-path optimum found in step 4.
6. **Best found:** validation R²(log) = 0.7958 at `min_samples_split=50, min_samples_leaf=5,
   max_features=0.5, max_depth=None, ccp_alpha≈6.7×10⁻⁶`. Notably, `max_depth` itself stayed
   unconstrained — the regularization came entirely from requiring meaningful sample counts per
   split/leaf plus a small non-zero pruning alpha, not from a hard depth cap.
7. Refit that configuration on `Year < 2025` only, as the final/tuned model.

**Results:**

| Model | Train R²(log) | Test R²(log) | Test RMSE (RM) | Test MAE (RM) | Test MedAE (RM) | Leaves |
|---|---|---|---|---|---|---|
| Baseline (unconstrained) | 0.978 | 0.749 | 269,019 | 109,267 | 55,058 | 147,989 |
| **Tuned/pruned (final)** | 0.875 | **0.772** | 301,591 | 119,072 | 59,954 | 2,660 |

The overfitting gap (Train R²(log) − Test R²(log)) shrank from 0.230 to 0.103, **and** test
R²(log) improved — the notebook calls this a genuine win, "not the typical bias/variance story
where you trade test accuracy for less overfitting." One quirk worth noting: RMSE went *up*
slightly even though R²(log) went up — attributed to the log-space objective (which rewards
relative/percentage accuracy) diverging from RM-space RMSE (dominated by absolute error on the
sparse high-price tail).

**Diagnostics:** feature importance ranks `Area` (31.9%) &gt; `Property Type` (20.5%) &gt;
`District` (18.3%) &gt; `Land` (18.0%) &gt; `Mukim`/`Scheme`/`Tenure`, with an explicit caveat that
single-tree importance is unstable and can reorder correlated location features. A decision-path
walk shows the exact 23-node path taken for one sample property, used as a plain-English
explanation demo. An 80%-coverage valuation range (from 2025 validation residual quantiles)
achieved 79.6% empirical coverage on the 2026 test set.

**Verdict:** still clearly behind both ensembles (Test R²(log) 0.772 vs Random Forest's 0.820 and
XGBoost's 0.807). The notebook's own conclusion: keep Random Forest as the production model, and
retain this tree only as an optional, human-readable explanation companion, not a competitor.

---

## 3. Random Forest — `randomForest.ipynb`

**Role:** the first ensemble tried, and — per this notebook's own final comparison — the model
ultimately adopted.

**Step by step:**
1. Same shared preprocessing. `Road Name` dropped outright on five explicit grounds (deployment
   usefulness, overfitting risk, unseen-category handling, interpretability/redundancy,
   computational cost) rather than via a measured two-scenario test.
2. `Land`/`Area` are deliberately **not** log-transformed for this model ("a Random Forest splits
   on threshold comparisons, which are invariant to monotonic transforms of an input feature —
   only the target needs the transform").
3. Fit the **baseline**: `RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)`,
   otherwise sklearn defaults. Fit time 36.7s.
4. Diagnose overfitting: Train R²(log) = 0.972 vs Test R²(log) = 0.820 (gap 0.152, called "mild-
   to-moderate"). Conclusion: "more trees" isn't the fix — regularizing tree growth (depth, leaf
   size) is the promising direction.
5. **Tune with `RandomizedSearchCV` + `TimeSeriesSplit(n_splits=4)`**, run on a **25% chronological
   subsample** (93,950 rows, randomly selected then re-sorted to preserve time order) rather than
   the full training set, purely to keep the search computationally practical. Search space (25
   candidates × 4 folds = 100 fits):
   - `n_estimators`: `randint(150, 350)`
   - `max_depth`: `randint(8, 30)`
   - `min_samples_leaf`: `randint(1, 30)`
   - `min_samples_split`: `randint(2, 40)`
   - `max_features`: `['sqrt', 0.5, 0.7, None]`
6. **Best found:** `max_depth=15, max_features=None, min_samples_leaf=2, min_samples_split=7,
   n_estimators=203` (best CV RMSE, log-space).
7. Refit that configuration on the **full** training set for a fair comparison against the
   baseline. Result: it **did** narrow the overfit gap as designed, but it was **worse than the
   untuned baseline on every single test metric.**
8. **Root cause, diagnosed explicitly:** the search was tuned on only a quarter of the data,
   where shallower/more-constrained trees look artificially better in CV because there's less
   data to populate deep leaves; "that bias didn't fully transfer" once refit on the full 375,800
   rows, where the baseline's unconstrained trees had enough data per leaf for the extra capacity
   to pay for itself.
9. **Decision: keep the untuned baseline** (`n_estimators=100`, otherwise default) as the final
   model — an explicit, honestly-reported negative tuning result, not a hidden one. Flagged as
   future work: rerun the search on the full training set (or a larger subsample) with a wider
   `max_depth` range including `None`.

**Results:**

| Model | Train R²(log) | Test R²(log) | Test RMSE (RM) | Test MAE (RM) | Test MedAE (RM) |
|---|---|---|---|---|---|
| **Baseline (n_estimators=100) — FINAL** | 0.972 | **0.820** | 222,842 | 95,197 | 51,615 |
| Tuned (max_depth=15, ...) — rejected | 0.867 | 0.773 | 255,627 | 114,281 | 59,983 |

**Diagnostics:** built-in (impurity) feature importance ranks `Area` (35.9%) highest, but
permutation importance on the validation set — considered the more trustworthy view — ranks
`Land` highest (0.405) ahead of `District` (0.270) and `Property Type` (0.242), since impurity
importance is biased toward continuous features with many possible split thresholds. A local
explanation demo shows sensitivity of one prediction to swapping each feature for its training-
typical value (District swap moved the prediction the most, ±RM 160k). An 80%-coverage valuation
range is built from 2025 validation residual quantiles (never touching the test set).

**Verdict:** selected as this notebook's final production model — Test R²(log) = 0.820 beats
every other model available to it at the time of writing (OLS is excluded as non-comparable; no
Decision Tree existed yet in this notebook's own comparison table).

---

## 4. XGBoost — `xgBoost.ipynb`

**Role:** a gradient-boosted challenger to Random Forest, benchmarked against it directly.

**Step by step:**
1. Same shared preprocessing. Runs the `Road Name` two-scenario experiment explicitly (fit
   identical baseline hyperparameters with vs without frequency-encoded Road Name) — including it
   makes train fit marginally better (+0.0016 R²) but every single test metric worse, so it is
   dropped — described as "confirming, independently via a different model family, the same
   conclusion the Random Forest build reached."
2. Fit the **baseline**: `XGBRegressor(objective="reg:squarederror", n_estimators=300,
   learning_rate=0.05, max_depth=6, subsample=0.8, colsample_bytree=0.8, random_state=42,
   n_jobs=-1)`. Test R²(log) = 0.779.
3. **Tune with `RandomizedSearchCV` + `TimeSeriesSplit(n_splits=3)`** (25 candidates × 3 folds =
   75 fits, `scoring="neg_root_mean_squared_error"`), chosen over a full grid search since the
   full 9-parameter grid would be "many thousands of combinations." Search space:
   - `n_estimators`: `[200, 300, 500]`
   - `learning_rate`: `[0.03, 0.05, 0.1]`
   - `max_depth`: `[4, 5, 6, 8]`
   - `min_child_weight`: `[1, 3, 5, 10]`
   - `subsample`: `[0.6, 0.8, 1.0]`
   - `colsample_bytree`: `[0.6, 0.8, 1.0]`
   - `gamma`: `[0, 0.1, 0.5]`
   - `reg_alpha`: `[0, 0.01, 0.1, 1]`
   - `reg_lambda`: `[1, 2, 5]`
4. **Best found:** `max_depth=8, learning_rate=0.1, n_estimators=300, min_child_weight=1,
   subsample=1.0, colsample_bytree=1.0, gamma=0.1, reg_alpha=0.01, reg_lambda=2` (best CV RMSE,
   log-space, ≈0.270), found in ~188s over 25 candidates.
5. Refit with those parameters plus **early stopping** (`early_stopping_rounds=30`,
   `eval_metric="rmse"`) against the 2025 validation set only (never the test set). The final
   model used its nearly full budget (`best_iteration = 299` of 300).
6. **Adoption bar, stated up front:** "adopted only if it actually beats the baseline on the
   held-out test set, not on CV score alone." It cleared that bar — every test metric improved —
   so it was adopted, even though the train/test R² gap widened slightly rather than narrowed
   (the tuned config added capacity — deeper trees, faster learning rate — rather than purely
   regularizing, offset by non-trivial L2/L1 terms). The notebook explicitly treats this as a
   caveat, not something to hide, and contrasts it with Random Forest's tuning attempt, which
   "leaned only into heavier regularisation and lost capacity" and was rejected — "a direct
   warning not to over-regularise blindly here either."

**Results:**

| Model | Train R²(log) | Test R²(log) | Test RMSE (RM) | Test MAE (RM) | Test MedAE (RM) |
|---|---|---|---|---|---|
| Baseline | 0.848 | 0.779 | 273,240 | 119,938 | 62,741 |
| **Tuned (final)** | 0.895 | **0.807** | 256,590 | 110,588 | 58,880 |

**Diagnostics:** built-in `gain`/`cover` importance is dominated by `District` (0.82/0.99),
flagged as a measurement artifact of one-hot expanding `District` into ~125 cheap binary splits.
Permutation importance on the held-out test set — the "trustworthy" view — instead ranks `Land`
(0.380) highest, ahead of `District` (0.262) and `Property Type` (0.156). A SHAP `TreeExplainer`
worked example decomposes one prediction into per-feature contributions with confirmed additivity.
An 80%-range valuation output is calibrated from 2025 validation residual quantiles, segmented per
`Property Type` where there's enough validation data.

**Verdict — the notebook's own explicit ranking:** Random Forest baseline (0.820) &gt; XGBoost
tuned (0.807) &gt; XGBoost baseline (0.779) &gt; Random Forest tuned (0.773, rejected). Its
"Next Step" section states directly: **"Adopt Random Forest as the production model, not
XGBoost. The comparison table is unambiguous: RF's untuned baseline beats this notebook's tuned
XGBoost on every held-out test metric."** The tuned XGBoost model is still carried through the
rest of the notebook (feature importance, SHAP, deployment function) because "it is this
notebook's model, and the brief asks this notebook to deploy what it built" — not because it won.

---

## 5. LSTM Neural Network — `lstmNeuralNetwork.ipynb`

**Role:** an honest experiment in forcing a sequence model onto fundamentally tabular data
("Price is fundamentally tabular — one row per transaction, no natural per-property time series.
To use an LSTM meaningfully we therefore construct a sequence... We will not claim the LSTM is
better simply because it is 'deep learning'").

**Step by step:**
1. **Framework note:** the brief's preferred framework was TensorFlow/Keras, but the only Python
   interpreter available (3.14) has no installable TensorFlow build, so — per the brief's stated
   fallback rule — the model was implemented in **PyTorch** instead, mirroring the requested Keras
   architecture.
2. **Sequence construction (the key engineering step):** since there's no natural per-property
   time series, rows are grouped into segments of **District + Property Type** (1,023 segments),
   aggregated into monthly panels of 5 market-level features (median log-price, log transaction
   count, median land, median area, area-applicable rate). For a transaction in month *t*, the
   model receives the **prior 6 months** of that segment's history as its sequence input, shape
   `(416627, 6, 5)`; segments with less history are left-zero-padded. A leakage assertion (only
   strictly-earlier months are used) is run and passes on real 2026 data.
3. Two preprocessing variants are trained and compared under an identical architecture: **Set A**
   (filtered — Mukim capped to top 200 + "Others", Scheme capped at count≥20 + "Others") vs
   **Set B** (full original vocabulary, no filtering).
4. **Architecture:** per-categorical `nn.Embedding` tables (dim capped at 50) for the 5 static
   categorical fields; an `nn.LSTM(input_size=5, hidden_size=64, batch_first=True)` over the
   6-month sequence, whose final hidden state feeds one branch; a parallel static branch
   (embeddings + standardized `Land`/`Area` + `Area_Applicable`) through `Linear→ReLU→Dropout(0.2)`;
   the two branches concatenate into `Linear→ReLU→Dropout(0.1)→Linear(1)` predicting log-price.
   Trained with Adam (lr=1e-3), Huber loss, batch size 2048, up to 60 epochs, early stopping
   (patience 8) on 2025 validation loss with best-weight restoration.
5. Baseline run on both sets: **Set B (full vocabulary) clearly wins** — Test RMSE RM 262,000 vs
   Set A's RM 316,659 — "presumably because the high-cardinality location signal is genuinely
   useful and the embeddings absorb it."
6. **Tuning — deliberately light, and explicitly justified as such:** "the LSTM trails the trees;
   the main issue is tail extrapolation, not capacity, so an expensive search is not justified for
   a benchmark." Only two configurations were tried on Set B, selected on 2025 validation RMSE:
   - `hidden=96, dropout_stat=0.3` → validation RMSE RM 385,942
   - `hidden=128, dropout_stat=0.3` → validation RMSE RM 2,201,941 (unstable — badly diverged)
7. `hidden=96` adopted as the final configuration.

**Results (Set B):**

| Model | Train R²(log) | Test R²(log) | Test RMSE (RM) | Test MAE (RM) | Test MedAE (RM) |
|---|---|---|---|---|---|
| Baseline (hidden=64) | 0.863 | 0.767 | 262,000 | 120,672 | 65,692 |
| **Tuned (hidden=96, final)** | 0.809 | **0.770** | 246,544 | 118,993 | 64,029 |

**Diagnostics:** RM-scale R² on train/validation is deeply *negative* (e.g., −9.25 on train)
despite a healthy log-space R², traced to occasional tail over-extrapolation — "the LSTM
occasionally over-extrapolates a high log-price, and `expm1` turns that into a runaway RM figure
(a single validation prediction blew up into the hundreds of millions of RM)." A tail-robust view
filtering to properties &lt; RM 5M (99.7% of data) is used to give "the fair picture of everyday
performance."

**Verdict — quoted directly:** "Is LSTM suitable here? **Not as the primary model.** It is a
defensible experimental benchmark that can reach the trees' ballpark, but the data is tabular,
Random Forest is stronger, and the trees are simpler and free of the LSTM's tail-extrapolation
instability." Its own "Next Step" section explicitly recommends: **"Adopt a tree model as the
primary AVM (Random Forest performed best); keep the LSTM only as a documented neural benchmark,"**
and — if a neural model is pursued at all — to prefer architectures built for tabular data
("entity-embedding MLPs / TabTransformer") over forcing a sequence model — directly foreshadowing
the FT-Transformer notebook that follows.

---

## 6. FT-Transformer — `ftTransformer.ipynb`

**Role:** the tabular-native deep learning candidate suggested by the LSTM notebook's own
conclusion — a Feature Tokenizer Transformer, benchmarked against every prior model on the same
protocol.

**Step by step:**
1. Same shared preprocessing, but **keeps the full training vocabulary** for `Mukim`/`Scheme
   Name/Area` (no top-N filtering) — explicitly "equivalent to the LSTM's 'Set B', the fairest
   neural comparison."
2. **Categorical tokenization:** a custom train-only vocabulary per categorical column (integer
   index starting at 1; index 0 reserved as a shared OOV/unknown slot for anything unseen at
   train time). Vocab sizes: Property Type 12, District 126, Mukim 1,316, Scheme Name/Area 22,450,
   Tenure 3.
3. **Numeric tokenization:** each numeric feature (`Land`, `Area`, `Area_Applicable`) gets its own
   learnable per-feature affine projection (weight + bias) to a `d_token`-dim vector — the
   standard FT-Transformer numeric tokenizer, rather than simple concatenation.
4. **Architecture (custom PyTorch, no external FT-Transformer library):** 5 categorical embedding
   tables + 3 numeric tokenizers + a learnable `[CLS]` token, all at `d_token=64`, feeding a
   3-layer pre-norm (`norm_first=True`) `nn.TransformerEncoder` with 4 attention heads, GELU
   activations, dropout 0.1, feed-forward dim 128. Output head: `LayerNorm→ReLU→Linear(1)` on the
   final `[CLS]` representation. Total trainable parameters: **1,631,105** (dominated by the
   Scheme Name/Area embedding table, ≈1.44M of it).
5. **No hyperparameter search was performed** — a single fixed configuration
   (`d_token=64, n_layers=3, n_heads=4, dropout=0.1`) was built once and trained once; the
   `build_model` function does accept these as arguments, but no sweep is run over them anywhere
   in the notebook.
6. Training regularization instead came from: **AdamW** (`lr=1e-3, weight_decay=1e-4`), **Huber
   loss** (chosen for robustness to the heavy price tail), batch size 2048, up to 100 epochs, and
   **early stopping (patience 10) on validation RMSE** with best-weights restoration — the same
   validation-driven model-selection strategy used by the LSTM, just without any architecture
   search on top of it.
7. Training ran to **epoch 44** before early stopping triggered, restoring the checkpoint with
   the best validation RMSE (RM 268,113).

**Results:**

| Split | R²(log) | R²(RM) | RMSE (RM) | MAE (RM) | MedAE (RM) |
|---|---|---|---|---|---|
| Train | 0.959 | 0.939 | 134,168 | 50,308 | 25,260 |
| Validation | 0.864 | 0.845 | 268,113 | 82,810 | 44,619 |
| **Test** | **0.833** | **0.888** | **189,210** | **90,119** | **51,434** |

**Diagnostics:** no attention-weight visualization is produced. Segment breakdowns on the 2026
test set show `Detached` and `Low-Cost House` as the weakest property types (~20% relative error)
and `1-1½ Storey Semi-Detached`/`Cluster House` as the strongest (~10-11%); price-band error is
fairly flat (12-15% of median across bands). The notebook's own stated limitations: tail
over-extrapolation (same `expm1`-amplification risk as the LSTM, though trees are noted as more
tail-stable by comparison), no temporal signal (Year/Month excluded, same as every other model),
heavier CPU training cost per epoch than a tree fit for comparable accuracy, and — notably —
"only five categoricals and three numerics are available; FT-Transformers shine most with many
interacting features, so the architecture is somewhat under-utilised here."

**Verdict:** on this run, the FT-Transformer numerically **beats every other model** in its own
comparison table, including the Random Forest baseline (RMSE RM 189,210 vs RM 222,842) and the
tuned LSTM (RMSE RM 246,544). Its own conclusion cell confirms this programmatically ("Beat
Random Forest? YES... Lowest test RMSE overall: FT-Transformer... FT-Transformer is
competitive/best; viable candidate"), while still framing the win cautiously: **"Gradient-boosted
trees remain the pragmatic default for this tabular problem; a transformer earns production use
only when it clearly wins or adds value (e.g. uncertainty, shared embeddings)."**

---

## Cross-model comparison (2026 held-out test set)

Using each model's own final/best configuration, on the identical `Year == 2026` test rows:

| Model | Test R²(log) | Test RMSE (RM) | Test MAE (RM) | Test MedAE (RM) | Tuned? |
|---|---|---|---|---|---|
| Linear Regression (OLS) | 0.843 *(in-sample only — no holdout, not comparable)* | — | — | — | No — no tunable hyperparameters |
| Decision Tree (pruned) | 0.772 | 301,591 | 119,072 | 59,954 | Yes — `RandomizedSearchCV` + pruning path |
| Random Forest | **0.820** | **222,842** | 95,197 | **51,615** | Attempted, rejected — kept untuned baseline |
| XGBoost | 0.807 | 256,590 | 110,588 | 58,880 | Yes — `RandomizedSearchCV`, adopted |
| LSTM (Set B) | 0.770 | 246,544 | 118,993 | 64,029 | Yes — small manual grid, adopted |
| FT-Transformer | **0.833** | **189,210** | **90,119** | 51,434 | No — fixed architecture, only training-time regularization tuned |

**What this means for the project as a whole:** Linear Regression and the single Decision Tree
were explicitly built and kept as *baselines/diagnostics* rather than production candidates —
both notebooks say so directly. The LSTM was explicitly rejected in favor of tree-based and
tabular-native architectures. Random Forest, XGBoost, and the FT-Transformer are the three models
that survived this process and are the three actually deployed in production (per
`backend/save_models.py` / the API's lazy single-slot model loading) — even though, taken
individually, each notebook's own internal verdict doesn't unanimously agree on a single "best"
model (the XGBoost notebook recommends deploying Random Forest over its own tuned model; the
FT-Transformer notebook's own run numerically beats both). That disagreement across notebooks is
reported here as-is rather than smoothed over, since it reflects genuine measured trade-offs
(RMSE vs interpretability vs tail stability vs training cost) rather than a single unambiguous
winner.
