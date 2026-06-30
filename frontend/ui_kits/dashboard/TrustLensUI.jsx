/* eslint-disable no-undef */
/* TrustLensUI.jsx — product mockup widgets for the Mytanah TrustLens pitch.
   Built on the Mytanah tokens (C, Display, Eyebrow from Primitives.jsx).
   Everything here is mock data shaped like the real AVM / sentiment / risk
   outputs. Widgets: RiskBadge, TrustDial, ValueRange, Sparkline, CompsTable,
   and the composed TrustDashboardPreview (the hero "money shot"). */

const rm = (n, cur = 'RM') => cur + ' ' + Math.round(n).toLocaleString('en-US');
const rmK = (n, cur = 'RM') => cur + ' ' + (Math.round(n / 1000)).toLocaleString('en-US') + 'k';

/* ---- trust label system (the five verdicts) -------------------------- */
const TRUST_LABELS = {
  'Fair Price':        { fg: C.up,    fgDark: '#74C49A', soft: 'rgba(45,122,79,.14)' },
  'Underpriced':       { fg: C.earth, fgDark: '#C49A7A', soft: 'rgba(162,123,92,.16)' },
  'Overpriced':        { fg: C.down,  fgDark: '#E0938A', soft: 'rgba(166,50,40,.14)' },
  'High Risk':         { fg: '#7E1E16', fgDark: '#E58A80', soft: 'rgba(126,30,22,.16)' },
  'Insufficient Data': { fg: C.muted, fgDark: '#C8C3B8', soft: 'rgba(176,170,158,.20)' },
};

const RiskBadge = ({ label, size = 'md', onDark }) => {
  const t = TRUST_LABELS[label] || TRUST_LABELS['Insufficient Data'];
  const col = onDark ? (t.fgDark || t.fg) : t.fg;
  const pad = size === 'lg' ? '8px 16px' : size === 'sm' ? '4px 10px' : '6px 13px';
  const fs = size === 'lg' ? 14 : size === 'sm' ? 11 : 12.5;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: pad,
      borderRadius: 9999, background: onDark ? 'rgba(255,255,255,.06)' : t.soft,
      border: `1px solid ${col}${onDark ? '66' : '55'}`, color: col,
      fontFamily: "'DM Sans', sans-serif", fontSize: fs, fontWeight: 600,
      letterSpacing: '.01em', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 9999, background: col, flexShrink: 0 }}/>
      {label}
    </span>
  );
};

/* ---- semicircle trust gauge ------------------------------------------ */
const gPt = (cx, cy, r, t) => { const a = Math.PI - t * Math.PI; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
const gArc = (cx, cy, r, t0, t1) => {
  const [x0, y0] = gPt(cx, cy, r, t0), [x1, y1] = gPt(cx, cy, r, t1);
  const large = (t1 - t0) > 0.5 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const scoreColor = (s) => (s >= 70 ? C.up : s >= 45 ? C.stable : C.down);

const TrustDial = ({ score = 76, label = 'Fair Price', onDark }) => {
  const W = 188, H = 116, cx = W / 2, cy = 104, r = 84;
  const t = Math.max(0, Math.min(1, score / 100));
  const col = scoreColor(score);
  const trackCol = onDark ? 'rgba(220,215,201,.16)' : C.border;
  return (
    <div style={{ position: 'relative', width: W, margin: '0 auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <path d={gArc(cx, cy, r, 0, 1)} fill="none" stroke={trackCol} strokeWidth="11" strokeLinecap="round"/>
        <path d={gArc(cx, cy, r, 0, t)} fill="none" stroke={col} strokeWidth="11" strokeLinecap="round"/>
        {[0.45, 0.7].map(m => {
          const [mx, my] = gPt(cx, cy, r, m);
          const [ix, iy] = gPt(cx, cy, r - 11, m);
          return <line key={m} x1={mx} y1={my} x2={ix} y2={iy} stroke={onDark ? 'rgba(20,28,22,.5)' : C.cream} strokeWidth="2"/>;
        })}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 40, fontWeight: 600, lineHeight: 1, color: onDark ? C.cream : C.deep }}>
          {score}<span style={{ fontSize: 16, color: onDark ? 'rgba(220,215,201,.5)' : C.muted }}>/100</span>
        </div>
        <div style={{ marginTop: 6 }}><RiskBadge label={label} size="sm" onDark={onDark}/></div>
      </div>
    </div>
  );
};

/* ---- AVM value range bar --------------------------------------------- */
const ValueRange = ({ lower, central, upper, listing, onDark, cur = 'RM' }) => {
  const pad = (upper - lower) * 0.28 || 1;
  const lo = lower - pad, hi = upper + pad;
  const pos = v => `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  const lpos = `${Math.max(2, Math.min(98, ((listing - lo) / (hi - lo)) * 100)).toFixed(2)}%`;
  const listColor = listing > upper ? C.down : listing < lower ? C.earth : C.up;
  const trackCol = onDark ? 'rgba(220,215,201,.14)' : C.border;
  const txt = onDark ? C.cream : C.deep;
  const sub = onDark ? 'rgba(220,215,201,.55)' : C.mid;
  return (
    <div>
      <div style={{ position: 'relative', height: 26, marginBottom: 8 }}>
        {listing != null && (
          <div style={{ position: 'absolute', left: lpos, top: 0, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, fontWeight: 700, color: listColor }}>Listing {rmK(listing, cur)}</span>
          </div>
        )}
      </div>
      <div style={{ position: 'relative', height: 12 }}>
        <div style={{ position: 'absolute', inset: '4px 0', borderRadius: 9999, background: trackCol }}/>
        <div style={{ position: 'absolute', top: 4, bottom: 4, left: pos(lower), right: `calc(100% - ${pos(upper)})`, borderRadius: 9999, background: `linear-gradient(90deg, ${C.earth}, ${C.up})`, opacity: onDark ? 0.9 : 0.85 }}/>
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: pos(central), width: 2.5, background: txt, transform: 'translateX(-50%)' }}/>
        {listing != null && (
          <div style={{ position: 'absolute', top: -5, bottom: -5, left: lpos, width: 0, transform: 'translateX(-50%)' }}>
            <div style={{ width: 14, height: 14, borderRadius: 9999, background: listColor, border: `3px solid ${onDark ? C.deep : C.raised}`, marginTop: 4 }}/>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
        <div><div style={{ color: sub, fontSize: 9.5, fontFamily: "'DM Sans',sans-serif", letterSpacing: '.1em', textTransform: 'uppercase' }}>Lower</div><div style={{ color: txt }}>{rmK(lower, cur)}</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ color: sub, fontSize: 9.5, fontFamily: "'DM Sans',sans-serif", letterSpacing: '.1em', textTransform: 'uppercase' }}>Central</div><div style={{ color: txt, fontWeight: 600 }}>{rmK(central, cur)}</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ color: sub, fontSize: 9.5, fontFamily: "'DM Sans',sans-serif", letterSpacing: '.1em', textTransform: 'uppercase' }}>Upper</div><div style={{ color: txt }}>{rmK(upper, cur)}</div></div>
      </div>
    </div>
  );
};

/* ---- sentiment sparkline --------------------------------------------- */
const Sparkline = ({ data, color = C.earth, w = 160, h = 44 }) => {
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / span) * (h - 6) - 3]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${w} ${h} L0 ${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <path d={area} fill={color} opacity="0.12"/>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.2" fill={color}/>
    </svg>
  );
};

/* ---- comparable transactions table ----------------------------------- */
const CompsTable = ({ rows, onDark, compact }) => {
  const txt = onDark ? C.cream : C.deep;
  const sub = onDark ? 'rgba(220,215,201,.55)' : C.mid;
  const line = onDark ? 'rgba(220,215,201,.12)' : C.border;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans',sans-serif" }}>
      <thead>
        <tr style={{ textAlign: 'left' }}>
          {['Scheme / Road', 'Type', 'Built-up', 'Price', 'Quarter'].map((h, i) => (
            <th key={h} style={{
              padding: compact ? '0 0 8px' : '0 0 10px', fontSize: 10, fontWeight: 600, letterSpacing: '.1em',
              textTransform: 'uppercase', color: sub, borderBottom: `1px solid ${line}`,
              textAlign: i >= 3 ? 'right' : 'left',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ padding: compact ? '9px 0' : '12px 0', borderBottom: `1px solid ${line}`, color: txt, fontSize: 13, fontWeight: 500 }}>{r.scheme}</td>
            <td style={{ padding: compact ? '9px 0' : '12px 0', borderBottom: `1px solid ${line}`, color: sub, fontSize: 12.5 }}>{r.type}</td>
            <td style={{ padding: compact ? '9px 0' : '12px 0', borderBottom: `1px solid ${line}`, color: sub, fontSize: 12.5 }}>{r.size}</td>
            <td style={{ padding: compact ? '9px 0' : '12px 0', borderBottom: `1px solid ${line}`, color: txt, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }}>{rm(r.price)}</td>
            <td style={{ padding: compact ? '9px 0' : '12px 0', borderBottom: `1px solid ${line}`, color: sub, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }}>{r.q}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/* ---- mock subject + comps -------------------------------------------- */
const DEMO = {
  subject: { addr: 'No. 12, Jalan Setia Prima U13, Setia Alam', area: 'Shah Alam, Selangor', type: '2-storey Terrace · 22×75 · 2,200 sqft', listing: 720000 },
  avm: { lower: 648000, central: 685000, upper: 722000 },
  trust: { score: 76, label: 'Fair Price' },
  sentiment: [38, 41, 40, 46, 52, 49, 58, 63, 61, 67],
  comps: [
    { scheme: 'Jalan Setia Prima U13', type: '2-sty Terrace', size: '2,180 sqft', price: 690000, q: "Q3'24" },
    { scheme: 'Jalan Setia Murni U13', type: '2-sty Terrace', size: '2,240 sqft', price: 705000, q: "Q2'24" },
    { scheme: 'Setia Eco Park', type: '2-sty Terrace', size: '2,400 sqft', price: 760000, q: "Q1'24" },
    { scheme: 'Jalan Setia Impian', type: '2-sty Terrace', size: '2,150 sqft', price: 672000, q: "Q4'23" },
  ],
};

/* ---- the composed hero dashboard card -------------------------------- */
const TrustDashboardPreview = ({ data = DEMO }) => {
  const { subject, avm, trust, sentiment, comps } = data;
  return (
    <div className="tl-card" style={{
      background: C.raised, borderRadius: 18, border: `1px solid ${C.border}`,
      boxShadow: '0 40px 90px rgba(10,14,12,.45)', overflow: 'hidden',
      width: '100%', maxWidth: 460,
    }}>
      {/* header */}
      <div style={{ background: C.deep, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: C.earthLight }}>Trust Report</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 600, color: C.cream, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subject.addr}</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: 'rgba(220,215,201,.55)' }}>{subject.area}</div>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'rgba(220,215,201,.5)', whiteSpace: 'nowrap' }}>Q1 2025</span>
      </div>

      <div style={{ padding: 20, display: 'grid', gap: 18 }}>
        {/* dial + listing */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'center' }}>
          <TrustDial score={trust.score} label={trust.label}/>
          <div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C.mid }}>Listing price</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 600, color: C.deep, marginTop: 2 }}>{rm(subject.listing)}</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid, marginTop: 8, lineHeight: 1.4 }}>{subject.type}</div>
          </div>
        </div>

        {/* value range */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <Eyebrow>Fair value range · live</Eyebrow>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, color: C.mid }}>Exa-researched</span>
          </div>
          <ValueRange lower={avm.lower} central={avm.central} upper={avm.upper} listing={subject.listing}/>
        </div>

        {/* rental yield / ROI */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: C.cream, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <Eyebrow>Est. gross rental yield</Eyebrow>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: C.up }}>3.6%<span style={{ color: C.mid, fontSize: 11, fontWeight: 400 }}> · positive ROI</span></span>
        </div>

        {/* sentiment + risk row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: C.cream, borderRadius: 12, padding: '12px 14px', border: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Eyebrow>Sentiment</Eyebrow>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.up, fontWeight: 600 }}>+18%</span>
            </div>
            <div style={{ marginTop: 8 }}><Sparkline data={sentiment} color={C.up} w={150} h={36}/></div>
          </div>
          <div style={{ background: C.cream, borderRadius: 12, padding: '12px 14px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Eyebrow>Market risk</Eyebrow>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: C.deep, lineHeight: 1 }}>Upward</div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.mid, marginTop: 2 }}>price pressure · low overhang</div>
            </div>
          </div>
        </div>

        {/* comps */}
        <div>
          <div style={{ marginBottom: 8 }}><Eyebrow>Comparable transactions · NAPIC</Eyebrow></div>
          <CompsTable rows={comps.slice(0, 3)} compact/>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { rm, rmK, TRUST_LABELS, RiskBadge, TrustDial, ValueRange, Sparkline, CompsTable, TrustDashboardPreview, DEMO });
