# Part 1 IR — Existing Document Content (Reference Record)

> Extracted from `Voon Kai Wen-TP077157-APU3F2511CS(DA)-IR.docx` (Submission folder,
> last modified 2026-03-11). This is a faithful, near-verbatim record of what that
> document currently says, kept here so future work doesn't need to re-parse the
> `.docx` again. **Do not treat this as ground truth about the system** — cross-check
> everything against [`fyp_system_overview.md`](./fyp_system_overview.md), which
> reflects the actual current codebase. Where the two disagree, the codebase wins and
> this document needs editing.

## 1. Title (verbatim)

**"A Predictive Modelling–Based Automatic Valuation Model (AVM) for Residential Properties in Malaysia"**
By Voon Kai Wen, TP077157, APU3F2511CS(DA). Supervisor: Ts. Nicholas Teh Sek Kit; 2nd Marker: Ms. Mary Ting. 2026.

> **Compliance flag (not yet acted on):** the New IR Structure Guidelines explicitly
> say the title should NOT be built around the product/system/model name (their bad
> example is literally "A Car Park Management System" vs. the required action-verb
> phrasing "An AI Enabled System to Reduce..."). The current title is shaped exactly
> like the disallowed pattern — it names the system ("Automatic Valuation Model
> (AVM)") rather than describing an investigation/action. The guidelines also say
> titles should be locked at IR stage and not changed in the actual FYP. This is a
> judgment call for the student/supervisor, not something to silently fix — flagging
> it here so it surfaces during documentation work rather than at grading.

## 2. Abstract (verbatim)

> The Malaysian residential property market suffers from a persistent triple
> information deficit: the absence of automated property valuation tools, the lack of
> an integrated housing market risk monitoring system, and the omission of sentiment
> intelligence from existing analysis frameworks. These gaps create systemic
> information asymmetry among buyers, sellers, lenders, and policymakers, undermining
> housing affordability and financial stability — outcomes central to United Nations
> Sustainable Development Goal 11 (SDG 11): Sustainable Cities and Communities.
>
> This project develops an integrated Predictive Modelling-Based Automatic Valuation
> Model (AVM) through three analytical components. First, Random Forest and
> Multilayer Perceptron models are trained on 401,597 NAPIC residential transaction
> records (2021–2025) to generate automated property price estimates. Second, Google
> Trends search volume data for property-related keywords is aggregated to construct
> a composite Malaysian Housing Sentiment Index. Third, six macroeconomic and market
> indicators — including impaired property loans, transaction volume, household debt,
> housing overhang, planned supply, and the sentiment index — are synthesised into a
> composite directional risk factor reflecting the current Malaysian housing cycle
> phase. The CRISP-DM methodology governs all analytical phases, and outputs are
> delivered through an interactive React-based web dashboard for non-technical users.
>
> The system targets R² ≥ 0.80 for price prediction and ≥ 75% risk classification
> accuracy, advancing SDG 11 Target 11.1 through democratised property market
> intelligence.

**Keywords**: Automatic Valuation Model, Machine Learning, Google Trends, Housing Sentiment Index, Housing Cycle Risk, Random Forest, Multilayer Perceptron, Malaysian Property Market, CRISP-DM.

SDG banner: "SDG Goal 11: Make cities and human settlements inclusive, safe, resilient and sustainable."

## 3. Chapter 1 — Introduction

**1.1 Introduction**: Frames Malaysia's property information asymmetry problem (citing Akerlof 1970, Stiglitz 2002). NAPIC records >300,000 residential transactions/year, >RM100bn value. No public AVM exists for Malaysia. Three-dimensional information gap: (1) no automated valuation, (2) no housing-cycle risk monitoring, (3) no sentiment intelligence. "Three-step integrated system": Step 1 = ML price-range model (2021–2025 panel data); Step 2 = Google Trends–based composite Malaysian Housing Sentiment Index; Step 3 = synthesis of housing-cycle indicators (impaired loans, transaction volume, household debt-to-GDP, overhang, planned supply, **plus the Step 2 sentiment index**) into a directional risk factor. SDG 11 / Target 11.1 alignment; cites KL house price-to-income ratio ~5.3x (2022) vs. international threshold 3.0x.

**1.2 Problem Background** — three named problems:
- **Problem 1**: Absence of accessible/accurate automated valuation (BOVAEP fees RM800–RM2,500, 3–5 day turnaround; NAPIC data lag 3–6 months; cites Sa'at et al. 2021 ANN>HPM finding, Oh et al. 2024 RF R²=0.87 finding).
- **Problem 2**: Lack of composite housing market risk monitoring (HPI CAGR >8% 2009–2014 then correction from 2015; household debt-to-GDP 84.2% as of 2023; Mian et al. 2017 cross-country finding).
- **Problem 3**: Omission of sentiment intelligence — "no existing Malaysian property valuation or market monitoring system incorporates a systematic, reproducible sentiment index derived from Google Trends search volume data."

**1.3 Project Aim** (verbatim): "To develop an integrated Predictive Modelling-Based Automatic Valuation and Housing Market Risk Assessment System for Malaysian residential properties, employing machine learning models trained on panel transaction data, Google Trends Data Processing for sentiment index construction, and multi-indicator time-series analysis for housing cycle risk factor derivation, deployed through an interactive web-based dashboard to support transparent property valuation and evidence-based housing market decision-making for Malaysian households, financial institutions, and policymakers."

**1.4 Objectives** (verbatim, 4 total):
1. "To analyse and model residential property price ranges across Malaysian property types, locations, land areas, built-up sizes, and age brackets using Random Forest and Multilayer Perceptron models trained on NAPIC panel transaction data spanning 2021 to 2025, achieving a coefficient of determination (R²) of at least 0.80 and a Root Mean Square Error within 15% of the sub-group median transaction price across all property type strata."
2. "To construct a composite Malaysian Housing Sentiment Index using Google Trends search volume data for property-related query terms, and validate its predictive relevance through a statistically significant lead–lag correlation (p < 0.05) with quarterly NAPIC House Price Index movements over the available historical period."
3. "To identify the current phase of the Malaysian housing cycle and develop a composite directional risk factor that classifies prevailing market conditions as upward, neutral, or downward price pressure by synthesising six categories of time-series indicators — house price growth, residential transaction volume, household debt-to-GDP ratio, impaired property loan rate, housing overhang and planned supply, and the constructed sentiment index — achieving at least 75% classification accuracy when back-tested against historical NAPIC House Price Index turning points."
4. "To design and deploy an interactive web-based dashboard that integrates the property price range model, the Malaysian Housing Sentiment Index, and the housing cycle risk factor into a unified, accessible user interface, evaluated through user acceptance testing with a minimum of five participants drawn across the three defined target user groups, achieving a mean usability score of at least 3.5 out of 5.0."

(A table restates these as 4 "Steps" with the same content; Step 4 = system integration & deployment.)

**1.5 Scope**:
- Steps executed in Jupyter Notebooks in VS Code. States Python 3.10 here (inconsistent with 2.4.1, see §8 below).
- Step 1: NAPIC 2021–2025 panel; categorise by type/state/district/land bracket/built-up bracket/age group; RF + MLP with k-fold CV; RMSE/MAE/R².
- Step 2: Google Trends via trends.google.com, English + Bahasa Malaysia keywords, monthly→quarterly aggregation, weighted composite → Malaysian Housing Sentiment Index (MHSI), validated via lead-lag correlation vs NAPIC HPI.
- Step 3: six time-series categories (house price growth, transaction volume, household debt-to-GDP, impaired loan rate, overhang, planned supply) + Step 2 sentiment index → weighted composite directional risk factor, quarterly, classified upward/stable/downward.
- Step 4: React dashboard — price estimator, sentiment index visualization, risk factor panel; UAT with participants from 3 user groups.
- "What will NOT be done": no certified valuations/legal reports; residential-only; no mobile app; no primary data collection (surveys/interviews); no live listing integration; Malaysia-only.
- Explicitly states NLP sentiment from news articles was **not implemented** "due to their methodological complexity" — Google Trends used as the sentiment proxy instead.
- Target users: (1) individual homebuyers/sellers, (2) mortgage lenders/property finance professionals, (3) housing policy analysts/urban planners.

**1.6 Potential Benefits**: Tangible (valuation cost/time savings, faster mortgage collateral assessment, real-time risk intelligence, efficiency for agents/developers). Intangible (market transparency, SDG 11 housing governance, academic contribution, financial literacy).

**1.7 Overview of IR / 1.8 Project Plan**: standard chapter summary + Gantt chart figure, no further extractable detail.

**SDG mapping**: SDG 11 (Sustainable Cities and Communities), Target 11.1 (adequate/safe/affordable housing by 2030), invoked throughout Ch1–2. No other SDGs mentioned.

## 4. Chapter 2 — Literature Review

**2.2 Domain Research**:
- **2.2.1 Malaysian Residential Property Market** — housing overhang, NAPIC/JPPH context, ARDL cointegration (Pinjaman & Kogid 2020), household debt-income cycles (SEACEN 2018; Mian et al. 2017), demographic/urban migration drivers, FDI/investor sentiment (Cheong et al. 2018; Hassan et al. 2016).
- **2.2.2 Traditional Property Valuation Practice in Malaysia** — BOVAEP/JPPH framework; 3 valuation approaches (Sales Comparison [primary], Income, Cost); value-determining factors; workflow (site inspection → market research → adjustment → reconciliation → report, 3–7 days); limitations (subjectivity, cost/time, backward-looking, no forward signals). A comparison table sets Traditional Valuation vs. the proposed AVM across 10 dimensions, listing "Google Trends sentiment index + housing cycle risk factor" as the AVM's forward-looking-signal advantage.
- **2.2.3 Theories/Frameworks** — classical valuation theory, hedonic pricing (Rosen 1974; Aminah & Syuhaida 2012), behavioural economics/investor sentiment (Case et al. 2012; Baker & Wurgler 2007; Kwakye & Haw 2021; Tuyon et al. 2016 Markov regime-switching on Bursa Malaysia), sentiment as leading indicator (Cepni et al. 2024; Bork et al. 2020).
- **2.2.4 ML Approaches in AVMs** — Ja'afar et al. 2021 SLR; Random Forest (Rampini et al. 2021; Oh et al. 2024 RF-beats-MLP on KL data); ANN/MLP (Sa'at et al. 2021; Mohd et al. 2019; Xu & Zhang 2021). States: **"Random Forest is selected as the primary modelling algorithm... MLP is implemented as a secondary model... A baseline Multiple Linear Regression (MLR) model is also included."** A model-selection table evaluates MLR/RF/MLP/Gradient Boosting (XGBoost) and explicitly says **Gradient Boosting "was considered but not selected"** due to insufficient Malaysian validation evidence.
- **2.2.5 Constructing a Housing Sentiment Index Using Google Trends** — full subsection (see Google Trends record, §7 below).
- **2.2.6 Google Trends as a Real-Time Valuation Signal** — full subsection (see §7 below).
- **2.2.7 Housing Cycle Analysis, Risk Indicators, Price Pressure Detection** — housing cycle theory (Case et al. 2012; ESRB 2019 multi-indicator framework); 6 indicator categories (House Price Growth, Transaction Volume, Household Debt-to-GDP, Impaired Property Loans, Overhang & Planned Supply, **Sentiment Index from Google Trends**); composite risk-factor construction (PCA/factor models, IMF 2018/SEACEN 2018; EWS literature, Bork et al. 2020 probit, Cepni et al. 2024 quantile "growth-at-risk"); risk factor framed as a scored upward/stable/downward classifier, conceptually drawing on Tuyon et al. (2016) regime-switching.

**2.3 Similar Systems and Works** (6 reviewed, each with strengths/weaknesses/SDG 11 alignment):
1. Sa'at, Maimun & Idris (2021) — ANN vs HPM, Planning Malaysia.
2. Oh, Hang & Wang (2024) — RF vs MLP, Kuala Lumpur data, ITM Conferences.
3. Plakandaras et al. (2015) — ML vs econometrics, US house price index.
4. Yusupova, Pavlidis & Pavlidis (2019) — Adaptive Dynamic Model Averaging.
5. Sumantyo et al. (2025) — Google Trends + LTV ratios for Malaysian housing loan demand.
6. Bork, Møller & Pedersen (2020) & Cepni et al. (2024) — EWS/growth-at-risk frameworks.

Conclusion identifies 4 gaps: (1) no system integrates structural + macro + Google-Trends sentiment + risk factor together; (2) none has an accessible non-technical UI; (3) most are static/non-retraining; (4) none positions itself as a low-cost complement to formal Malaysian appraisal.

> **Internal document inconsistencies found** (independent of the Google Trends
> question — worth cleaning up regardless): the summary table's "Yusupova et al." row
> describes lexicon-based NLP methodology that contradicts the ADMA econometric
> description given in-text for the same paper (looks like a copy-paste error from a
> different row template); the table also labels the year "(2021)" vs. "(2019)" used
> in-text.

**2.4 Technical Research**:
- **2.4.1 Software**: Python selected over R/Java/JavaScript. States **"Python 3.13.9"** here (vs. "Python 3.10" in §1.5 — internally inconsistent, verify actual version).
- **2.4.2 IDE**: VS Code + Jupyter Notebook.
- **2.4.3 OS**: Windows 11.

**2.5 Summary**: recaps domain research → similar systems → technical research.

## 5. Chapter 3 — Methodology

**3.2 Methodology**: CRISP-DM (6 phases) selected over KDD/SEMMA/TDSP/OSEMN via a comparison table (each eliminated for a specific reason — no deployment phase, SAS-centric, MS-ecosystem bias, no business-understanding phase, respectively).

**3.2.3 CRISP-DM phases applied** (mapped across the 3 project "Steps"):
- *Business Understanding*, Step 2: "Established the use of Google Trends search data as a housing market sentiment indicator to capture buyer interest and demand signals."
- *Data Understanding*, Step 1: Main Floor Area r≈0.40 as strongest predictor found in EDA. Step 2: "Performed Google Trends keyword searches (e.g., 'beli rumah', 'subsale', 'new launch property Malaysia')..." (these 3 example keywords do **not** match the 5 keywords actually listed under Dataset 4 — another drafting inconsistency). Step 3: impaired loan ratio found bimodal/non-stationary.
- *Data Preparation*, Step 1: missing-value handling, price bins (≤300K/300–500K/500K–1M/>1M) for **RF classification**. Step 2: 6-indicator time-series consolidation. Step 3: impaired-ratio construction (3.09 multiplier, see Dataset 3 below).
- *Modelling*, Step 1: **"train MLR (baseline), Random Forest Classifier (price-band classification), and an ANN"** — note this frames RF as a *classifier* on price *bands*, not a regressor on continuous price, and does not mention XGBoost anywhere. Step 2: normalise/smooth/aggregate Google Trends into MHSI, lag-align with quarterly MHPI. Step 3: **Markov Regime-Switching model on MHPI → binary regime indicator → Logistic Regression** with macro indicators; cointegration tests (Engle-Granger/Johansen) → possible Error Correction Model (ECM). **No Hodrick-Prescott filter is mentioned anywhere in this document.**
- *Evaluation*: Step 1 RMSE/MAE/R² + residual diagnostics; Step 2 same-quarter + t+1/t+2 leading correlation vs MHPI; Step 3 regime-switching classification accuracy + ECM fit.
- *Deployment*: React dashboard — price estimator + Housing Market Risk Indicator (regime classification, risk factors, sentiment trends).

**3.3 Data Collection** — four dataset groups:
1. **NAPIC Open Sales Transaction Data** — `Open_Transaction_Data.xlsx`, 401,597 rows × 11 cols, 2021–2025, Peninsular Malaysia. Fields: Property Type, District, Mukim, Scheme Name/Area, Road Name, Month/Year of Transaction, Tenure, Land/Parcel Area (sqm), Main Floor Area (sqm), Unit Level, Transaction Price (RM).
2. **CEIC Malaysia Residential Property Macroeconomic Indicators** — 7 CEIC series (residential purchase loans, no. of residential sales, nominal RPI YoY, unsold [total/completed/under-construction], planned supply), Q2 2000–Jan 2026, mostly quarterly (1 monthly).
3. **BNM Banking System Impaired Loans Statistics** — 3 tables (1.21a 1988–2009 all-purpose aggregate discontinued; 1.22a Dec2008–Aug2021 purpose-level discontinued; 1.22 Jul2021–Oct2025 active with price-band breakdown), combined via overlap-verified appending + a derived **3.09 multiplier** (from a 2009 overlap ratio) to back-extend to 1998, resampled monthly→quarterly → `Quarterly_Impaired_Prop_Loan_Ratio_(98-25).xlsx`, 112 quarterly obs, Q1 1998–Q4 2025.
4. **Google Trends — Malaysia Residential Property Search Keywords** — `time_series_MY_keywords.csv`, 5 keywords (English: "Property for sale", "Terrace house", "House for sale"; Malay: "beli rumah", "Rumah untuk dijual"), Jan 2004–Feb 2026 (266 monthly rows), analytical window restricted to Jan 2010+ (194 rows), 0–100 relative score scale.

**3.4 Pre-processing & Data Understanding** — per dataset:
- **Open Transaction Data**: 401,597×11→14 cols post-processing; missing Main Floor Area 25.9%, Unit Level 60.8% (structural); median price RM370,000, mean ~RM546,000, range RM5,000–RM38,000,000; 127 districts, Johor Bahru most active (45,021 txns); Freehold 66.2%/Leasehold 33.8%; correlations Main Floor Area r≈0.40, Land Area r≈0.28; **initial OLS R²=0.757**, after outlier removal (4,263 records, Z>±3) **R²=0.807** with HAC/Newey-West SEs; Durbin-Watson=0.854 (positive autocorrelation); Breusch-Pagan LM=19,423.41 (heteroskedastic).
- **Time Series Dataset**: RP_Prop_Sales (Q1 2002–Q3 2025), House Price Index (Q1 1989–Q3 2025), Unsold (2002–2025, rose 52,000→112,000+ units), Planned Supply (Q2 2000–Q3 2025, peaked >620,000 units 2013–2015). Total Unsold vs Completed Unsold r>0.90; vs Planned Supply r>0.70; vs Real Price YoY negative.
- **Quarterly Impaired Property Loan Ratio**: 112 obs, mean 3.49%, median 2.41%, bimodal (peaks ~1.0–1.5% post-2010, ~5.0–7.0% pre-2010); non-normal (all 3 tests reject, p<0.05); strong negative trend correlation with time (r≈−0.88 to −0.90); era means: Asian Crisis '98-'99 ~6.73%, Post-Crisis/GFC '00-'09 ~3.77%, Recovery '10-'19 ~1.43%, COVID/Recent '20-'25 ~1.18% (all-time low ~0.975% Q4 2020).
- **Google Trends Dataset**: pre-2010 unreliable (20–67% zero rates) → window restricted to post-2010 (194 obs, 0% zeros). "House for sale" = dominant keyword (mean 58.2, ~48% of composite); "beli rumah" essentially uncorrelated with the others (r≈0, "stationary and trendless"). 4 of 5 keywords show strong structural decline (r < −0.87) attributed to migration to dedicated portals (PropertyGuru/iProperty/Mudah.my), not falling demand — composite fell from peak 191 (Aug 2013) to ~77 (2024), a 53% decline. **Suitability Assessment concludes "Conditionally suitable"** — recommends restricting to post-2010, detrending via YoY % change (to remove platform-migration bias), using "House for sale" as the primary signal rather than the composite, and running lag analysis (t+1 to t+3) before use as a predictor.

**3.5 Summary**: recaps all 4 datasets; cross-cutting findings (log transform needed for price; bimodal/non-normal impaired ratio needs regime-aware modelling; event-driven outliers need careful treatment, not removal).

## 6. Chapter 4 — Conclusion

**4.1**: claims full research/data-collection/understanding foundation established for Sem 1; reiterates the 3 literature gaps and successful acquisition of all 4 datasets; reiterates Google Trends "conditional suitability" + the YoY-detrend/"House for sale"-as-primary-signal recommendation.

**4.2** (SDG 11 sufficiency): cites "Zamri et al. (2024)", "Li et al. (2025)", "Najib et al. (2025)" — **none of these three appear anywhere else in the document or in the References list** (likely leftover/unreconciled citations from an earlier draft).

**4.3 Gaps for Semester 2** (5 total):
1. **Absence of NLP for sentiment analysis** — explicitly frames Google Trends as the *current* proxy and NLP (BERT/RoBERTa → mBERT/XLM-RoBERTa for Bahasa Malaysia) on news sources (EdgeProp, iProperty, The Edge Markets) as *future* work. This is the clearest single statement that Google Trends was the actual (only) sentiment mechanism implemented in Part 1.
2. Sub-market disaggregation — risk factor is national-level only; proposes state-level indices.
3. COVID-19 anomaly handling — proposes crisis dummies/rolling-window CV/data augmentation.
4. Model explainability — proposes SHAP for RF/MLP (motivated by BNM collateral-valuation transparency needs).
5. UAT instrument design — not yet designed.

## 7. Every Google Trends mention (for precise removal/rewrite later)

Google Trends is **not peripheral** — it's woven through: the Abstract; all of Chapter 1 (Intro, Problem 3, Aim, Objective 2, part of Objective 3, Scope, Benefits); three full Literature Review subsections (2.2.5, 2.2.6, 2.3.5) plus references inside 2.2.7 and 2.5; the entire CRISP-DM "Step 2" row in every phase of Table 8; one of Chapter 3's four primary datasets (Dataset 4, its own data-understanding subsection with a "Suitability Assessment"); and Chapter 4's achievements (§4.1), SDG sufficiency argument (§4.2, via Sumantyo et al.), and Gap 1 (§4.3).

Specific phrasings worth knowing when rewriting:
- Example keywords cited in different places **don't agree with each other**: Dataset 4's official keyword table lists 5 keywords ("Property for sale", "Terrace house", "House for sale", "beli rumah", "Rumah untuk dijual"), but the CRISP-DM narrative sections instead give illustrative examples like "subsale", "new launch property Malaysia", "apartment KL", "housing loan Malaysia", "pinjaman perumahan" — none of which are actual dataset columns. This is an internal inconsistency in the source document, independent of whether Google Trends stays or goes.
- The Data Understanding write-up (§3.4.2.4) mentions the **Pytrends library** as the (aspirational) collection method, and floats "Future extensions... may employ the Pytrends API to automate and expand the retrieval of search trend data" — i.e., Part 1 treats Google Trends as a live, extensible data source, not a one-off historical CSV.
- Objective 3 bakes "the constructed sentiment index" in as the 6th of "six categories" feeding the housing-cycle risk factor.

**Bottom line**: removing/updating Google Trends touches nearly every chapter, not a single isolated section. See `fyp_system_overview.md` §6 for what the *current* codebase actually does instead (spoiler: Google Trends was explored in its own notebook but never wired into any served model — the HCR logistic regression uses 6 different, non-sentiment macro predictors).

## 8. Items flagged for verification against the current codebase

(Resolved answers are in `fyp_system_overview.md` — this is just the raw list of things that looked internally inconsistent or unconfirmed while reading the docx.)

- Model roles: doc says RF (primary) + MLP (secondary) + MLR (baseline); XGBoost "considered but not selected." Reconcile against actual production models.
- Python version stated as both "3.10" (§1.5) and "3.13.9" (§2.4.1).
- R²/accuracy targets (≥0.80 valuation R², ≥75% risk classification accuracy) and reported feasibility numbers (OLS R²=0.757→0.807) — verify against actual trained-model metrics.
- Dataset size "401,597 NAPIC records" repeated as an exact figure — verify against `transactions.parquet` row count.
- HCR architecture: doc specifies Markov Regime-Switching + Logistic Regression + possible ECM, no HP filter at all — reconcile against actual implementation (HP filter *is* used in the actual system per project memory — this document doesn't mention it).
- Six risk-factor categories include the Google Trends sentiment index as the 6th — verify what actually replaces it, if anything.
- Impaired loan ratio construction (3.09 multiplier, BNM table numbers 1.21a/1.22a/1.22) — verify against actual data pipeline.
- Price bins (≤RM300K/300–500K/500K–1M/>1M) for an RF *classifier* — verify whether this classification framing exists anywhere currently, or whether it's pure regression now.
- Broken citations "Zamri et al. (2024)", "Li et al. (2025)", "Najib et al. (2025)" — not found elsewhere in the document; likely need removing or replacing with real sources.

## 9. Appendices status

TOC lists Appendix A (PPF), B (Ethics Forms Fast Track), C (Log Sheets, 3 meetings), D (Turnitin Similarity Report), F (GitHub Repository link — note the lettering skips "E"). These exist only as captions referencing embedded scanned/image forms — no further extractable text. Appendix F contains one live URL: `https://github.com/Sandaris/A-Predictive-Modelling-Based-Automatic-Valuation-Model--AVM--for-Residential-Properties-in-Malaysia`.
