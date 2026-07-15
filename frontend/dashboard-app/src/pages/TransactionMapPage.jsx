/* TransactionMapPage.jsx — Malaysia Property Transaction Map / Valuation */
import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, Eyebrow, Display, PrimitiveCard as Card } from '@/components/shared/primitives'
import { API } from '@/lib/api'
import { loadMalaysiaGeo } from '@/lib/malaysiaGeo'
import {
  getMukims, getAreas, getDistrictAreas, getAreaMukim, getRoads,
  getDistrictRoads, getRoadPath, getTransactionsForScope, PROPERTY_TYPES_ALL,
} from '@/lib/propertyData'
import Combobox from '@/components/Combobox'
import MalaysiaMap from '@/components/MalaysiaMap'
import ValuationDashboard from '@/components/ValuationDashboard'
import TxnTable from '@/components/TxnTable'
import TxnFullPage from '@/components/TxnFullPage'
import { useChrome } from '@/components/layout/ChromeContext'

/* ---- small shared bits ------------------------------------------------ */
const Spinner = ({ label }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 9, padding: '10px 2px',
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.mid,
  }}>
    <span className="tmap-spin" style={{
      width: 15, height: 15, borderRadius: '50%',
      border: `2px solid ${C.border}`, borderTopColor: C.earth, display: 'inline-block',
    }}/>
    {label}
  </div>
);

const apiTxnToRow = (r, state) => {
  const land = r.Land == null ? null : Number(r.Land);
  const built = r.Area == null ? null : Number(r.Area);
  const price = Number(r.Price || 0);
  const basis = built || land;
  const date = (r['Transaction Date'] || '').slice(0, 10);
  return {
    state,
    district: r.District || '',
    mukim: r.Mukim || '',
    area: r['Scheme Name/Area'] || '',
    road: r['Road Name'] || 'Not recorded',
    type: r['Property Type'] || '',
    year: Number(r.Year || (date ? date.slice(0, 4) : 0)),
    date,
    monthYear: date,
    price,
    land,
    built,
    tenure: r.Tenure || '',
    lot: r['Unit Level'] || '',
    level: r['Unit Level'] || null,
    ppsf: basis ? Math.round(price / basis) : null,
    ppsm: basis ? Math.round(price / basis) : null,
  };
};

const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 44, height: 44, borderRadius: 8, background: C.cream,
  border: `1px solid ${C.border}`, color: C.mid, cursor: 'pointer', flexShrink: 0,
};

const clearLink = {
  border: 0, background: 'transparent', color: C.muted, cursor: 'pointer',
  fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, padding: 0,
  display: 'flex', alignItems: 'center', gap: 3,
};

const disclosureBtn = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 7, textAlign: 'left',
  background: 'transparent', border: `1px dashed ${C.earth}55`, borderRadius: 8,
  color: C.earth, cursor: 'pointer', padding: '9px 11px',
  fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600,
};

const StepSelect = ({ label, value, placeholder, options, onChange, disabled, loading, loadingLabel, onClear }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
      <Eyebrow style={{ color: disabled ? C.muted : C.earth }}>{label}</Eyebrow>
      {onClear && value && !loading && (
        <button onClick={() => onClear()} style={clearLink}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          Clear
        </button>
      )}
    </div>
    {loading
      ? <Spinner label={loadingLabel}/>
      : (
        <select value={value} disabled={disabled}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', background: disabled ? C.cream : C.cream,
            border: `1px solid ${disabled ? C.border : C.earth + '55'}`,
            color: disabled ? C.muted : C.deep,
            fontFamily: "'DM Sans', sans-serif", fontSize: 14,
            borderRadius: 8, padding: '10px 12px', boxSizing: 'border-box',
            appearance: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.65 : 1,
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%232C3930' stroke-width='1.5'><polyline points='4 6 8 10 12 6'/></svg>")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
          }}>
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
  </div>
);

/* ---- main page -------------------------------------------------------- */
export default function TransactionMapPage() {
  const { navOpen, engage } = useChrome()
  const navigate = useNavigate()
  const onExportRoi = (seed) => navigate('/dashboard/roi', { state: { seed } })
  const variant = 'valuation'
  const onEngage = engage
  const isVal = variant === 'valuation';
  const [geo, setGeo] = useState(null);
  const [geoErr, setGeoErr] = useState(false);

  const [sel, setSel] = useState({ state: '', district: '', propertyType: '', mukim: '', area: '', road: '' });
  const [load, setLoad] = useState({ d: false, m: false, a: false, r: false, t: false });
  const [txns, setTxns] = useState(null); // null = not loaded yet
  const [region, setRegion] = useState('west');
  const [panelOpen, setPanelOpen] = useState(false); // starts minimized; auto-expands after State + District
  const [sheetOpen, setSheetOpen] = useState(true);
  const [sheetMax, setSheetMax] = useState(false); // table expanded to full page
  const [searched, setSearched] = useState(null); // snapshot of the selection when Search was pressed
  const [roadSearchOpen, setRoadSearchOpen] = useState(false); // "can't find mukim/scheme? search by road" disclosure
  const [roadAutoFill, setRoadAutoFill] = useState(null); // {road, mukim, area} when mukim/scheme were back-filled from a road

  // filters
  const [types, setTypes] = useState([]);      // selected property types
  const [yearMode, setYearMode] = useState('range');
  const [yr, setYr] = useState({ single: '', from: '', to: '' });
  const [price, setPrice] = useState({ min: '', max: '' });

  const timers = useRef([]);
  const bodyRef = useRef(null);
  const delay = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // when a new cascade step is revealed, scroll the panel body to show it
  useEffect(() => {
    const el = bodyRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [sel.district, sel.mukim, sel.area, sel.road, load.m, load.a, load.r, roadSearchOpen]);

  useEffect(() => {
    loadMalaysiaGeo().then(setGeo).catch(() => setGeoErr(true));
  }, []);

  /* Live mukim + scheme lists from the backend, scoped to the user's selection.
     The frontend's mock generator is kept as a fallback in case the API is
     offline or the chosen mock district/mukim doesn't exist in the dataset. */
  const [apiMukims, setApiMukims] = useState(null);
  const [apiAreas, setApiAreas] = useState(null);
  const [apiRoads, setApiRoads] = useState(null); // real road names for the current scope
  useEffect(() => {
    if (!sel.district) { setApiMukims(null); setApiAreas(null); return; }
    let cancelled = false;
    const q = { district: sel.district };
    if (sel.mukim) q.mukim = sel.mukim;
    API.valuationOptions(q)
      .then(opts => {
        if (cancelled) return;
        setApiMukims((opts.mukim || []).map(o => o.value));
        setApiAreas((opts.scheme || []).map(o => o.value));
      })
      .catch(() => {
        if (cancelled) return;
        setApiMukims(null); setApiAreas(null);
      });
    return () => { cancelled = true; };
  }, [sel.district, sel.mukim]);

  /* Real road names for whichever road picker is on screen — the scheme-scoped
     ④ field (when a scheme is chosen) or the district-level "search by road"
     disclosure. Fetched on demand so the big district list isn't pulled unless
     needed; falls back to the mock generator if the API is offline. */
  useEffect(() => {
    const wantRoads = !!sel.district && (!!sel.area || roadSearchOpen);
    if (!wantRoads) { setApiRoads(null); return; }
    let cancelled = false;
    API.valuationRoads({ district: sel.district, mukim: sel.mukim, scheme: sel.area })
      .then(r => { if (!cancelled) setApiRoads(r.roads || []); })
      .catch(() => { if (!cancelled) setApiRoads(null); });
    return () => { cancelled = true; };
  }, [sel.district, sel.mukim, sel.area, roadSearchOpen]);

  // option lists (derived strictly from the current selection)
  // keep the current selection in its own list — a mukim/scheme back-filled from
  // a road may not exist in the live API list, but must stay selectable.
  const withSelected = (list, val) => (val && !list.includes(val) ? [val, ...list] : list);
  const districts = geo && sel.state ? geo.byName[sel.state].districts.map(d => d.name) : [];
  const mockMukims = sel.district ? getMukims(sel.state, sel.district) : [];
  const mukims = withSelected((apiMukims && apiMukims.length) ? apiMukims : mockMukims, sel.mukim);
  // Scheme/Area can be browsed at the mukim level (if a mukim is chosen) OR
  // directly at the district level (Mukim is optional).
  const mockAreas = sel.mukim
    ? getAreas(sel.state, sel.district, sel.mukim)
    : (sel.district ? getDistrictAreas(sel.state, sel.district) : []);
  const areas = withSelected((apiAreas && apiAreas.length) ? apiAreas : mockAreas, sel.area);
  // Scheme-scoped road list for the ④ field — real names from the API, mock as
  // fallback. Keep the chosen road selectable even if the API list capped it.
  const mockRoads = sel.area ? getRoads(sel.state, sel.district, sel.mukim, sel.area) : [];
  const roads = sel.area
    ? withSelected((apiRoads && apiRoads.length) ? apiRoads : mockRoads, sel.road)
    : [];
  // District-wide road list — the fallback when the user can't find their
  // mukim/scheme. Real names from the API; the mock walk is memoised as fallback.
  const mockDistrictRoads = useMemo(
    () => (sel.district ? getDistrictRoads(sel.state, sel.district) : []),
    [sel.state, sel.district],
  );
  const districtRoads = (apiRoads && apiRoads.length) ? apiRoads : mockDistrictRoads;

  /* cascade handlers — each resets every level below it and clears prior results.
     Selecting the blank option (or pressing Clear) deselects that level. */
  const selectState = (state) => {
    // propertyType is orthogonal to the geographic cascade — keep it so the user
    // doesn't lose their pick (and re-forget it) when they change location.
    setSel(s => ({ state: state || '', district: '', propertyType: s.propertyType, mukim: '', area: '', road: '' }));
    setSearched(null); setTxns(null); setRoadAutoFill(null);
    if (state) {
      if (onEngage) onEngage(); // reveal the dashboard chrome on first engagement
      if (geo) setRegion(geo.regionOf(state));
      setLoad(l => ({ ...l, d: true })); delay(() => setLoad(l => ({ ...l, d: false })), 450);
    }
  };
  const selectDistrict = (district) => {
    setSel(s => ({ ...s, district: district || '', mukim: '', area: '', road: '' }));
    setSearched(null); setTxns(null); setRoadAutoFill(null);
    if (district) {
      setPanelOpen(true); // surface the panel so the user can refine
      setLoad(l => ({ ...l, m: true, a: true }));
      delay(() => setLoad(l => ({ ...l, m: false, a: false })), 450);
    }
  };
  const selectMukim = (mukim) => {
    setSel(s => ({ ...s, mukim: mukim || '', area: '', road: '' }));
    setSearched(null); setTxns(null); setRoadAutoFill(null);
    if (mukim) { setLoad(l => ({ ...l, a: true })); delay(() => setLoad(l => ({ ...l, a: false })), 450); }
  };
  const selectArea = (area) => {
    // Shortcut: a scheme can be picked directly under a district (mukim skipped).
    // Keep any mukim the user already chose; if they skipped it, auto back-fill
    // the REAL parent mukim from the backend (mock lookup is the offline fallback).
    setSel(s => ({ ...s, area: area || '', road: '' }));
    setSearched(null); setTxns(null); setRoadAutoFill(null);
    if (!area) return;
    setLoad(l => ({ ...l, r: true })); delay(() => setLoad(l => ({ ...l, r: false })), 450);

    if (sel.district && !sel.mukim) {
      API.valuationOptions({ district: sel.district, scheme: area })
        .then(opts => {
          const top = (opts.mukim || [])[0];
          if (!top) throw new Error('no parent mukim');
          setSel(s => (s.area === area && !s.mukim ? { ...s, mukim: top.value } : s));
        })
        .catch(() => {
          const mk = getAreaMukim(sel.state, sel.district, area);
          if (mk) setSel(s => (s.area === area && !s.mukim ? { ...s, mukim: mk } : s));
        });
    }
  };
  const selectRoad = (road) => {
    setSel(s => ({ ...s, road: road || '' }));
    setSearched(null); setTxns(null); setRoadAutoFill(null);
  };
  /* Pick a road directly under the district (skipping mukim + scheme). People
     often know their road but not their mukim/scheme, so we ask the backend which
     mukim + scheme own this real road and back-fill them — the cascade above
     auto-populates and the area-scoped Road field takes over. Mock lookup is the
     offline fallback. */
  const selectRoadDirect = (road) => {
    setSearched(null); setTxns(null);
    if (!road) { setSel(s => ({ ...s, road: '' })); setRoadAutoFill(null); return; }
    setSel(s => ({ ...s, road })); // reflect the road immediately
    API.valuationOptions({ district: sel.district, road })
      .then(opts => {
        const mk = (opts.mukim || [])[0];
        const sc = (opts.scheme || [])[0];
        if (!sc) throw new Error('no owner');
        setSel(s => (s.road === road
          ? { ...s, mukim: mk ? mk.value : s.mukim, area: sc.value }
          : s));
        setRoadAutoFill({ road, mukim: mk ? mk.value : '', area: sc.value });
      })
      .catch(() => {
        const path = getRoadPath(sel.state, sel.district, road) || {};
        setSel(s => (s.road === road ? { ...s, mukim: path.mukim || s.mukim, area: path.area || s.area } : s));
        setRoadAutoFill(path.area ? { road, mukim: path.mukim || '', area: path.area } : null);
      });
  };
  const selectPropertyType = (propertyType) => {
    setSel(s => ({ ...s, propertyType: propertyType || '' }));
    setSearched(null); setTxns(null);
  };

  /* explicit Search — gathers results for whatever level is filled. Road is
     optional; a mukim- or district-level search is allowed. */
  const canSearch = !!sel.district && !!sel.propertyType;
  const runSearch = () => {
    if (!sel.district) return;
    const snap = { ...sel };
    setSearched(snap);
    setSheetOpen(true);
    if (onEngage) onEngage();
    if (isVal) setPanelOpen(false); // minimise Location Search so it doesn't cover the dashboard
    setLoad(l => ({ ...l, t: true }));
    if (!isVal) {
      API.dataQuery({
        district: snap.district,
        mukim: snap.mukim,
        scheme: snap.area,
        road: snap.road,
        property_type: snap.propertyType,
        limit: 600,
      })
        .then(data => {
          const rows = (data.rows || []).map(r => apiTxnToRow(r, snap.state));
          setTxns(rows);
          setTypes(snap.propertyType ? [snap.propertyType] : [...new Set(rows.map(r => r.type))]);
          setYearMode('range'); setYr({ single: '', from: '', to: '' }); setPrice({ min: '', max: '' });
        })
        .catch(() => {
          const rows = getTransactionsForScope(snap);
          setTxns(rows);
          setTypes(snap.propertyType ? [snap.propertyType] : [...new Set(rows.map(r => r.type))]);
          setYearMode('range'); setYr({ single: '', from: '', to: '' }); setPrice({ min: '', max: '' });
        })
        .finally(() => setLoad(l => ({ ...l, t: false })));
    } else {
      delay(() => setLoad(l => ({ ...l, t: false })), 600);
    }
  };

  const availTypes = useMemo(() => txns ? [...new Set(txns.map(r => r.type))].sort() : [], [txns]);

  const filtered = useMemo(() => {
    if (!txns) return [];
    return txns.filter(r => {
      if (types.length && !types.includes(r.type)) return false;
      if (yearMode === 'single' && yr.single && r.year !== +yr.single) return false;
      if (yearMode === 'range') {
        if (yr.from && r.year < +yr.from) return false;
        if (yr.to && r.year > +yr.to) return false;
      }
      if (price.min && r.price < +price.min) return false;
      if (price.max && r.price > +price.max) return false;
      return true;
    });
  }, [txns, types, yearMode, yr, price]);

  const medianPrice = useMemo(() => {
    if (!filtered.length) return null;
    const s = filtered.map(r => r.price).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }, [filtered]);

  /* status hint */
  let hint;
  if (!sel.state) hint = isVal ? 'Select a state to begin a valuation.' : 'Select a state to explore property transactions.';
  else if (!sel.district) hint = `${sel.state}. Choose a district to continue.`;
  else if (!sel.propertyType) hint = `${sel.district}, ${sel.state}. Pick a property type below (optionally refine by mukim / scheme / road first).`;
  else if (searched) hint = isVal
    ? `Valuation ready for ${searched.area || searched.mukim || searched.district}.`
    : `Showing ${searched.road || searched.area || searched.mukim || searched.district}.`;
  else hint = `${sel.district}, ${sel.state}. Refine by mukim / scheme / road (all optional), then press Search.`;

  if (geoErr) return (
    <div style={{ padding: 28 }}>
      <Card><div style={{ fontFamily: "'DM Sans',sans-serif", color: C.down }}>
        Unable to load the Malaysia map data. Please check your connection and reload.
      </div></Card>
    </div>
  );

  const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
  const sheetVisible = !!searched || sheetMax; // results appear once Search runs (kept while maximized)
  // Slide the Location Search clear of the floating nav while it's open.
  const searchLeft = navOpen ? 252 : 16;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: 'linear-gradient(165deg, #E7E3DA 0%, #DCD7C9 55%, #CFC9BA 100%)' }}>
      {/* ===== FULL-BLEED MAP ===== */}
      {geo
        ? <MalaysiaMap geo={geo}
            selectedState={sel.state || null}
            selectedDistrict={sel.district || null}
            region={region}
            onRegionChange={(r) => { if (!sel.state) setRegion(r); }}
            onSelectState={selectState}
            onSelectDistrict={selectDistrict}/>
        : <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column', gap: 12,
          }}>
            <span className="tmap-spin" style={{
              width: 30, height: 30, borderRadius: '50%',
              border: `3px solid ${C.border}`, borderTopColor: C.earth,
            }}/>
            <span style={{ fontFamily: "'DM Sans',sans-serif", color: C.mid, fontSize: 13 }}>
              Loading Malaysia map…
            </span>
          </div>}

      {/* ===== FLOATING SEARCH PANEL =====
           Hidden while the table is maximized to full page — the search fields
           live in TxnFullPage's header instead, so they don't overlap. */}
      {!sheetMax && (panelOpen ? (
        <div className="tmap-panel" style={{
          position: 'absolute', top: 16, left: searchLeft, width: 366, maxWidth: 'calc(100% - 32px)',
          maxHeight: sheetVisible && sheetOpen ? (isVal ? 'calc(38% - 36px)' : 'calc(46% - 40px)') : 'calc(100% - 32px)',
          display: 'flex', flexDirection: 'column',
          background: C.raised, border: `1px solid ${C.border}`, borderRadius: 14,
          boxShadow: '0 12px 36px rgba(44,57,48,.20)', zIndex: 20,
          transition: 'left .5s cubic-bezier(.16,1,.3,1)',
          animation: 'tmapPanelIn .35s cubic-bezier(.16,1,.3,1)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 18px 12px',
          }}>
            <div>
              <Eyebrow>Explore</Eyebrow>
              <Display as="h2" size={20} weight={500} style={{ display: 'block', marginTop: 2 }}>Location Search</Display>
            </div>
            <button onClick={() => setPanelOpen(false)} title="Collapse"
              style={iconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
          </div>

          <div ref={bodyRef} style={{ padding: '0 18px', overflowY: 'auto', flex: 1 }}>
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: searched ? C.deep : C.earthFaint,
              border: `1px solid ${searched ? C.deep : C.earth + '40'}`,
              fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, lineHeight: 1.45,
              color: searched ? C.cream : C.mid,
            }}>{hint}</div>

            <div style={{ margin: '16px 0 18px', display: 'grid', gap: 13 }}>
              <StepSelect label="① State" value={sel.state} placeholder="Select state"
                options={geo ? geo.stateNames : []} onChange={selectState}
                onClear={() => selectState('')}/>

              <StepSelect label="② District" value={sel.district}
                placeholder={sel.state ? 'Select district' : 'Select a state first'}
                options={districts} onChange={selectDistrict}
                disabled={!sel.state} loading={load.d} loadingLabel="Loading districts…"
                onClear={() => selectDistrict('')}/>

              {sel.district && (
                <div style={{ display: 'grid', gap: 9 }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid }}>
                    <span style={{ fontWeight: 600, color: C.earth }}>③ Narrow down</span>
                    <span> — select a mukim and / or a scheme / area (optional)</span>
                  </div>
                  {roadAutoFill && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 7,
                      padding: '9px 11px', borderRadius: 8, background: C.earthFaint,
                      border: `1px solid ${C.earth}40`, fontFamily: "'DM Sans',sans-serif",
                      fontSize: 11.5, lineHeight: 1.45, color: C.deep,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.earth}
                        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span>
                        Auto-filled from <strong>{roadAutoFill.road}</strong> — Mukim{' '}
                        <strong>{roadAutoFill.mukim || '—'}</strong>, Scheme / Area{' '}
                        <strong>{roadAutoFill.area}</strong>. Adjust below if needed.
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 11 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <Eyebrow style={{ color: C.earth }}>Mukim</Eyebrow>
                        {sel.mukim && !load.m && (
                          <button onClick={() => selectMukim('')} style={clearLink}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
                            Clear
                          </button>
                        )}
                      </div>
                      {load.m
                        ? <Spinner label="Loading…"/>
                        : <Combobox value={sel.mukim} placeholder="Search mukim"
                            options={mukims} onChange={selectMukim}/>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <Eyebrow style={{ color: C.earth }}>Scheme / Area</Eyebrow>
                        {sel.area && !load.a && (
                          <button onClick={() => selectArea('')} style={clearLink}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
                            Clear
                          </button>
                        )}
                      </div>
                      {load.a
                        ? <Spinner label="Loading…"/>
                        : <Combobox value={sel.area} placeholder="Search scheme"
                            options={areas} onChange={selectArea}/>}
                    </div>
                  </div>
                </div>
              )}

              {/* Escape hatch: can't find the mukim/scheme? Search a road directly
                  under the district — picking one back-fills its mukim & scheme. */}
              {sel.district && !sel.area && (
                <div>
                  <button onClick={() => setRoadSearchOpen(o => !o)} style={disclosureBtn}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                      strokeWidth="1.6" style={{ flexShrink: 0, transform: roadSearchOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                      <polyline points="6 4 10 8 6 12"/>
                    </svg>
                    Can't find your mukim or scheme? Search by road name
                  </button>
                  {roadSearchOpen && (
                    <div style={{ marginTop: 9 }}>
                      <Eyebrow style={{ color: C.earth, display: 'block', marginBottom: 6 }}>Road Name</Eyebrow>
                      <Combobox value={sel.road} placeholder="Search road name"
                        options={districtRoads} onChange={selectRoadDirect}/>
                      <div style={{ marginTop: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid }}>
                        Pick a road and we'll fill in its mukim &amp; scheme for you.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sel.area && (
                <StepSelect label="④ Road Name (optional)" value={sel.road}
                  placeholder="Any road" options={roads} onChange={selectRoad}
                  loading={load.r} loadingLabel="Loading road names…" onClear={() => selectRoad('')}/>
              )}

              {/* Property Type sits at the bottom, just above Search, and always
                  renders regardless of the optional cascade steps above it — so it
                  stays in view (and gets nudged down as mukim/area/road reveal)
                  and users stop skipping it. Highlighted until it's chosen. */}
              <div style={{
                borderRadius: 8, padding: 12, transition: 'background .2s, border-color .2s',
                background: sel.propertyType ? 'transparent' : C.earthFaint,
                border: `1px solid ${sel.propertyType ? C.border : C.earth + '55'}`,
              }}>
                <StepSelect label="Property Type · required" value={sel.propertyType}
                  placeholder="Select a property type" options={PROPERTY_TYPES_ALL}
                  onChange={selectPropertyType} onClear={() => selectPropertyType('')}/>
              </div>

              <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 2 }}>
                <button onClick={runSearch} disabled={!canSearch} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: canSearch ? C.deep : C.border, color: canSearch ? C.cream : C.muted,
                  border: 0, borderRadius: 9, padding: '12px 16px', cursor: canSearch ? 'pointer' : 'not-allowed',
                  fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, transition: 'background .2s',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  {searched ? 'Update search' : (isVal ? 'Value this area' : 'Search')}
                </button>
                {(sel.state || sel.district) && (
                  <button onClick={() => selectState('')} style={{
                    background: 'transparent', border: `1px solid ${C.border}`, color: C.mid, borderRadius: 9,
                    padding: '12px 14px', fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>Clear</button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setPanelOpen(true)} style={{
          position: 'absolute', top: 16, left: searchLeft, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 9,
          background: C.deep, color: C.cream, border: 0, borderRadius: 9999,
          padding: '11px 18px', fontFamily: "'DM Sans',sans-serif", fontSize: 13.5,
          fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px rgba(44,57,48,.24)',
          transition: 'left .5s cubic-bezier(.16,1,.3,1)',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Location Search
          {searched && !isVal && txns && <span style={{
            background: C.earth, borderRadius: 9999, padding: '1px 8px', fontSize: 11,
          }}>{filtered.length}</span>}
        </button>
      ))}

      {/* ===== BOTTOM SHEET: TRANSACTION TABLE ===== */}
      {sheetVisible && (
        <div className="tmap-sheet" style={{
          position: 'absolute', zIndex: 15,
          left: sheetMax ? 0 : 16, right: sheetMax ? 0 : 16,
          bottom: sheetMax ? 0 : 16, top: sheetMax ? 0 : 'auto',
          height: sheetMax ? 'auto' : (sheetOpen ? (isVal ? 'min(62%, 580px)' : 'min(48%, 460px)') : 52),
          display: 'flex', flexDirection: 'column',
          background: C.raised,
          border: sheetMax ? 'none' : `1px solid ${C.border}`,
          borderRadius: sheetMax ? 0 : 14,
          boxShadow: sheetMax ? 'none' : '0 -8px 36px rgba(44,57,48,.18)', overflow: 'hidden',
          transition: 'height .34s cubic-bezier(.16,1,.3,1), left .3s, right .3s, bottom .3s, border-radius .3s',
          animation: 'tmapSheetIn .4s cubic-bezier(.16,1,.3,1)',
        }}>
          {!sheetOpen && !sheetMax && (
            <button onClick={() => setSheetOpen(true)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 20px', background: 'transparent', border: 0, cursor: 'pointer',
            }}>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: C.deep }}>
                {isVal
                  ? `Estimated Valuation · ${(searched && (searched.area || searched.mukim || searched.district)) || sel.area || sel.district}`
                  : `Property Transactions${txns ? ` · ${filtered.length} of ${txns.length}` : ''}`}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.mid}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
          )}
          {(sheetOpen || sheetMax) && (
            <Fragment>
              {!sheetMax && (
                <div style={{ position: 'absolute', top: 16, right: 18, zIndex: 4, display: 'flex', gap: 8 }}>
                  <button onClick={() => { setYearMode('range'); setSheetMax(true); }} title="Expand to full page"
                    style={iconBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                      <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                    </svg>
                  </button>
                  <button onClick={() => setSheetOpen(false)} title="Collapse" style={iconBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                </div>
              )}
              {isVal ? (
                sheetMax ? (
                  <TxnFullPage variant="valuation"
                    sel={sel} geo={geo} searched={searched} onSearch={runSearch} canSearch={canSearch}
                    onExit={() => { setSheetMax(false); setPanelOpen(false); }}
                    districts={districts} mukims={mukims} areas={areas} roads={roads}
                    selectState={selectState} stateNames={geo ? geo.stateNames : []}
                    selectDistrict={selectDistrict} selectMukim={selectMukim}
                    selectArea={selectArea} selectRoad={selectRoad}
                    selectPropertyType={selectPropertyType}
                    clearAll={() => { selectState(''); setSheetMax(false); setPanelOpen(true); }}
                    load={load} txns={txns} filtered={filtered}
                    availTypes={availTypes} types={types} setTypes={setTypes}
                    yr={yr} setYr={setYr} price={price} setPrice={setPrice} years={YEARS}
                    onExportRoi={onExportRoi}/>
                ) : (
                  <ValuationDashboard sel={searched || sel} loading={load.t} onExportRoi={onExportRoi}/>
                )
              ) : sheetMax ? (
                <TxnFullPage
                  sel={sel} geo={geo} searched={searched} onSearch={runSearch} canSearch={canSearch}
                  onExit={() => { setSheetMax(false); setPanelOpen(true); }}
                  districts={districts} mukims={mukims} areas={areas} roads={roads}
                  selectState={selectState} stateNames={geo ? geo.stateNames : []}
                  selectDistrict={selectDistrict} selectMukim={selectMukim}
                  selectArea={selectArea} selectRoad={selectRoad}
                  selectPropertyType={selectPropertyType}
                  clearAll={() => { selectState(''); setSheetMax(false); setPanelOpen(true); }}
                  load={load} txns={txns} filtered={filtered}
                  availTypes={availTypes} types={types} setTypes={setTypes}
                  yr={yr} setYr={setYr} price={price} setPrice={setPrice} years={YEARS}/>
              ) : (
                <TxnTable fill
                  sel={searched || sel} loading={load.t} txns={txns} filtered={filtered}
                  availTypes={availTypes} types={types} setTypes={setTypes}
                  yearMode={yearMode} setYearMode={setYearMode} yr={yr} setYr={setYr}
                  price={price} setPrice={setPrice} years={YEARS} median={medianPrice}/>
              )}
            </Fragment>
          )}
        </div>
      )}

      <style>{`
        @keyframes tmapspin { to { transform: rotate(360deg); } }
        .tmap-spin { animation: tmapspin .8s linear infinite; }
        @keyframes tmapPanelIn { from {opacity:0; transform:translateX(-16px)} to {opacity:1; transform:none} }
        @keyframes tmapSheetIn { from {opacity:0; transform:translateY(24px)} to {opacity:1; transform:none} }
        @keyframes tmapPop { from {opacity:0; transform:translateY(-6px)} to {opacity:1; transform:none} }
        @media (max-width: 720px) {
          .tmap-panel { width: calc(100% - 32px) !important; }
        }
      `}</style>
    </div>
  );
}
