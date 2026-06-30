/* eslint-disable no-undef */
/* TrustLensLanding.jsx — the Mytanah TrustLens hackathon pitch deck as one
   scrolling landing page. 10 sections, each framed like a deck slide, on the
   Mytanah token system (cream world / forest authority / earth accent).
   Depends on Primitives.jsx (C, Display, Eyebrow), TrustLensUI.jsx, HeroGlobe.jsx. */
const { useState, useEffect, useRef } = React;

const APP_HREF = '/dashboard?from=intro';

/* ---- tiny line-icon set (kept simple per house rules) ---------------- */
const ic = (paths, vb = '0 0 24 24') => (p) => (
  <svg viewBox={vb} width={p.size || 22} height={p.size || 22} fill="none"
    stroke={p.color || 'currentColor'} strokeWidth={p.sw || 1.6} strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);
const I = {
  shield: ic(<><path d="M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z"/><path d="M9 12 l2 2 l4-4"/></>),
  eyeOff: ic(<><path d="M3 3 L21 21"/><path d="M10.6 6.2 A9 9 0 0 1 21 12 a16 16 0 0 1-2.3 3"/><path d="M6.4 7.6 A16 16 0 0 0 3 12 a14 14 0 0 0 9 6 9 9 0 0 0 3.4-.7"/></>),
  scatter: ic(<><line x1="4" y1="20" x2="4" y2="4"/><line x1="4" y1="20" x2="20" y2="20"/><circle cx="9" cy="14" r="1.3"/><circle cx="13" cy="9" r="1.3"/><circle cx="17" cy="11" r="1.3"/><circle cx="8" cy="9" r="1.3"/></>),
  pulse: ic(<><path d="M3 12 h4 l2-6 3 12 2-7 2 4 h5"/></>),
  search: ic(<><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.7" y2="16.7"/></>),
  scale: ic(<><line x1="12" y1="3" x2="12" y2="21"/><path d="M6 7 L3 13 h6 Z"/><path d="M18 7 L15 13 h6 Z"/><line x1="6" y1="7" x2="18" y2="7"/><line x1="8" y1="21" x2="16" y2="21"/></>),
  brain: ic(<><path d="M9 5 a3 3 0 0 0-3 3 a3 3 0 0 0-1 5 a3 3 0 0 0 4 4 h0 V5 Z"/><path d="M15 5 a3 3 0 0 1 3 3 a3 3 0 0 1 1 5 a3 3 0 0 1-4 4 V5 Z"/></>),
  layers: ic(<><polygon points="12 3 21 8 12 13 3 8"/><polyline points="3 13 12 18 21 13"/></>),
  flag: ic(<><line x1="5" y1="21" x2="5" y2="3"/><path d="M5 4 h11 l-2 3 2 3 H5"/></>),
  bank: ic(<><path d="M3 9 L12 4 L21 9"/><line x1="5" y1="9" x2="5" y2="18"/><line x1="10" y1="9" x2="10" y2="18"/><line x1="14" y1="9" x2="14" y2="18"/><line x1="19" y1="9" x2="19" y2="18"/><line x1="3" y1="21" x2="21" y2="21"/></>),
  building: ic(<><rect x="5" y="3" width="14" height="18"/><line x1="9" y1="7" x2="9" y2="7.01"/><line x1="13" y1="7" x2="13" y2="7.01"/><line x1="9" y1="11" x2="9" y2="11.01"/><line x1="13" y1="11" x2="13" y2="11.01"/><line x1="9" y1="15" x2="9" y2="15.01"/><line x1="13" y1="15" x2="13" y2="15.01"/></>),
  user: ic(<><circle cx="12" cy="8" r="3.6"/><path d="M5 20 a7 7 0 0 1 14 0"/></>),
  api: ic(<><rect x="3" y="8" width="6" height="8" rx="1.5"/><rect x="15" y="8" width="6" height="8" rx="1.5"/><line x1="9" y1="12" x2="15" y2="12"/></>),
  check: ic(<><polyline points="4 12 10 18 20 5"/></>),
  arrow: ic(<><line x1="4" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></>),
  doc: ic(<><path d="M6 3 h8 l4 4 v14 H6 Z"/><polyline points="14 3 14 7 18 7"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></>),
  trend: ic(<><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></>),
};

/* ---- shared section scaffolding -------------------------------------- */
const MAXW = 1180;

const Slide = ({ id, dark, raised, children, style }) => (
  <section id={id} data-screen-label={id} style={{
    position: 'relative',
    padding: 'clamp(72px, 10vh, 132px) clamp(20px, 6vw, 88px)',
    background: dark ? C.deep : raised ? C.raised : C.cream,
    color: dark ? C.cream : C.deep,
    borderTop: dark ? 'none' : `1px solid ${C.border}`,
    ...style,
  }}>
    <div style={{ maxWidth: MAXW, margin: '0 auto' }}>{children}</div>
  </section>
);

const Kicker = ({ n, track, dark }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.earth, fontWeight: 600 }}>{n} / 11</span>
    <span style={{ width: 28, height: 1, background: dark ? 'rgba(220,215,201,.3)' : C.border }}/>
    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: dark ? 'rgba(220,215,201,.6)' : C.mid }}>{track}</span>
  </div>
);

const H = ({ children, dark, size = 'clamp(30px, 4.4vw, 52px)', style }) => (
  <h2 style={{
    fontFamily: "'Cormorant Garamond',serif", fontWeight: 500, fontSize: size,
    lineHeight: 1.04, letterSpacing: '-0.01em', margin: 0, maxWidth: 18 + 'ch',
    color: dark ? C.cream : C.deep, textWrap: 'balance', ...style,
  }}>{children}</h2>
);

const Lead = ({ children, dark, style }) => (
  <p style={{
    fontFamily: "'DM Sans',sans-serif", fontSize: 'clamp(15px, 1.5vw, 18px)', lineHeight: 1.6,
    color: dark ? 'rgba(220,215,201,.72)' : C.mid, maxWidth: 620, margin: '18px 0 0', textWrap: 'pretty', ...style,
  }}>{children}</p>
);

const Panel = ({ children, dark, style, accent }) => (
  <div style={{
    background: dark ? 'rgba(255,255,255,.04)' : C.raised,
    border: `1px solid ${dark ? 'rgba(220,215,201,.14)' : C.border}`,
    borderTop: accent ? `3px solid ${accent}` : undefined,
    borderRadius: 14, padding: 24, ...style,
  }}>{children}</div>
);

const IconBox = ({ Icon, dark, color = C.earth }) => (
  <div style={{
    width: 46, height: 46, borderRadius: 12, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: dark ? 'rgba(162,123,92,.16)' : 'rgba(162,123,92,.12)',
    border: `1px solid ${color}40`, color,
  }}><Icon size={22}/></div>
);

/* ===================================================================== */
/* NAV                                                                    */
/* ===================================================================== */
const NavBar = () => {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const stage = document.getElementById('hero-stage');
      const th = stage ? stage.offsetHeight - 140 : 80;
      setSolid(window.scrollY > th);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const link = (href, label) => (
    <a href={href} style={{
      fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 500, textDecoration: 'none',
      color: solid ? C.mid : 'rgba(220,215,201,.7)', transition: 'color .2s',
    }}
      onMouseEnter={e => e.currentTarget.style.color = solid ? C.deep : C.cream}
      onMouseLeave={e => e.currentTarget.style.color = solid ? C.mid : 'rgba(220,215,201,.7)'}>{label}</a>
  );
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(16px, 5vw, 56px)', height: 64,
      background: solid ? 'rgba(237,233,225,.88)' : 'transparent',
      backdropFilter: solid ? 'blur(12px)' : 'none', WebkitBackdropFilter: solid ? 'blur(12px)' : 'none',
      borderBottom: solid ? `1px solid ${C.border}` : '1px solid transparent',
      transition: 'background .3s, border-color .3s',
    }}>
      <a href="#hero-stage" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none" stroke={C.earth} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 16 L16 4 L29 16"/><path d="M6 14 L6 28 L26 28 L26 14"/><path d="M13 28 L13 19 L19 19 L19 28"/>
        </svg>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, fontWeight: 600, color: solid ? C.deep : C.cream, whiteSpace: 'nowrap' }}>
          Mytanah
        </span>
      </a>
      <div className="tl-navlinks" style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        {link('#problem', 'Problem')}
        {link('#solution', 'Solution')}
        {link('#engine', 'Engine')}
        {link('#pricing', 'Pricing')}
        <a href={APP_HREF} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
          background: C.earth, color: C.cream, padding: '9px 18px', borderRadius: 9999,
          fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 600,
          boxShadow: solid ? 'none' : '0 6px 18px rgba(10,14,12,.3)',
        }}>View Demo <I.arrow size={15}/></a>
      </div>
    </nav>
  );
};

/* ===================================================================== */
/* 1 · HERO                                                               */
/* ===================================================================== */
const HeroContent = () => (
  <div style={{ position: 'relative', width: '100%', maxWidth: MAXW, margin: '0 auto' }}>
    {/* calm ambient corner globe — the settled end-state */}
    <div style={{ position: 'absolute', top: '-26%', right: '-12%', width: 'min(600px, 58vw)', height: 'min(600px, 58vw)', opacity: 0.4, pointerEvents: 'none' }}>
      <HeroGlobe/>
    </div>
    {/* legibility scrim */}
    <div aria-hidden="true" style={{ position: 'absolute', inset: '-50% -25%', background: 'linear-gradient(90deg, rgba(10,14,12,.92) 0%, rgba(10,14,12,.55) 46%, rgba(10,14,12,0) 78%)', pointerEvents: 'none' }}/>
    <div className="tl-hero-grid" style={{ position: 'relative', zIndex: 2, width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,.95fr)', gap: 'clamp(32px, 5vw, 72px)', alignItems: 'center' }}>
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <span style={pillDark}>Hackathon · Trust, Commerce &amp; Fraud</span>
          <span style={pillDarkGhost}>AI-Native Organizations</span>
        </div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, color: C.cream,
          fontSize: 'clamp(38px, 6vw, 76px)', lineHeight: 1.02, letterSpacing: '-0.015em', margin: 0,
        }}>
          Know if a property<br/>price can be <em style={{ fontStyle: 'italic', fontWeight: 400, color: C.earthLight }}>trusted.</em>
        </h1>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 'clamp(15px, 1.6vw, 18px)', lineHeight: 1.6, color: 'rgba(220,215,201,.74)', maxWidth: 520, margin: '22px 0 32px', textWrap: 'pretty' }}>
          Mytanah combines live AI valuation, real transaction evidence, housing sentiment, and rental-yield ROI to help buyers across Malaysia make safer property decisions.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <a href={APP_HREF} style={ctaPrimary}>View Demo <I.arrow size={17}/></a>
          <a href="#demo" style={ctaGhost}>See Trust Score</a>
        </div>
        <a href="#problem" style={{
          display: 'inline-flex', alignItems: 'center', gap: 9, marginTop: 'clamp(26px,5vh,48px)',
          textDecoration: 'none', fontFamily: "'DM Sans',sans-serif", fontSize: 12, letterSpacing: '.14em',
          textTransform: 'uppercase', color: 'rgba(220,215,201,.5)',
        }}>
          Scroll to explore the pitch
          <span className="tl-chev">↓</span>
        </a>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <TrustDashboardPreview/>
      </div>
    </div>
  </div>
);

/* The scroll-scrubbed intro: the sphere unrolls (ScrollGlobe) while the hero
   tilts up from 3D perspective (the fused ContainerScroll effect) and lands as
   the full landing view. */
const ScrollHero = () => {
  const titleRef = useRef(null);
  const cardRef = useRef(null);
  useEffect(() => {
    const clamp = (t, a = 0, b = 1) => (t < a ? a : t > b ? b : t);
    const smooth = t => t * t * (3 - 2 * t);
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    let ticking = false;
    const apply = () => {
      ticking = false;
      const el = document.getElementById('hero-stage'); if (!el) return;
      const rect = el.getBoundingClientRect();
      const runway = el.offsetHeight - window.innerHeight;
      const p = clamp(-rect.top / (runway || 1));
      if (titleRef.current) {
        const o = 1 - smooth(clamp(p / 0.2));
        titleRef.current.style.opacity = String(o);
        titleRef.current.style.transform = `translateY(${(-p * 150).toFixed(1)}px)`;
        titleRef.current.style.pointerEvents = o < 0.05 ? 'none' : 'auto';
      }
      if (cardRef.current) {
        const cp = easeOut(clamp((p - 0.5) / 0.42));
        const rot = (1 - cp) * 22;
        const sc = 0.9 + cp * 0.1;
        const ty = (1 - cp) * 70;
        const op = clamp((cp - 0.05) * 1.4);
        cardRef.current.style.transform = `translateY(${ty.toFixed(1)}px) scale(${sc.toFixed(3)}) rotateX(${rot.toFixed(2)}deg)`;
        cardRef.current.style.opacity = String(op);
        cardRef.current.style.pointerEvents = op > 0.92 ? 'auto' : 'none';
      }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    apply();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  return (
    <section id="hero-stage" data-screen-label="01 Hero" style={{
      position: 'relative', height: '240vh',
      background: 'radial-gradient(120% 55% at 68% 8%, #16201A 0%, #0f1612 45%, #0a0e0c 100%)',
    }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', perspective: '1500px' }}>
        <ScrollGlobe targetId="hero-stage"/>
        <div className="tl-stars" aria-hidden="true"/>

        {/* intro wordmark — lifts away as you scroll */}
        <div ref={titleRef} style={{
          position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24,
          background: 'radial-gradient(ellipse 46% 42% at 50% 50%, rgba(10,14,12,.80) 0%, rgba(10,14,12,.46) 44%, rgba(10,14,12,0) 72%)',
        }}>
          <div style={{ color: C.earth, fontFamily: "'DM Sans',sans-serif", fontSize: 12, letterSpacing: '.24em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 20, textShadow: '0 1px 12px rgba(10,14,12,.85)' }}>Malaysia property intelligence</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, color: C.cream, fontSize: 'clamp(60px, 13vw, 168px)', lineHeight: 0.95, margin: 0, letterSpacing: '-0.02em', textShadow: '0 2px 40px rgba(10,14,12,.92), 0 1px 6px rgba(10,14,12,.85)' }}>Mytanah</h1>
          <div style={{ marginTop: 32, display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: "'DM Sans',sans-serif", fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(220,215,201,.55)' }}>Scroll to begin <span className="tl-chev">↓</span></div>
        </div>

        {/* hero card — tilts up into place */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div ref={cardRef} style={{
            width: '100%', height: '100%', opacity: 0, transformOrigin: '50% 6%',
            transform: 'translateY(70px) scale(.9) rotateX(22deg)',
            display: 'flex', alignItems: 'center',
            padding: 'clamp(92px,13vh,150px) clamp(20px,6vw,88px) clamp(40px,8vh,90px)',
          }}>
            <HeroContent/>
          </div>
        </div>
      </div>
    </section>
  );
};

const pillDark = { fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.02em', color: C.deep, background: C.earthLight, padding: '7px 14px', borderRadius: 9999 };
const pillDarkGhost = { fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.02em', color: 'rgba(220,215,201,.8)', border: '1px solid rgba(220,215,201,.28)', padding: '7px 14px', borderRadius: 9999 };
const ctaPrimary = { display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: C.earth, color: C.cream, padding: '15px 28px', borderRadius: 9999, fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, boxShadow: '0 14px 34px rgba(162,123,92,.4)' };
const ctaGhost = { display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: C.cream, padding: '15px 26px', borderRadius: 9999, fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, border: '1px solid rgba(220,215,201,.32)' };

/* ===================================================================== */
/* 2 · PROBLEM                                                            */
/* ===================================================================== */
const PROBLEMS = [
  { Icon: I.eyeOff, title: 'Bait-and-switch listings', body: 'Agents post a unit far below market to bait enquiries, then claim it is “just sold” and steer you to a pricier one. The low price was never real.' },
  { Icon: I.scatter, title: 'Price opacity', body: 'Asking prices routinely diverge from real transacted values — and a professional valuation costs RM800–RM2,500 and takes days.' },
  { Icon: I.pulse, title: 'No sentiment or risk read', body: 'Buyer sentiment, demand and housing-cycle risk move prices, yet they are absent and unreadable in today’s property tools.' },
];
const Problem = () => (
  <Slide id="problem">
    <Kicker n="02" track="The Problem"/>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 8 }}>
      <H>Property decisions are too expensive to get wrong.</H>
      <Lead>Across Malaysia, buyers negotiate blind — misled by bait listings and asking prices that have little to do with what actually transacted.</Lead>
    </div>
    <div className="tl-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 44 }}>
      {PROBLEMS.map((p, i) => (
        <Panel key={i} accent={C.earth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <IconBox Icon={p.Icon}/>
          <div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 18, fontWeight: 600, color: C.deep, marginBottom: 8 }}>{p.title}</div>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, lineHeight: 1.6, color: C.mid, margin: 0 }}>{p.body}</p>
          </div>
        </Panel>
      ))}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 28 }}>
      {[['RM800–2,500', 'cost of one valuation'], ['3–5 days', 'typical turnaround'], ['0', 'sentiment signals in buyer tools']].map(([a, b], i) => (
        <div key={i} style={{ flex: '1 1 200px', background: C.raised, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 600, color: C.deep }}>{a}</div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid, marginTop: 2 }}>{b}</div>
        </div>
      ))}
    </div>
  </Slide>
);

/* ===================================================================== */
/* 2B · BAIT-AND-SWITCH — the problem, in focus                          */
/* ===================================================================== */
const bsCard = { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(220,215,201,.14)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column' };
const StepTag = ({ n, label, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <span style={{ width: 26, height: 26, borderRadius: 9999, background: color, color: C.deep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{n}</span>
    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: C.cream, whiteSpace: 'nowrap' }}>{label}</span>
  </div>
);
const Bubble = ({ side, children }) => (
  <div style={{
    alignSelf: side === 'out' ? 'flex-end' : 'flex-start', maxWidth: '90%',
    background: side === 'out' ? C.earth : 'rgba(220,215,201,.1)',
    color: side === 'out' ? C.cream : 'rgba(220,215,201,.92)',
    border: side === 'out' ? 'none' : '1px solid rgba(220,215,201,.14)',
    borderRadius: 14, borderBottomRightRadius: side === 'out' ? 4 : 14, borderBottomLeftRadius: side === 'in' ? 4 : 14,
    padding: '9px 13px', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, lineHeight: 1.42,
  }}>{children}</div>
);

const BaitSwitch = () => (
  <Slide id="bait" dark>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.earthLight, fontWeight: 600 }}>THE #1 TRICK</span>
      <span style={{ width: 28, height: 1, background: 'rgba(220,215,201,.3)' }}/>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(220,215,201,.6)' }}>Problem in focus</span>
    </div>
    <H dark>The price you saw was never real.</H>
    <Lead dark style={{ maxWidth: 660 }}>A listing appears far below market. You enquire — and it is suddenly “just sold.” The agent pivots you to a pricier unit. The cheap price was only bait. Mytanah breaks the trick by showing the real transacted price — straight from NAPIC records — up front.</Lead>

    <div className="tl-flow" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 48, alignItems: 'stretch' }}>
      {/* 1 — the bait */}
      <div style={bsCard}>
        <StepTag n="1" label="The bait" color={C.earthLight}/>
        <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, marginTop: 16 }}>
          <img src="bait-property-listing.jpeg" alt="Bait property listing example" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}/>
          <div style={{ padding: '13px 14px', background: C.raised }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 21, fontWeight: 600, color: C.deep }}>RM1,980,000</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.mid, marginTop: 2 }}>Inter-terrace · SS2, Petaling Jaya</div>
            <div style={{ display: 'inline-block', marginTop: 9, fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, fontWeight: 600, color: C.down, background: 'rgba(166,50,40,.12)', border: `1px solid ${C.down}40`, padding: '3px 9px', borderRadius: 9999, whiteSpace: 'nowrap' }}>Below market · rare freehold</div>
          </div>
        </div>
      </div>
      {/* 2 — the lie */}
      <div style={bsCard}>
        <StepTag n="2" label="The lie" color={C.stable}/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <Bubble side="out">Hi, is this terrace still available?</Bubble>
          <Bubble side="in">So sorry — that one was sold over the weekend!</Bubble>
          <Bubble side="in">But I have one two streets away at RM2,650,000 — still good value, want to view?</Bubble>
        </div>
      </div>
      {/* 3 — the reveal */}
      <div style={{ ...bsCard, border: `1px solid ${C.earth}` }}>
        <StepTag n="3" label="Mytanah reveals" color={C.up}/>
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div style={{ background: C.raised, border: `1px solid ${C.border}`, borderRadius: 10, padding: '13px 14px' }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.mid }}>Real transacted price · NAPIC records</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 600, color: C.deep, marginTop: 4 }}>RM2,480,000</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid, marginTop: 1 }}>last sold Q3’24 · same street</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <RiskBadge label="High Risk" size="sm" onDark/>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: 'rgba(220,215,201,.72)' }}>The RM1.98M ad never transacted</span>
          </div>
        </div>
      </div>
    </div>
  </Slide>
);

/* ===================================================================== */
/* 3 · SOLUTION                                                           */
/* ===================================================================== */
const CAPS = [
  ['Real transaction price', 'The actual transacted price from open property data — not the asking price.'],
  ['Fair value range', 'Lower, central and upper estimate from live web research, not a static model.'],
  ['Bait-and-switch check', 'Flags listings priced far from real evidence so a fake low ad can’t fool you.'],
  ['Housing sentiment', 'Google Trends search behaviour as a demand proxy.'],
  ['Market-cycle risk', 'Upward, neutral or downward price-pressure read.'],
  ['Rental yield & ROI', 'LLM-sourced rents to estimate gross yield and return on investment.'],
];
const Solution = () => (
  <Slide id="solution" raised>
    <Kicker n="03" track="The Solution"/>
    <H>An AI trust layer for property transactions.</H>
    <Lead style={{ maxWidth: 680 }}>
      Mytanah does not replace a professional valuer. An LLM researches the live web over open transaction data to deliver instant <strong style={{ color: C.deep }}>preliminary trust intelligence</strong> — so buyers, lenders and platforms know what to scrutinise before money moves.
    </Lead>
    <div className="tl-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 44 }}>
      {CAPS.map(([t, b], i) => (
        <div key={i} style={{ display: 'flex', gap: 14, padding: '18px 0', borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.earth, fontWeight: 600, paddingTop: 2 }}>{String(i + 1).padStart(2, '0')}</span>
          <div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, color: C.deep }}>{t}</div>
            <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.55, color: C.mid, margin: '5px 0 0' }}>{b}</p>
          </div>
        </div>
      ))}
    </div>
  </Slide>
);

/* ===================================================================== */
/* 4 · DEMO FLOW                                                          */
/* ===================================================================== */
const STEPS = [
  ['Enter the listing', 'Property attributes or a listing URL — type, size, scheme, asking price.'],
  ['AI researches the market', 'An LLM searches live listings and open transactions (Exa Search) for a fair-value range.'],
  ['Compare to real evidence', 'The asking price is matched against actual recent transactions nearby.'],
  ['Receive a trust label', 'One verdict, plus rental yield & ROI and the evidence behind it.'],
];
const Demo = () => (
  <Slide id="demo" dark>
    <Kicker n="04" track="Product Demo Flow" dark/>
    <H dark>From listing to trust score in seconds.</H>
    <div className="tl-flow" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginTop: 48 }}>
      {STEPS.map(([t, b], i) => (
        <div key={i} style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9999, background: C.earth, color: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{i + 1}</span>
            {i < 3 && <span className="tl-flow-line" style={{ flex: 1, height: 1, background: 'rgba(220,215,201,.2)' }}/>}
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, color: C.cream, marginBottom: 7 }}>{t}</div>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.55, color: 'rgba(220,215,201,.62)', margin: 0 }}>{b}</p>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 44 }}>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(220,215,201,.5)', marginBottom: 16 }}>The five verdicts</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {['Fair Price', 'Overpriced', 'Underpriced', 'Insufficient Data', 'High Risk'].map(l => (
          <RiskBadge key={l} label={l} size="lg" onDark/>
        ))}
      </div>
    </div>
  </Slide>
);

/* ===================================================================== */
/* 5 · RESEARCH ENGINE                                                    */
/* ===================================================================== */
const Engine = () => (
  <Slide id="engine">
    <Kicker n="05" track="Research Engine"/>
    <H>Built for the Malaysian market.</H>
    <Lead>Three live intelligence modules — web-researched valuation, search sentiment, and housing-cycle risk — fused into one trust output.</Lead>
    <div className="tl-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 44 }}>
      <Panel accent={C.up} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><IconBox Icon={I.scale} color={C.up}/><div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16.5, fontWeight: 600 }}>Live Valuation Engine</div></div>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.6, color: C.mid, margin: 0 }}>An LLM researches live listings and open transactions online via Exa Search for a value range — then sources rents to compute yield and ROI.</p>
        <div style={{ marginTop: 'auto', paddingTop: 8 }}><ValueRange lower={648000} central={685000} upper={722000} listing={720000}/></div>
      </Panel>
      <Panel accent={C.earth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><IconBox Icon={I.pulse} color={C.earth}/><div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16.5, fontWeight: 600 }}>Housing Sentiment Index</div></div>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.6, color: C.mid, margin: 0 }}>Google Trends property-search behaviour becomes a real-time demand and sentiment proxy.</p>
        <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Sparkline data={DEMO.sentiment} color={C.earth} w={150} h={48}/>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18, fontWeight: 600, color: C.earth }}>+18%</span>
        </div>
      </Panel>
      <Panel accent={C.stable} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><IconBox Icon={I.layers} color={C.stable}/><div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16.5, fontWeight: 600 }}>Housing Cycle Risk</div></div>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.6, color: C.mid, margin: 0 }}>Transaction volume, household debt, impaired loans, overhang, supply and sentiment → directional pressure.</p>
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['Down', C.down], ['Neutral', C.stable], ['Up', C.up]].map(([l, c], i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRadius: 8, background: i === 2 ? c : 'transparent', border: `1px solid ${i === 2 ? c : C.border}`, color: i === 2 ? C.cream : C.mid, fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600 }}>{l}</div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  </Slide>
);

/* ===================================================================== */
/* 6 · TRUST & FRAUD                                                      */
/* ===================================================================== */
const FLAGS = [
  'Bait-and-switch ads — a low price that “disappears” on enquiry',
  'Listing prices far above real transaction evidence',
  'Weak or thin comparable support',
  'Data-sparse locations where confidence is low',
  'Market conditions showing downward pressure',
];
const TrustFraud = () => (
  <Slide id="trust" dark>
    <Kicker n="06" track="Trust & Fraud Angle" dark/>
    <div className="tl-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,.9fr)', gap: 'clamp(28px,5vw,64px)', alignItems: 'center' }}>
      <div>
        <H dark>Detect misleading prices before money is at risk.</H>
        <Lead dark style={{ maxWidth: 560 }}>Mytanah shows the actual transacted price from open property data — so a bait listing priced to lure you can’t. It flags anomalies and weak evidence for review, human in the loop.</Lead>
        <div style={{ display: 'grid', gap: 12, marginTop: 28 }}>
          {FLAGS.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ color: C.earthLight, marginTop: 2, flexShrink: 0 }}><I.flag size={18}/></span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14.5, lineHeight: 1.5, color: 'rgba(220,215,201,.82)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
      {/* anomaly example card */}
      <div style={{ background: C.raised, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 30px 70px rgba(10,14,12,.4)' }}>
        <div style={{ background: 'rgba(166,50,40,.12)', borderBottom: `1px solid ${C.border}`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, fontWeight: 600, color: C.deep, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Mont Kiara · Condominium</div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid, whiteSpace: 'nowrap' }}>Kuala Lumpur · 1,140 sqft</div>
          </div>
          <RiskBadge label="Overpriced" size="sm"/>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 18 }}>
          <ValueRange lower={1650000} central={1820000} upper={1980000} listing={2380000}/>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(166,50,40,.08)', border: `1px solid ${C.down}40`, borderRadius: 10, padding: '12px 14px' }}>
            <span style={{ color: C.down, marginTop: 1 }}><I.flag size={16}/></span>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, lineHeight: 1.5, color: C.mid }}>
              Listing sits <strong style={{ color: C.down }}>+20% above</strong> the upper estimate with only 2 thin comps. Flagged for human review.
            </span>
          </div>
        </div>
      </div>
    </div>
  </Slide>
);

/* ===================================================================== */
/* 7 · WHO PAYS                                                           */
/* ===================================================================== */
const MODELS = [
  { Icon: I.building, who: 'Property platforms', body: 'API for listing trust scores and price-anomaly detection at scale.', price: 'Usage-based per listing checked' },
  { Icon: I.bank, who: 'Banks & lenders', body: 'SaaS dashboard for mortgage pre-screening and collateral monitoring.', price: 'Enterprise SaaS' },
  { Icon: I.user, who: 'Agencies & agents', body: 'Monthly dashboard for pricing listings and advising clients.', price: 'RM99 / mo · RM499+ agency' },
  { Icon: I.doc, who: 'Consumers', body: 'A paid property trust report before buying or negotiating.', price: 'RM19–RM49 / report' },
];
/* ===================================================================== */
/* 6B · TARGET AUDIENCE — who it's for                                     */
/* ===================================================================== */
const AUDIENCE = [
  { tier: 'Primary end users', tone: C.earth, items: [
    ['First-time homebuyers', 'Afraid of overpaying, scams and hidden risk.', 'Most emotional'],
    ['Home sellers', 'Price right instead of guessing from portal asks.'],
    ['Property investors', 'Fair value, downside risk, timing and rental ROI.'],
  ] },
  { tier: 'Best-paying customers', tone: C.up, items: [
    ['Property platforms', 'A listing trust-score API to flag weak prices.'],
    ['Banks & lenders', 'Fast collateral pre-screening before valuation.', 'Highest value'],
    ['Real estate agencies', 'Price listings and justify asks to clients.'],
    ['Valuation firms', 'Pre-screen and surface comparables faster.'],
  ] },
  { tier: 'Strategic / institutional', tone: C.stable, items: [
    ['Housing agencies', 'Affordability and market-risk monitoring.'],
    ['Urban planners', 'Market heat, overhang, district pressure.'],
    ['Developers', 'Where and when to launch, from sentiment & risk.'],
  ] },
];

const Audience = () => (
  <Slide id="audience" raised>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: C.earth, fontWeight: 600 }}>AUDIENCE</span>
      <span style={{ width: 28, height: 1, background: C.border }}/>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: C.mid }}>Who it's for</span>
    </div>
    <H>Everyone with money on the line.</H>
    <Lead>From the first-time buyer afraid of overpaying to the bank screening collateral — Mytanah serves the whole property decision chain across Malaysia.</Lead>
    <div className="tl-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 44, alignItems: 'start' }}>
      {AUDIENCE.map((col, ci) => (
        <Panel key={ci} accent={col.tone} style={{ display: 'flex', flexDirection: 'column' }}>
          <Eyebrow style={{ color: col.tone, marginBottom: 4 }}>{col.tier}</Eyebrow>
          {col.items.map(([name, desc, tag], i) => (
            <div key={i} style={{ paddingTop: 14, marginTop: 14, borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: C.deep }}>{name}</span>
                {tag && (
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: col.tone, background: col.tone + '1F', border: `1px solid ${col.tone}45`, padding: '2px 7px', borderRadius: 9999 }}>{tag}</span>
                )}
              </div>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, lineHeight: 1.5, color: C.mid, margin: '4px 0 0' }}>{desc}</p>
            </div>
          ))}
        </Panel>
      ))}
    </div>
  </Slide>
);

const WhoPays = () => (
  <Slide id="pricing">
    <Kicker n="07" track="Who Pays"/>
    <H>Trust infrastructure for the property economy.</H>
    <Lead>One trust engine, four buyers — from a single consumer report to platform-scale API checks.</Lead>
    <div className="tl-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginTop: 44 }}>
      {MODELS.map((m, i) => (
        <Panel key={i} style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 240 }}>
          <IconBox Icon={m.Icon}/>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, color: C.deep }}>{m.who}</div>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.55, color: C.mid, margin: 0, flex: 1 }}>{m.body}</p>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: C.earth, fontWeight: 600 }}>{m.price}</div>
        </Panel>
      ))}
    </div>
    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, fontStyle: 'italic', color: C.muted, marginTop: 20 }}>Pricing shown as indicative hackathon placeholders.</p>
  </Slide>
);

/* ===================================================================== */
/* 8 · COMPETITIVE ADVANTAGE                                              */
/* ===================================================================== */
const EDGE = ['Real transacted price, not asking', 'Bait-and-switch detection', 'Sentiment signal', 'Housing-cycle risk', 'Rental yield & ROI', 'Open data: nationwide Malaysia coverage'];
const Advantage = () => (
  <Slide id="advantage" raised>
    <Kicker n="08" track="Competitive Advantage"/>
    <div className="tl-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,.9fr) minmax(0,1.1fr)', gap: 'clamp(28px,5vw,64px)', alignItems: 'center' }}>
      <div>
        <H>More than an AVM.</H>
        <Lead>Most tools stop at an estimated price. Mytanah explains whether that price can be <em style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic' }}>trusted</em> — by stacking six signals into one verdict.</Lead>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, marginBottom: 14 }}>Typical AVM</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.mid }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: C.muted }}/>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14 }}>Estimated price only</span>
          </div>
        </div>
        <div style={{ background: C.deep, borderRadius: 14, padding: 22, color: C.cream }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.earthLight, marginBottom: 14 }}>Mytanah</div>
          <div style={{ display: 'grid', gap: 9 }}>
            {EDGE.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ color: C.up, flexShrink: 0 }}><I.check size={15}/></span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: 'rgba(220,215,201,.9)' }}>{e}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </Slide>
);

/* ===================================================================== */
/* 9 · COMPETITOR ANALYSIS                                                */
/* ===================================================================== */
const COMP_ROWS = [
  { label: 'AI-powered property valuation', vals: [true, false, false], highlight: true },
  { label: 'Real transaction data (NAPIC)', vals: [true, true, false] },
  { label: 'ROI & rental yield calculator', vals: [true, false, false], highlight: true },
  { label: 'Market cycle indicator', vals: [true, false, false], highlight: true },
  { label: 'Buyer sentiment index', vals: [true, false, false] },
  { label: 'Bait listing detection', vals: [true, false, false] },
  { label: 'Trust score verdict', vals: [true, false, false] },
];

const DIFFS = [
  {
    n: '01', Icon: I.brain,
    title: 'ML valuation, not just history',
    body: 'XGBoost, Random Forest & FT-Transformer trained on 400K+ real transactions produce a calibrated price estimate. PropertyGuru and ibiik surface past sales — you still have to decide what the number means.',
  },
  {
    n: '02', Icon: I.trend,
    title: 'ROI calculator with real rental data',
    body: 'Live AI-sourced rental comps convert estimated rent into gross yield and return on investment. No other Malaysian portal offers an end-to-end ROI view — they show listings, not returns.',
  },
  {
    n: '03', Icon: I.pulse,
    title: 'Market cycle & demand intelligence',
    body: "Mytanah reads WHERE Malaysia's property market sits in its cycle today — rising, stable, or falling — and overlays real-time buyer demand from Google Trends. Knowing the price is only half the picture; knowing the timing is the other half.",
  },
];

const CompetitorAnalysis = () => (
  <Slide id="competitors" dark>
    <Kicker n="09" track="Competitive Landscape" dark/>
    <H dark>What others show you. What Mytanah tells you.</H>
    <Lead dark style={{ maxWidth: 680 }}>
      Property portals show listings. Transaction tools show history. Mytanah is the only platform that fuses ML valuation, ROI intelligence, and market timing signals into a single trust verdict.
    </Lead>

    {/* 3 differentiators */}
    <div className="tl-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 44 }}>
      {DIFFS.map(({ n, Icon, title, body }, i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(220,215,201,.13)',
          borderTop: `3px solid ${C.earth}`, borderRadius: 14, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconBox Icon={Icon} dark/>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: C.earth, fontWeight: 600 }}>{n}</span>
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, color: C.cream }}>{title}</div>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, lineHeight: 1.65, color: 'rgba(220,215,201,.66)', margin: 0 }}>{body}</p>
        </div>
      ))}
    </div>

    {/* comparison table */}
    <div style={{ marginTop: 52 }}>
      {/* header */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', paddingBottom: 14, borderBottom: '1px solid rgba(220,215,201,.18)' }}>
        <div/>
        {[['Mytanah', true], ['PropertyGuru', false], ['ibiik', false]].map(([name, us], i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: us ? C.earthLight : 'rgba(220,215,201,.38)' }}>
            {name}
            {us && (
              <span style={{ marginLeft: 7, fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.up, background: 'rgba(45,122,79,.22)', border: `1px solid ${C.up}45`, padding: '2px 7px', borderRadius: 9999 }}>Us</span>
            )}
          </div>
        ))}
      </div>
      {/* rows */}
      {COMP_ROWS.map(({ label, vals, highlight }, ri) => (
        <div key={ri} style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
          padding: '14px 0',
          borderBottom: '1px solid rgba(220,215,201,.07)',
          background: highlight ? 'rgba(162,123,92,.07)' : 'transparent',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: highlight ? 0 : 0 }}>
            {highlight && <span style={{ width: 3, height: 18, borderRadius: 2, background: C.earth, flexShrink: 0 }}/>}
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13.5, color: highlight ? C.earthLight : 'rgba(220,215,201,.68)', fontWeight: highlight ? 600 : 400 }}>{label}</span>
          </div>
          {vals.map((v, vi) => (
            <div key={vi} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {v
                ? <span style={{ color: C.up }}><I.check size={17}/></span>
                : <span style={{ width: 14, height: 2, borderRadius: 1, background: 'rgba(220,215,201,.22)', display: 'block' }}/>
              }
            </div>
          ))}
        </div>
      ))}
    </div>
  </Slide>
);

/* ===================================================================== */
/* 10 · HACKATHON BUILD                                                    */
/* ===================================================================== */
const MVP = ['Landing page pitch deck', 'Property input form', 'Mock trust-score dashboard', 'Comparable transactions table', 'Sentiment, risk & ROI widgets', 'AI-generated explanation panel', 'B2B pricing section'];
const Build = () => (
  <Slide id="build" dark>
    <Kicker n="10" track="Hackathon Build" dark/>
    <div className="tl-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'clamp(28px,5vw,64px)' }}>
      <div>
        <H dark>What we can build this weekend.</H>
        <Lead dark>A working frontend prototype on mock data — every screen real, every number plausible, no backend required.</Lead>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {MVP.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(220,215,201,.12)', borderRadius: 10, padding: '13px 16px' }}>
            <span style={{ width: 24, height: 24, borderRadius: 9999, background: 'rgba(45,122,79,.2)', color: C.up, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><I.check size={14}/></span>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14.5, color: C.cream }}>{m}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 8, padding: '0 4px' }}>
          <span style={{ color: C.earthLight, marginTop: 1 }}><I.api size={17}/></span>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, lineHeight: 1.5, color: 'rgba(220,215,201,.6)' }}>
            Future: deepen the Exa-powered valuation, rental-yield and risk engine, with broader open-transaction coverage across Malaysia.
          </span>
        </div>
      </div>
    </div>
  </Slide>
);

/* ===================================================================== */
/* 10 · CLOSING                                                           */
/* ===================================================================== */
const Closing = () => (
  <section id="closing" data-screen-label="10 Closing" style={{
    background: 'radial-gradient(120% 100% at 50% 0%, #16201A 0%, #0f1612 50%, #0a0e0c 100%)',
    color: C.cream, padding: 'clamp(96px,14vh,160px) clamp(20px,6vw,88px) 0',
  }}>
    <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
      <Kicker n="11" track="Closing" dark/>
      <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 'clamp(36px,5.6vw,68px)', lineHeight: 1.05, letterSpacing: '-0.01em', margin: '0 auto', color: C.cream }}>
        Fairer property decisions<br/>start with <em style={{ fontStyle: 'italic', fontWeight: 400, color: C.earthLight }}>trust.</em>
      </h2>
      <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 'clamp(15px,1.6vw,18px)', lineHeight: 1.6, color: 'rgba(220,215,201,.72)', maxWidth: 620, margin: '24px auto 36px', textWrap: 'pretty' }}>
        Mytanah helps buyers, platforms, and lenders across Malaysia verify whether a property price is fair, explainable, and backed by real transaction evidence — before a high-stakes deal.
      </p>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href={APP_HREF} style={ctaPrimary}>Pilot the Trust Score API <I.arrow size={17}/></a>
        <a href="#hero-stage" style={ctaGhost}>Back to top</a>
      </div>
    </div>
    <footer style={{ maxWidth: MAXW, margin: '0 auto', marginTop: 'clamp(72px,10vh,120px)', padding: '28px 0', borderTop: '1px solid rgba(220,215,201,.14)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none" stroke={C.earth} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 16 L16 4 L29 16"/><path d="M6 14 L6 28 L26 28 L26 14"/><path d="M13 28 L13 19 L19 19 L19 28"/></svg>
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, color: C.cream, whiteSpace: 'nowrap' }}>Mytanah</span>
      </div>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: 'rgba(220,215,201,.45)' }}>
        Live valuation via web research (Exa Search) over open transaction data across Malaysia. Demo uses sample data.
      </span>
    </footer>
  </section>
);

/* ===================================================================== */
const TrustLensLanding = () => (
  <div style={{ position: 'relative' }}>
    <NavBar/>
    <ScrollHero/>
    <Problem/>
    <BaitSwitch/>
    <Solution/>
    <Demo/>
    <Engine/>
    <TrustFraud/>
    <Audience/>
    <WhoPays/>
    <Advantage/>
    <CompetitorAnalysis/>
    <Build/>
    <Closing/>
  </div>
);

Object.assign(window, { TrustLensLanding });
