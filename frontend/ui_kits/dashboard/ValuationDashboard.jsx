/* eslint-disable no-undef */
/* ValuationDashboard.jsx — the Valuation tab's result panel.
   Shown inside the map's bottom sheet once the user has chosen a Scheme/Area.
   Estimates the property's market value (switchable between three real,
   API-served models — Random Forest, XGBoost, FT-Transformer) and surfaces the
   essential market data for the chosen region, mirroring the real NAPIC
   Open Transaction schema: average price by property type, median price,
   price per m² (built-up), median built-up / land area (sq.m), tenure mix,
   and the price + volume trend across 2021–2026. All figures derive from the
   same calibrated transaction layer the map uses, so the dashboard always
   agrees with the underlying records. */
const { useState, useMemo, useEffect, useRef } = React;

const STRATA_TYPES = new Set(['Condominium/Apartment', 'Flat', 'Low-Cost Flat', 'Town House']);
const VAL_AVG_GUARD_MIN_TXNS = 3;
const VAL_AVG_GUARD_MAX_DELTA = 0.50;

/* ---- stats helpers ---------------------------------------------------- */
const valMean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const valMedian = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const rmCompact = (n) => {
  if (!n) return '—';
  if (n >= 1e6) return 'RM ' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return 'RM ' + Math.round(n / 1e3) + 'k';
  return formatRM(n);
};
const SHORT_TYPE = {
  '1 - 1 1/2 Storey Terraced': '1–1½ Terraced', '2 - 2 1/2 Storey Terraced': '2–2½ Terraced',
  'Condominium/Apartment': 'Condo / Apt', '1 - 1 1/2 Storey Semi-Detached': '1–1½ Semi-D',
  'Low-Cost House': 'Low-Cost House', 'Detached': 'Detached',
  '2 - 2 1/2 Storey Semi-Detached': '2–2½ Semi-D', 'Flat': 'Flat',
  'Low-Cost Flat': 'Low-Cost Flat', 'Cluster House': 'Cluster House', 'Town House': 'Town House',
};
const shortType = (t) => SHORT_TYPE[t] || t;
const buildAvgGuard = (point, rows, selectedType) => {
  if (!point) return { blocked: false, avg: null, n: 0, delta: 0, scope: 'none' };
  const valid = (rows || []).filter((r) => Number(r.Price) > 0);
  const exact = selectedType ? valid.filter((r) => (r['Property Type'] || '') === selectedType) : [];
  const use = exact.length >= VAL_AVG_GUARD_MIN_TXNS ? exact : valid;
  const prices = use.map((r) => Number(r.Price));
  if (prices.length < VAL_AVG_GUARD_MIN_TXNS) {
    return { blocked: true, avg: null, n: prices.length, delta: 0, scope: exact.length ? 'type' : 'similar' };
  }
  const avg = valMean(prices);
  const delta = avg ? Math.abs(point - avg) / avg : 0;
  return {
    blocked: avg > 0 && delta > VAL_AVG_GUARD_MAX_DELTA,
    avg,
    n: prices.length,
    delta,
    scope: use === exact ? 'type' : 'similar',
  };
};

/* Recent real transactions (NAPIC Open Transaction Data) scoped to the
   selection — rendered as a scrollable table, one row per record. */
const VAL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtTxnMonth = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  return (VAL_MONTHS[+s.slice(5, 7) - 1] || '') + ' ' + s.slice(0, 4);
};
const RecentTh = ({ children, right }) => (
  <th style={{
    position: 'sticky', top: 0, zIndex: 1, background: C.raised,
    textAlign: right ? 'right' : 'left', padding: '8px 10px',
    fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '.07em', color: C.earth,
    whiteSpace: 'nowrap', borderBottom: `1.5px solid ${C.border}`,
  }}>{children}</th>
);
const recentCell = {
  padding: '7px 10px', fontFamily: "'DM Sans',sans-serif", fontSize: 11.5,
  color: C.mid, borderBottom: `1px solid ${C.border}80`, verticalAlign: 'top',
};
const recentNum = { ...recentCell, textAlign: 'right', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono',monospace" };
const RecentTxnRow = ({ r, i }) => {
  const price = Number(r.Price || 0);
  const built = r.Area == null ? null : Number(r.Area);
  const land = r.Land == null ? null : Number(r.Land);
  const size = built || land;
  const place = r['Road Name'] || r['Scheme Name/Area'] || r.Mukim || '—';
  return (
    <tr style={{ background: i % 2 ? C.cream + '40' : 'transparent' }}>
      <td style={{ ...recentCell, whiteSpace: 'nowrap' }}>{fmtTxnMonth(r['Transaction Date'])}</td>
      <td style={{ ...recentCell, color: C.deep, fontWeight: 500 }}>{shortType(r['Property Type'] || '—')}</td>
      <td style={recentCell}>{place}</td>
      <td style={recentNum}>{size ? Math.round(size).toLocaleString('en-MY') : '—'}</td>
      <td style={{ ...recentNum, color: C.deep, fontWeight: 600 }}>{rmCompact(price)}</td>
    </tr>
  );
};

/* ECharts line chart of the yearly average price — the price-growth trajectory
   across the years, in the life-expectancy example's style: a smooth animated
   draw, an end label with the latest price, and focus-on-hover. Green when the
   latest year sits above the first (prices grew), red when below. Keeps the
   YoY % pill labels + year labels, and adds a per-year hover (avg price, volume,
   YoY %). Sits to the right of the year bar chart in the trend card. */
const YearLineChart = ({ rows }) => {
  const elRef = React.useRef(null);
  const chartRef = React.useRef(null);
  React.useEffect(() => {
    if (!window.echarts || !elRef.current) return undefined;
    const chart = window.echarts.init(elRef.current, null, { renderer: 'canvas' });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(elRef.current);
    const raf = requestAnimationFrame(() => chart.resize());
    const t = setTimeout(() => chart.resize(), 300);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); ro.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);
  React.useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !window.echarts) return;
    if (!rows || rows.length === 0) { chart.clear(); return; }
    const n = rows.length;
    const up = rows[n - 1].avg >= rows[0].avg;
    const color = up ? C.up : C.down;
    const grad = new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: up ? 'rgba(45,122,79,0.22)' : 'rgba(166,50,40,0.22)' },
      { offset: 1, color: up ? 'rgba(45,122,79,0)' : 'rgba(166,50,40,0)' },
    ]);
    const data = rows.map((r, i) => ({
      value: Math.round(r.avg), year: r.y, n: r.n,
      pct: i ? ((r.avg - rows[i - 1].avg) / (rows[i - 1].avg || 1)) * 100 : null,
    }));
    // colour each YoY % pill by its own direction (green up / red down), like the
    // old chart; the first year has no prior year, so it shows no pill.
    data.forEach((d, i) => {
      if (i === 0) { d.label = { show: false }; return; }
      const c = d.pct >= 0 ? C.up : C.down;
      d.label = { color: c, borderColor: c };
    });
    chart.setOption({
      animationDuration: 2000, animationEasing: 'cubicOut',
      backgroundColor: 'transparent',
      grid: { left: 6, right: 58, top: 30, bottom: 6, containLabel: true },
      tooltip: {
        trigger: 'axis', backgroundColor: C.deep, borderColor: C.deep, padding: [8, 10],
        textStyle: { color: C.cream, fontFamily: "'DM Sans',sans-serif", fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: C.earth, width: 1, type: [3, 4] } },
        formatter: (ps) => {
          const d = ps[0].data; const p = d.pct;
          return `<div style="font-family:'JetBrains Mono',monospace;font-size:12px">${d.year}</div>` +
            `<div style="margin-top:3px">Avg price: <b>${rmCompact(d.value)}</b></div>` +
            `<div>${d.n} transaction${d.n === 1 ? '' : 's'}</div>` +
            (p != null ? `<div style="margin-top:3px;color:${p >= 0 ? '#9ED9B0' : '#E6A6A0'}">YoY ${p >= 0 ? '+' : ''}${p.toFixed(1)}%</div>` : '');
        },
      },
      xAxis: {
        type: 'category', data: rows.map(r => r.y), boundaryGap: false,
        axisLine: { lineStyle: { color: C.border } }, axisTick: { show: false },
        axisLabel: { color: C.mid, fontFamily: "'DM Sans',sans-serif", fontSize: 11 },
      },
      yAxis: { type: 'value', scale: true, show: false },
      series: [{
        type: 'line', name: 'Average price', smooth: true, data,
        showSymbol: true, symbol: 'circle', symbolSize: 7,
        lineStyle: { color, width: 2.4 },
        itemStyle: { color: C.raised, borderColor: color, borderWidth: 2 },
        areaStyle: { color: grad },
        emphasis: { focus: 'series' },
        // YoY % change pills at each point (the old segment labels, preserved)
        label: {
          show: true, position: 'top', distance: 7,
          formatter: (p) => (p.data.pct != null ? (p.data.pct >= 0 ? '+' : '') + p.data.pct.toFixed(1) + '%' : ''),
          color, fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, fontWeight: 700,
          backgroundColor: C.raised, borderColor: color, borderWidth: 1, borderRadius: 8, padding: [2, 5],
        },
        // latest average price labelled at the line end (life-expectancy style)
        endLabel: {
          show: true, distance: 6,
          formatter: (p) => rmCompact(p.data.value),
          color, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700,
        },
        labelLayout: { moveOverlap: 'shiftY' },
      }],
    }, true);
  }, [rows]);
  return <div ref={elRef} style={{ width: '100%', height: 196 }}/>;
};

/* ---- region aggregation (area-level sample) --------------------------- */
function valComputeRegion(sel) {
  const { state, district, mukim, area, propertyType } = sel || {};
  let rows = [];
  try { rows = getTransactionsForScope({ state, district, mukim, area }) || []; } catch (e) {}
  if (rows.length < 6) { try { rows = rows.concat(getTransactions({ state, district, mukim, area, road: '' }) || []); } catch (e) {} }

  const typeRows = propertyType ? rows.filter(r => r.type === propertyType) : [];
  const valuationRows = typeRows.length ? typeRows : rows;

  const median = valMedian(valuationRows.map(r => r.price));
  const ppsmArr = valuationRows.map(r => r.ppsm).filter(Boolean);
  const ppsm = ppsmArr.length ? Math.round(valMedian(ppsmArr)) : null;
  const floorArr = valuationRows.map(r => r.built).filter(Boolean);
  const medFloor = floorArr.length ? Math.round(valMedian(floorArr)) : null;
  const landArr = valuationRows.map(r => r.land).filter(Boolean);
  const medLand = landArr.length ? Math.round(valMedian(landArr)) : null;
  const fhPct = Math.round(100 * valuationRows.filter(r => r.tenure === 'Freehold').length / (valuationRows.length || 1));

  const map = {};
  rows.forEach(r => { (map[r.type] = map[r.type] || []).push(r); });
  const byType = Object.entries(map)
    .map(([type, arr]) => ({ type, avg: valMean(arr.map(r => r.price)), n: arr.length }))
    .sort((a, b) => b.avg - a.avg);
  const dominant = byType.reduce((a, b) => (a && a.n >= b.n ? a : b), null);

  const byYear = {};
  rows.forEach(r => { (byYear[r.year] = byYear[r.year] || []).push(r.price); });
  const yearAvg = Object.keys(byYear).map(Number).sort()
    .map(y => ({ y, avg: valMean(byYear[y]), n: byYear[y].length }));
  let trendTotal = null;
  if (yearAvg.length >= 2) {
    const f = yearAvg[0], l = yearAvg[yearAvg.length - 1];
    trendTotal = (l.avg / f.avg - 1) * 100;
  }
  return {
    rows,
    valuationRows,
    count: valuationRows.length || rows.length,
    median,
    ppsm,
    medFloor,
    medLand,
    fhPct,
    byType,
    dominant,
    selectedType: propertyType || (dominant && dominant.type),
    yearAvg,
    trendTotal,
    baseVal: median || 400000,
  };
}

/* The three valuation models served by the backend (/valuation/predict?model=).
   `key` is the API selector; order here = left-to-right button order. All three
   are real, trained models — no illustrative placeholders. */
const MODEL_DEFS = [
  { key: 'rf', label: 'Random Forest', short: 'Forest',
    note: 'Tuned ensemble of decision trees — robust to outliers and non-linear price drivers.' },
  { key: 'xgboost', label: 'XGBoost', short: 'XGBoost',
    note: 'Gradient-boosted trees with conformal prediction bands — the primary AVM model.' },
  { key: 'ft', label: 'FT-Transformer', short: 'FT-Tx',
    note: 'Feature-Tokenizer + Transformer — a tabular deep-learning model that turns every feature into a token and attends across them.' },
];

/* ---- small presentational bits --------------------------------------- */
const StatTile = ({ label, value, sub, accent }) => (
  <div style={{
    background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4,
  }}>
    <Eyebrow style={{ fontSize: 10 }}>{label}</Eyebrow>
    <Mono size={17} color={accent || C.deep}>{value}</Mono>
    {sub && <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.mid }}>{sub}</span>}
  </div>
);

const ValuationDashboard = ({ sel, loading, fullpage, onExportRoi }) => {
  const [modelIdx, setModelIdx] = useState(1); // XGBoost default (primary model)
  const [apiResults, setApiResults] = useState({}); // { rf, xgboost, ft } live predictions
  const [apiSig, setApiSig] = useState(null);
  const [apiError, setApiError]   = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [recentTxns, setRecentTxns] = useState(null);   // real Open Transaction Data rows
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentScope, setRecentScope] = useState('exact'); // 'exact' | 'family' | 'area'
  const [recentTotal, setRecentTotal] = useState(0);   // total matched (may exceed the 1000 shown)
  const [byTypeReal, setByTypeReal] = useState(null); // real avg price per property type
  const [yearReal, setYearReal] = useState(null);     // real yearly avg price for the selected type
  const [priceReal, setPriceReal] = useState(null);   // real server-side price stats (median, count) for the scope
  const data = useMemo(() => valComputeRegion(sel),
    [sel.state, sel.district, sel.mukim, sel.area, sel.propertyType]);

  /* Real region stats from the NAPIC rows in the "Recent transactions" table
     (not the synthetic map layer): median plot/built-up size (used to size the
     model), median RM/m² (built-up), and freehold share. Prefer rows of the
     selected property type; if the recent list fell back to a wider family/area
     scope, use whatever it has. Fields are null when the API gave nothing — the
     callers then fall back to the calibrated layer's medians. */
  const realSizes = useMemo(() => {
    const rows = recentTxns || [];
    const exact = sel.propertyType
      ? rows.filter((r) => (r['Property Type'] || '') === sel.propertyType)
      : [];
    const use = exact.length ? exact : rows;
    const medOf = (xs) => {
      const s = xs.filter((v) => v != null && Number(v) > 0).map(Number).sort((a, b) => a - b);
      if (!s.length) return null;
      const k = Math.floor(s.length / 2);
      return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
    };
    const med = (key) => medOf(use.map((r) => r[key]));
    const ppsm = medOf(use.map((r) => (Number(r.Area) > 0 ? Number(r.Price) / Number(r.Area) : null)));
    const fhPct = use.length
      ? Math.round((100 * use.filter((r) => r.Tenure === 'Freehold').length) / use.length)
      : null;
    return {
      n: use.length,
      land: med('Land'),
      area: med('Area'),
      ppsm: ppsm != null ? Math.round(ppsm) : null,
      fhPct,
    };
  }, [recentTxns, sel.propertyType]);

  /* Latest actual transactions for the chosen area, straight from the cleaned
     NAPIC Open Transaction Data (/data/query => transactions.parquet), newest
     first. Property type leads the priority:
       1) sales of the exact selected type in the area;
       2) else the most similar type - same landed / non-landed family;
       3) else whatever transacted in the area.
     Road is NOT used to scope this list: names in the source are inconsistently
     abbreviated (LRG / JLN / JALAN / LORONG ...), which would wrongly empty it. */
  useEffect(() => {
    if (!sel.district) { setRecentTxns(null); setRecentScope('exact'); return; }
    let cancelled = false;
    setRecentLoading(true);
    setRecentTxns(null);
    setRecentTotal(0);
    setRecentScope('exact');
    const area = {
      district: sel.district, mukim: sel.mukim, scheme: sel.area,
      sort_by: 'Transaction Date', order: 'desc',
    };
    const sameFamily = (t) => STRATA_TYPES.has(t) === STRATA_TYPES.has(sel.propertyType);
    const done = (rows, scope, total) => {
      if (cancelled) return;
      setRecentTxns(rows); setRecentScope(scope); setRecentTotal(total || 0); setRecentLoading(false);
    };

    // 1) exact selected type — ALL matching records in the area (backend caps 1000).
    const exactReq = sel.propertyType
      ? window.API.dataQuery({ ...area, property_type: sel.propertyType, limit: 1000 })
      : Promise.resolve({ rows: [] });

    exactReq
      .then((d) => {
        if (cancelled) return;
        if (sel.propertyType && d.rows && d.rows.length) { done(d.rows, 'exact', d.total_matched); return; }
        // 2/3) widen to the whole area, then prefer the same landed/non-landed family.
        window.API.dataQuery({ ...area, limit: 1000 })
          .then((all) => {
            if (cancelled) return;
            const rows = all.rows || [];
            if (!rows.length) { done([], 'exact', 0); return; }
            const fam = sel.propertyType ? rows.filter((r) => sameFamily(r['Property Type'])) : [];
            if (fam.length) done(fam, 'family', fam.length);
            else done(rows, 'area', all.total_matched);
          })
          .catch(() => done([], 'exact', 0));
      })
      .catch(() => done([], 'exact', 0));
    return () => { cancelled = true; };
  }, [sel.district, sel.mukim, sel.area, sel.propertyType]);

  /* Real average price per property type for the area, computed server-side over
     every matching record (not the paginated page). `limit: 1` keeps the payload
     tiny — we only want stats.by_type. Not filtered by type: the card shows all
     types side by side. Falls back to the calibrated layer if the API is offline. */
  useEffect(() => {
    if (!sel.district) { setByTypeReal(null); return; }
    let cancelled = false;
    window.API.dataQuery({
      district: sel.district, mukim: sel.mukim, scheme: sel.area, limit: 1,
    })
      .then((d) => { if (!cancelled) setByTypeReal((d.stats && d.stats.by_type) || []); })
      .catch(() => { if (!cancelled) setByTypeReal(null); });
    return () => { cancelled = true; };
  }, [sel.district, sel.mukim, sel.area]);

  /* Real yearly average price + price stats for the SELECTED property type in the
     area (server-side over ALL matching rows, not just the page). If that type has
     no sales here, fall back to the area's all-type stats so nothing goes blank.
     The single response feeds both the yearly trend chart (stats.yearly) and the
     KPI tiles / "vs median" (stats.price). Calibrated layer is the offline fallback. */
  useEffect(() => {
    if (!sel.district) { setYearReal(null); setPriceReal(null); return; }
    let cancelled = false;
    const area = { district: sel.district, mukim: sel.mukim, scheme: sel.area };
    const toYears = (yearly) => (yearly || []).map(y => ({ y: y.year, avg: y.mean, n: y.count }));
    window.API.dataQuery({ ...area, property_type: sel.propertyType, limit: 1 })
      .then((d) => {
        if (cancelled) return;
        const yearly = (d.stats && d.stats.yearly) || [];
        if (sel.propertyType && yearly.length) {
          setYearReal({ rows: toYears(yearly), scope: 'type' });
          setPriceReal((d.stats && d.stats.price) || null);
          return;
        }
        window.API.dataQuery({ ...area, limit: 1 })
          .then((a) => {
            if (cancelled) return;
            setYearReal({ rows: toYears(a.stats && a.stats.yearly), scope: 'area' });
            setPriceReal((a.stats && a.stats.price) || null);
          })
          .catch(() => { if (!cancelled) { setYearReal(null); setPriceReal(null); } });
      })
      .catch(() => { if (!cancelled) { setYearReal(null); setPriceReal(null); } });
    return () => { cancelled = true; };
  }, [sel.district, sel.mukim, sel.area, sel.propertyType]);

  /* Lazy per-model valuation. The VM only holds one (memory-heavy) model in RAM
     at a time, so the dashboard computes ONLY the selected model and fetches the
     others when the user switches tabs. Results are cached per search via a
     signature — switching back is instant, and a property/location/size change
     clears the cache and recomputes just the selected model. */
  const payloadBase = useMemo(() => {
    if (!data.selectedType || !sel.district) return null;
    const isStrata = STRATA_TYPES.has(data.selectedType);
    const modelLand = isStrata
      ? (realSizes.area || realSizes.land || data.medFloor || data.medLand || 1)
      : (realSizes.land || realSizes.area || data.medLand || data.medFloor || 1);
    const modelArea = isStrata ? null : (realSizes.area || data.medFloor || null);
    const fhShare = realSizes.fhPct != null ? realSizes.fhPct : data.fhPct;
    return {
      property_type: data.selectedType,
      district: sel.district,
      mukim: sel.mukim || sel.district,
      scheme: sel.area || sel.mukim || sel.district,
      tenure: (fhShare >= 50 ? 'Freehold' : 'Leasehold'),
      land: Math.max(1, Math.round(modelLand)),
      area: modelArea ? Math.round(modelArea) : null,
    };
  }, [sel.district, sel.mukim, sel.area, data.selectedType, data.fhPct,
      data.medLand, data.medFloor, realSizes.land, realSizes.area, realSizes.fhPct]);

  const payloadSig = useMemo(() => payloadBase ? JSON.stringify(payloadBase) : null, [payloadBase]);

  const resultsRef = useRef({});
  const sigRef = useRef(null);
  useEffect(() => { resultsRef.current = apiResults; }, [apiResults]);

  useEffect(() => {
    if (!payloadBase || !payloadSig) {
      setApiResults({});
      setApiSig(null);
      sigRef.current = null;
      setApiLoading(false);
      return;
    }
    const sigChanged = sigRef.current !== payloadSig;
    if (sigChanged) {
      sigRef.current = payloadSig;
      setApiResults({});
      setApiSig(null);
    }  // new search -> drop stale results

    const key = MODEL_DEFS[modelIdx].key;
    if (!sigChanged && apiSig === payloadSig && resultsRef.current[key]) { setApiLoading(false); return; }  // cached

    setApiLoading(true); setApiError(null);
    let cancelled = false;
    window.API.valuationPredict({ ...payloadBase, model: key })
      .then((r) => {
        if (cancelled) return;
        setApiResults((prev) => ({ ...(sigRef.current === payloadSig ? prev : {}), [key]: r }));
        setApiSig(payloadSig);
      })
      .catch((e) => { if (!cancelled) setApiError({ sig: payloadSig, message: e.message }); })
      .finally(() => { if (!cancelled) setApiLoading(false); });
    return () => { cancelled = true; };
  }, [payloadBase, payloadSig, modelIdx, apiSig]);

  /* Build the three cards from live predictions only. Missing model results
     stay non-live so the estimate panel can show loading instead of fallback
     values while the server is responding. */
  const validApiResults = apiSig === payloadSig ? apiResults : {};
  const models = useMemo(() => MODEL_DEFS.map((def) => {
    const r = validApiResults[def.key];
    if (r && r.predicted_price) {
      const pt = r.predicted_price;
      const band = Math.max(0.02, (r.price_high - r.price_low) / (2 * pt));
      return {
        ...def,
        point: pt,
        band,
        conf: r.confidence === 'high' ? 93 : r.confidence === 'medium' ? 88 : 78,
        mae: r.val_mape != null ? (r.val_mape * 100).toFixed(1) + '%' : '—',
        live: true,
        note: def.note + ' ' + (r.comparables?.length || 0) + ' NAPIC comparables anchored.',
      };
    }
    return { ...def, point: data.baseVal, band: 0.1, conf: null, mae: '—', live: false };
  }), [validApiResults, data.baseVal]);
  const m = models[modelIdx];
  const hasLiveEstimate = m.live;
  const activeApiError = apiError && apiError.sig === payloadSig ? apiError.message : null;
  const avgGuard = useMemo(() => (
    hasLiveEstimate && !recentLoading
      ? buildAvgGuard(m.point, recentTxns, sel.propertyType)
      : { blocked: false, avg: null, n: 0, delta: 0, scope: 'none' }
  ), [hasLiveEstimate, recentLoading, recentTxns, m.point, sel.propertyType]);
  const guardChecking = hasLiveEstimate && recentLoading;
  const avgGuardBlocked = hasLiveEstimate && !recentLoading && avgGuard.blocked;
  const hasDisplayableEstimate = hasLiveEstimate && !guardChecking && !avgGuardBlocked;
  const estimateLoading = (!hasLiveEstimate && !activeApiError && (loading || apiLoading || !!payloadSig)) || guardChecking;
  const estimateUnavailable = (!hasLiveEstimate && !!activeApiError) || avgGuardBlocked;
  const unavailableMessage = avgGuardBlocked
    ? (avgGuard.avg
        ? `Data is not available: model estimate differs by ${(avgGuard.delta * 100).toFixed(0)}% from the recent ${avgGuard.scope === 'type' ? shortType(sel.propertyType) : 'similar-property'} average (${rmCompact(avgGuard.avg)}, ${avgGuard.n} transactions).`
        : `Data is not available: only ${avgGuard.n} recent comparable transaction${avgGuard.n === 1 ? '' : 's'} found for this selection.`)
    : `API error: ${activeApiError}`;

  const low = m.point * (1 - m.band);
  const high = m.point * (1 + m.band);
  // Scale the comparison band over the models that have actually been computed
  // (lazy loading means non-selected models may not be fetched yet).
  const bandModels = models.filter(x => x.live || x === m);
  const dLow = Math.min(...bandModels.map(x => x.point * (1 - x.band)));
  const dHigh = Math.max(...bandModels.map(x => x.point * (1 + x.band)));
  const pct = (v) => Math.max(0, Math.min(100, ((v - dLow) / (dHigh - dLow)) * 100));

  // Region KPIs from REAL NAPIC data (server-side price stats + recent-txn
  // medians), with the calibrated layer only as an offline fallback. These
  // replace the synthetic `data.*` figures in the tiles and the "vs median".
  const regMedian = (priceReal && priceReal.median) || data.median;
  const regCount = (priceReal && priceReal.count) || realSizes.n || data.count;
  const regPpsm = realSizes.ppsm != null ? realSizes.ppsm : data.ppsm;
  const regFloor = realSizes.area != null ? Math.round(realSizes.area) : data.medFloor;
  const regLand = realSizes.land != null ? Math.round(realSizes.land) : data.medLand;
  const regFhPct = realSizes.fhPct != null ? realSizes.fhPct : data.fhPct;
  const valPerSqm = regFloor ? Math.round(m.point / regFloor) : null;

  // Average price by property type — real aggregates from the Open Transaction
  // Data (server-computed over all matching rows); calibrated layer is the
  // offline fallback. Normalised to {type, avg, n} so the card stays unchanged.
  const byType = (byTypeReal && byTypeReal.length)
    ? byTypeReal.map(t => ({ type: t.type, avg: t.mean, n: t.count }))
    : (byTypeReal ? [] : data.byType);
  const dominantType = byType.reduce((a, b) => (a && a.n >= b.n ? a : b), null);
  const maxTypeAvg = Math.max(...byType.map(t => t.avg), 1);

  // Average transacted price by year — real yearly trend for the selected type
  // in the area (calibrated layer is the offline fallback). Scope flag tells the
  // header whether it narrowed to the type or widened to the whole area.
  const yearAvg = (yearReal && yearReal.rows && yearReal.rows.length)
    ? yearReal.rows
    : (yearReal ? [] : data.yearAvg);
  const yearScope = yearReal ? yearReal.scope : null;
  const maxYear = Math.max(...yearAvg.map(y => y.avg), 1);
  const minYear = Math.min(...yearAvg.map(y => y.avg), maxYear);
  const maxVol = Math.max(...yearAvg.map(y => y.n), 1);

  // Net price growth across the visible years (first → last) — drives the line
  // chart's colour, the growth badge, and the "Trend" KPI tile.
  const yGrowth = (yearAvg.length > 1 && yearAvg[0].avg)
    ? ((yearAvg[yearAvg.length - 1].avg - yearAvg[0].avg) / yearAvg[0].avg) * 100
    : 0;
  const yUp = yGrowth >= 0;

  const recentArea = sel.area || sel.mukim || sel.district;
  const recentFamily = STRATA_TYPES.has(sel.propertyType) ? 'non-landed' : 'landed';
  const recentNote = recentScope === 'family'
    ? `No ${shortType(sel.propertyType)} sales in ${recentArea} — showing the most similar ${recentFamily} sales.`
    : recentScope === 'area'
      ? `No ${shortType(sel.propertyType)} or similar ${recentFamily} sales — showing all recent sales in ${recentArea}.`
      : null;
  const displayedPoint = Math.round(m.point / 1000) * 1000;
  const exportRoi = () => {
    if (!hasDisplayableEstimate || !onExportRoi) return;
    onExportRoi({
      propertyPrice: displayedPoint,
      locationLabel: [sel.area || sel.mukim || sel.district, sel.district, sel.state].filter(Boolean).join(', '),
      propertyType: data.selectedType || sel.propertyType || '',
      sourceModel: m.label,
      rangeLow: low,
      rangeHigh: high,
      mukim: sel.mukim || sel.district || null,
      scheme: sel.area || sel.mukim || null,
      district: sel.district || null,
      state: sel.state || null,
    });
  };

  return (
    <div style={{ height: fullpage ? 'auto' : '100%', display: 'flex', flexDirection: 'column', background: C.raised, position: 'relative' }}>
      {/* header */}
      <div style={{ padding: '15px 20px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <Eyebrow>Automated Valuation</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
          <Display size={21} weight={500}>{sel.area || sel.district}</Display>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid }}>
            {[sel.district, sel.state].filter(Boolean).join(', ')} · {regCount.toLocaleString('en-MY')} comparable transactions · NAPIC 2021–2026
          </span>
        </div>
      </div>

      {/* body */}
      <div className="val-grid" style={{
        flex: fullpage ? 'none' : 1, overflowY: fullpage ? 'visible' : 'auto', padding: fullpage ? 24 : 18,
        display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: 18, alignContent: 'start',
      }}>
        {/* ===== LEFT — estimate + model switcher ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Eyebrow style={{ marginBottom: 7 }}>Valuation model</Eyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
              {models.map((x, i) => {
                const on = i === modelIdx;
                return (
                  <button key={x.label} onClick={() => setModelIdx(i)} style={{
                    padding: '9px 4px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${on ? C.deep : C.border}`,
                    background: on ? C.deep : C.cream, color: on ? C.cream : C.mid,
                    fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600,
                    transition: 'all .18s',
                  }}>{x.short}</button>
                );
              })}
            </div>
          </div>

          <Card borderTop={C.earth} style={{ padding: 20 }}>
            <Eyebrow>
              Estimated Market Value · {m.label}
              {hasDisplayableEstimate && (
                <span style={{
                  marginLeft: 8, padding: '1px 7px', borderRadius: 9999,
                  background: C.up + '22', color: C.up, fontSize: 9,
                  letterSpacing: '.12em', fontWeight: 600,
                }}>LIVE</span>
              )}
              {avgGuardBlocked && (
                <span style={{
                  marginLeft: 8, padding: '1px 7px', borderRadius: 9999,
                  background: C.down + '18', color: C.down, fontSize: 9,
                  letterSpacing: '.12em', fontWeight: 600,
                }}>DATA UNAVAILABLE</span>
              )}
              {estimateLoading && (
                <span style={{ marginLeft: 8, color: C.muted, fontSize: 9, letterSpacing: '.12em' }}>
                  FETCHING…
                </span>
              )}
            </Eyebrow>
            {estimateLoading && (
              <div style={{
                minHeight: 190, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
                color: C.mid, textAlign: 'center',
              }}>
                <span className="tmap-spin" style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: `2px solid ${C.border}`, borderTopColor: C.earth, display: 'inline-block',
                }}/>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
                  {guardChecking ? 'Checking recent transaction average...' : 'Loading valuation from server...'}
                </span>
              </div>
            )}
            {estimateUnavailable && (
              <div style={{
                minHeight: 190, display: 'flex', alignItems: 'center',
                fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, lineHeight: 1.45, color: C.down,
              }}>{unavailableMessage}</div>
            )}
            <div style={{ marginTop: 8, display: hasDisplayableEstimate ? 'block' : 'none' }}>
              <Mono size={34} color={C.deep}>{formatRM(displayedPoint)}</Mono>
            </div>
            <div style={{ marginTop: 4, display: hasDisplayableEstimate ? 'flex' : 'none', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid }}>
                Likely range {rmCompact(low)} – {rmCompact(high)}
              </span>
              {valPerSqm && <Mono size={12} color={C.earth}>≈ RM {valPerSqm.toLocaleString()}/m²</Mono>}
            </div>

            {/* confidence band across all models */}
            <div style={{ position: 'relative', height: 46, marginTop: 18, display: hasDisplayableEstimate ? 'block' : 'none' }}>
              <div style={{ position: 'absolute', top: 20, left: 0, right: 0, height: 4,
                background: C.cream, borderRadius: 2, border: `1px solid ${C.border}` }}/>
              <div style={{ position: 'absolute', top: 19, height: 6, borderRadius: 3,
                left: pct(low) + '%', width: (pct(high) - pct(low)) + '%',
                background: C.earth + '55', border: `1px solid ${C.earth}`, transition: 'left .35s, width .35s' }}/>
              {models.map((x, i) => i !== modelIdx && x.live && (
                <div key={x.label} style={{ position: 'absolute', top: 16, width: 2, height: 12,
                  left: pct(x.point) + '%', background: C.muted, transform: 'translateX(-50%)' }}/>
              ))}
              <div style={{ position: 'absolute', top: 12, left: pct(m.point) + '%', transform: 'translateX(-50%)', transition: 'left .35s' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: C.earth, border: `2px solid ${C.raised}`, boxShadow: '0 2px 6px rgba(44,57,48,.3)' }}/>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted }}>{rmCompact(dLow)}</div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted }}>{rmCompact(dHigh)}</div>
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}`,
              display: hasDisplayableEstimate ? 'grid' : 'none', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Eyebrow style={{ fontSize: 9.5, whiteSpace: 'nowrap' }}>Confidence</Eyebrow>
                <Mono size={15} color={C.up}>{m.conf != null ? m.conf + '%' : '—'}</Mono>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Eyebrow style={{ fontSize: 9.5, whiteSpace: 'nowrap' }} title="Median absolute % error on the 2025 hold-out">MdAPE</Eyebrow>
                <Mono size={15}>{m.mae}</Mono>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Eyebrow style={{ fontSize: 9.5, whiteSpace: 'nowrap' }}>vs median</Eyebrow>
                <Mono size={15} color={m.point >= regMedian ? C.up : C.down}>
                  {(m.point >= regMedian ? '+' : '') + ((m.point / regMedian - 1) * 100).toFixed(1)}%
                </Mono>
              </div>
            </div>
            <div style={{ marginTop: 12, display: hasDisplayableEstimate ? 'block' : 'none', fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid, lineHeight: 1.45, fontStyle: 'italic' }}>
              {m.note}
            </div>
            {hasDisplayableEstimate && onExportRoi && (
              <Button variant="cta" onClick={exportRoi} style={{ marginTop: 14, width: '100%' }}>
                Export to ROI Calculator
              </Button>
            )}
          </Card>
        </div>

        {/* ===== RIGHT — region data ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="val-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <StatTile label="Median price" value={rmCompact(regMedian)} sub={`${regCount.toLocaleString('en-MY')} sales`}/>
            <StatTile label="Median RM/m²" value={regPpsm ? 'RM ' + regPpsm.toLocaleString() : '—'} sub="built-up"/>
            <StatTile label="Median built-up" value={regFloor ? regFloor + ' m²' : '—'}
              sub={regLand ? regLand + ' m² land' : 'strata'}/>
            <StatTile label="Trend ’21→’26" value={(yUp ? '+' : '') + (yGrowth || 0).toFixed(1) + '%'}
              accent={yUp ? C.up : C.down} sub={(regFhPct != null ? regFhPct : 0) + '% freehold'}/>
          </div>

          {/* recent transactions — real NAPIC Open Transaction Data, scoped to the
              selected fields. Sits above the averages so the latest actual sales
              lead the area read-out. */}
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <Display size={16} weight={500}>Recent transactions</Display>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid }}>
                {recentTxns && recentTxns.length
                  ? (recentTotal > recentTxns.length
                      ? `${recentTxns.length.toLocaleString('en-MY')} of ${recentTotal.toLocaleString('en-MY')} records`
                      : `${recentTxns.length.toLocaleString('en-MY')} record${recentTxns.length > 1 ? 's' : ''}`)
                  : 'matching records'}
              </span>
            </div>
            {!recentLoading && recentTxns && recentTxns.length > 0 && recentNote && (
              <div style={{
                marginTop: 8, padding: '7px 10px', borderRadius: 7,
                background: C.earthFaint, border: `1px solid ${C.earth}33`,
                fontFamily: "'DM Sans',sans-serif", fontSize: 11, lineHeight: 1.4, color: C.mid,
              }}>{recentNote}</div>
            )}
            {recentLoading ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '14px 2px',
                fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid,
              }}>
                <span className="tmap-spin" style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: `2px solid ${C.border}`, borderTopColor: C.earth, display: 'inline-block',
                }}/>
                Loading recent transactions…
              </div>
            ) : (recentTxns && recentTxns.length) ? (
              <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <RecentTh>Date</RecentTh>
                        <RecentTh>Type</RecentTh>
                        <RecentTh>Road / Area</RecentTh>
                        <RecentTh right>m²</RecentTh>
                        <RecentTh right>Price</RecentTh>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTxns.map((r, i) => <RecentTxnRow key={i} r={r} i={i}/>)}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{
                marginTop: 6, padding: '14px 2px', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.muted,
              }}>No transaction records found for this selection.</div>
            )}
          </Card>

          {/* avg price by property type — real averages from the Open Transaction Data */}
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <Display size={16} weight={500}>Average price by property type</Display>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid }}>
                avg · count
              </span>
            </div>
            {byType.length === 0 ? (
              <div style={{ marginTop: 12, padding: '14px 0', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.muted }}>
                No transaction records found for this selection.
              </div>
            ) : (
            <div style={{ marginTop: 14, display: 'grid', gap: 9 }}>
              {byType.map(t => {
                const dom = dominantType && t.type === dominantType.type;
                return (
                  <div key={t.type} style={{ display: 'grid', gridTemplateColumns: '128px 1fr 118px', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5,
                      color: dom ? C.earth : C.deep, fontWeight: dom ? 600 : 400,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortType(t.type)}</span>
                    <div style={{ height: 14, background: C.cream, borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                      <div style={{ width: (t.avg / maxTypeAvg * 100) + '%', height: '100%',
                        background: dom ? C.earth : C.light, transition: 'width .8s cubic-bezier(.16,1,.3,1)' }}/>
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Mono size={12}>{rmCompact(t.avg)}</Mono>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, color: C.muted }}> · {t.n}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </Card>

          {/* price trend by year — taller bar chart (left half) paired with a
              price-growth line chart (right half). Split so the sparse bars read
              clearly and the up/down trajectory gets its own panel. */}
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <Display size={16} weight={500}>Average transacted price by year</Display>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid }}>
                {yearScope === 'type' && sel.propertyType
                  ? shortType(sel.propertyType)
                  : yearScope === 'area' ? 'all types' : '2021–2026'}
              </span>
            </div>
            {yearAvg.length === 0 ? (
              <div style={{ marginTop: 12, padding: '14px 0', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.muted }}>
                No transaction records found for this selection.
              </div>
            ) : (
            <div style={{ marginTop: 22, display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
              {/* left — average price (bars) + volume (dots) */}
              <div style={{ flex: '1 1 248px', minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.muted,
                  textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>
                  bar = avg price · ● = volume
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 186 }}>
                  {yearAvg.map(y => {
                    const h = 26 + ((y.avg - minYear) / (maxYear - minYear || 1)) * 120;
                    return (
                      <div key={y.y} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                        <Mono size={10} color={C.mid}>{rmCompact(y.avg)}</Mono>
                        <div style={{ width: '100%', maxWidth: 42, height: h, background: `linear-gradient(180deg, ${C.light}, ${C.deep})`,
                          borderRadius: '5px 5px 0 0', transition: 'height .8s cubic-bezier(.16,1,.3,1)' }}/>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.earth,
                            opacity: 0.35 + 0.65 * (y.n / maxVol), display: 'inline-block' }}/>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: C.muted }}>{y.n}</span>
                        </div>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.mid }}>{y.y}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* right — price-growth trajectory (line) */}
              <div style={{ flex: '1 1 248px', minWidth: 0, borderLeft: `1px solid ${C.border}`, paddingLeft: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '.07em' }}>price growth</span>
                  {yearAvg.length > 1 && (
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 600,
                      color: yUp ? C.up : C.down, background: (yUp ? C.up : C.down) + '18',
                      padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap',
                    }}>P/L {(yUp ? '+' : '') + yGrowth.toFixed(1) + '%'}</span>
                  )}
                </div>
                <div style={{ height: 198, display: 'flex', alignItems: 'center' }}>
                  <YearLineChart rows={yearAvg}/>
                </div>
                {yearAvg.length > 1 && (
                  <div style={{
                    marginTop: 4, display: 'flex', justifyContent: 'space-between', gap: 10,
                    fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid,
                  }}>
                    <span>Overall P/L ({yearAvg[0].y}-{yearAvg[yearAvg.length - 1].y})</span>
                    <Mono size={11.5} color={yUp ? C.up : C.down}>
                      {(yUp ? '+' : '') + yGrowth.toFixed(1) + '%'}
                    </Mono>
                  </div>
                )}
              </div>
            </div>
            )}
          </Card>

          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
            Indicative AVM estimate based on NAPIC 2021–2026 comparable transactions. Areas in sq.m. Not a formal valuation.
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(237,233,225,.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 5 }}>
          <span className="tmap-spin" style={{ width: 18, height: 18, borderRadius: '50%',
            border: `2px solid ${C.border}`, borderTopColor: C.earth, display: 'inline-block' }}/>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.mid }}>Computing valuation…</span>
        </div>
      )}

      <style>{`
        @media (max-width: 880px) {
          .val-grid { grid-template-columns: 1fr !important; }
          .val-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
};

Object.assign(window, { ValuationDashboard });
