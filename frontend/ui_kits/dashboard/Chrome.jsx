/* eslint-disable no-undef */
const Icon = {
  Home: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 L12 4 L21 12"/><path d="M5 10 V20 H19 V10"/>
    </svg>
  ),
  Trend: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>
    </svg>
  ),
  Alert: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 L22 21 L2 21 Z"/><line x1="12" y1="10" x2="12" y2="15"/>
      <circle cx="12" cy="18" r="0.7" fill="currentColor"/>
    </svg>
  ),
  Map: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/>
      <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  ),
  Calculator: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2"/>
      <line x1="8" y1="7" x2="16" y2="7"/>
      <circle cx="9" cy="12" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="12" r="0.8" fill="currentColor" stroke="none"/>
      <circle cx="9" cy="16" r="0.8" fill="currentColor" stroke="none"/>
      <line x1="14" y1="16" x2="16" y2="16"/>
    </svg>
  ),
  Bars: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||18} height={p.size||18} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="21" x2="21" y2="21"/>
      <rect x="5" y="11" width="3.4" height="8"/>
      <rect x="10.3" y="6" width="3.4" height="13"/>
      <rect x="15.6" y="14" width="3.4" height="5"/>
    </svg>
  ),
  HouseMark: () => (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" stroke={C.earth}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16 L16 4 L29 16"/><path d="M6 14 L6 28 L26 28 L26 14"/>
      <path d="M13 28 L13 19 L19 19 L19 28"/>
    </svg>
  ),
};

const NAV = [
  { id: 'valuation', label: 'Valuation', icon: Icon.Home },
  { id: 'market', label: 'Market Overview', icon: Icon.Bars },
  { id: 'roi', label: 'ROI Calculator', icon: Icon.Calculator },
  { id: 'sentiment', label: 'Sentiment Index', icon: Icon.Trend },
];

const Sidebar = ({ active, onNav }) => (
  <aside style={{
    width: 220, height: '100%', flexShrink: 0, background: C.deep, color: C.cream,
    display: 'flex', flexDirection: 'column', padding: '20px 0',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 18px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <Icon.HouseMark/>
      <Display size={20} color={C.cream} weight={500}>Mytanah</Display>
    </div>
    <nav style={{ display: 'flex', flexDirection: 'column', padding: '12px 0', flex: 1 }}>
      {NAV.map(n => {
        const isActive = active === n.id;
        const Ico = n.icon;
        return (
          <button key={n.id} onClick={() => onNav(n.id)} style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '12px 20px',
            background: isActive ? C.mid : 'transparent',
            borderLeft: `3px solid ${isActive ? C.earth : 'transparent'}`,
            borderTop: 0, borderRight: 0, borderBottom: 0,
            color: isActive ? C.cream : 'rgba(220,215,201,.6)',
            fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 400,
            cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
          }}
          onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = C.cream; }}
          onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(220,215,201,.6)'; }}>
            <Ico/>
            <span>{n.label}</span>
          </button>
        );
      })}
    </nav>
    <div style={{
      padding: '0 20px', fontFamily: "'DM Sans', sans-serif",
      fontSize: 10, color: 'rgba(220,215,201,.4)', letterSpacing: '.04em',
    }}>
      Data: NAPIC 2021–2025
    </div>
  </aside>
);

const Header = ({ title }) => (
  <header style={{
    height: 56, flexShrink: 0, background: C.cream,
    borderBottom: `1px solid ${C.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px',
  }}>
    <Display size={22} weight={500}>{title}</Display>
    <span style={{
      background: C.deep, color: C.cream, padding: '6px 14px',
      borderRadius: 9999, fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12, fontWeight: 500,
    }}>Q1 2025</span>
  </header>
);

Object.assign(window, { Icon, Sidebar, Header });
