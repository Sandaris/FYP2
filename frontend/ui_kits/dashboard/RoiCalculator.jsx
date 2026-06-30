/* eslint-disable no-undef */
const { useState: roiUseState, useMemo: roiUseMemo, useEffect: roiUseEffect, useRef: roiUseRef } = React;

const ROI_DEFAULT_SEED = {
  propertyPrice: 500000,
  locationLabel: 'Bandar Utama, Petaling, Selangor',
  propertyType: 'Condominium/Apartment',
  sourceModel: 'Demo property input',
  rangeLow: 450000,
  rangeHigh: 650000,
  mukim: 'Damansara',
  scheme: 'Bandar Utama',
  district: 'Petaling',
  state: 'Selangor',
};

let ROI_UID = 0;
const roiUid = () => (ROI_UID += 1);

const roiClamp = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
};

const roiNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const roiRentSearchLabel = (source) => {
  if (source.scheme) return source.scheme;
  if (source.locationLabel && source.locationLabel !== 'Manual property estimate') return source.locationLabel;
  return source.mukim || 'this area';
};

const roiRentSearchDetail = (source) => {
  const bits = [source.propertyType, source.district, source.state].filter(Boolean);
  return bits.join(' · ');
};

// Render an empty box instead of a literal 0 so typing starts clean — the
// placeholder shows through and there's no leading 0 to delete first.
const roiInputValue = (value) => (roiNum(value, 0) === 0 ? '' : value);

const roiFmt = (value) => formatRM(Math.round(roiNum(value, 0)));

const roiMonthsLabel = (months) => {
  const m = Math.max(0, Math.round(roiNum(months, 0)));
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (!y) return `${r} mo`;
  if (!r) return `${y} yr`;
  return `${y} yr ${r} mo`;
};

// "< 1 yr" reads better than "0.0 yr" when rent clears the sunk cost almost at once
const roiYearsLabel = (yr) => (yr == null ? null : yr < 1 ? '< 1 yr' : `${yr.toFixed(1)} yr`);

const roiMonthlyPayment = (principal, annualRate, years) => {
  const p = Math.max(0, roiNum(principal, 0));
  const months = Math.max(1, Math.round(roiNum(years, 1) * 12));
  const rate = Math.max(0, roiNum(annualRate, 0)) / 100 / 12;
  if (!p) return 0;
  if (!rate) return p / months;
  return p * rate / (1 - Math.pow(1 + rate, -months));
};

const roiBuildSchedule = ({ principal, annualRate, years, extraMonthly }) => {
  const start = Math.max(0, roiNum(principal, 0));
  const months = Math.max(1, Math.round(roiNum(years, 1) * 12));
  const rate = Math.max(0, roiNum(annualRate, 0)) / 100 / 12;
  const scheduled = roiMonthlyPayment(start, annualRate, years);
  const extra = Math.max(0, roiNum(extraMonthly, 0));
  let balance = start;
  let totalInterest = 0;
  const points = [{ month: 0, balance: start, interest: 0 }];
  let month = 0;
  const maxMonths = months + 1200;

  while (balance > 0.01 && month < maxMonths) {
    month += 1;
    const interest = balance * rate;
    totalInterest += interest;
    const due = Math.min(balance + interest, scheduled + extra);
    const principalPaid = Math.max(0, due - interest);
    balance = Math.max(0, balance - principalPaid);
    points.push({ month, balance, interest: totalInterest });
    if (!rate && scheduled + extra <= 0) break;
  }

  return {
    points,
    months: month,
    monthly: scheduled,
    totalInterest,
    totalPaid: start + totalInterest,
  };
};

const RoiInput = ({ label, value, onChange, suffix, min, max, step = 1, placeholder = '0' }) => (
  <label style={{ display: 'block' }}>
    <Eyebrow style={{ marginBottom: 7 }}>{label}</Eyebrow>
    <div style={{ position: 'relative' }}>
      <input type="number" value={roiInputValue(value)} min={min} max={max} step={step} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', background: C.cream, border: `1px solid ${C.earth}40`,
          color: C.deep, fontFamily: "'DM Sans',sans-serif", fontSize: 14,
          borderRadius: 8, padding: suffix ? '11px 44px 11px 12px' : '11px 12px',
          outline: 'none',
        }}/>
      {suffix && (
        <span style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.muted,
          pointerEvents: 'none',
        }}>{suffix}</span>
      )}
    </div>
  </label>
);

/* One editable [name][amount] line — used for both one-time costs (furnishing,
   reno…) and extra monthly income. accent tints the remove control. */
const RoiItemRow = ({ name, amount, onName, onAmount, onRemove, accent, namePlaceholder, amountPlaceholder }) => {
  const field = {
    width: '100%', background: C.cream, border: `1px solid ${C.earth}40`,
    color: C.deep, fontFamily: "'DM Sans',sans-serif", fontSize: 13.5,
    borderRadius: 8, padding: '9px 12px', outline: 'none',
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 118px 30px', gap: 8, alignItems: 'center' }}>
      <input type="text" value={name} placeholder={namePlaceholder || 'Item name'}
        onChange={(e) => onName(e.target.value)} style={field}/>
      <div style={{ position: 'relative' }}>
        <input type="number" value={roiInputValue(amount)} min={0} step={100} placeholder={amountPlaceholder || '0'}
          onChange={(e) => onAmount(e.target.value)}
          style={{ ...field, padding: '9px 38px 9px 12px', textAlign: 'right' }}/>
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.muted, pointerEvents: 'none',
        }}>RM</span>
      </div>
      <button type="button" onClick={onRemove} aria-label="Remove"
        style={{
          width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
          border: `1px solid ${accent || C.border}`, background: 'transparent',
          color: accent || C.mid, fontSize: 16, lineHeight: 1, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
    </div>
  );
};

const RoiMetric = ({ label, value, sub, accent }) => (
  <Card style={{ padding: 16, minHeight: 94 }}>
    <Eyebrow style={{ fontSize: 10 }}>{label}</Eyebrow>
    <div style={{ marginTop: 8 }}>
      <Mono size={20} color={accent || C.deep}>{value}</Mono>
    </div>
    {sub && (
      <div style={{
        marginTop: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 11.5,
        color: C.mid, lineHeight: 1.35,
      }}>{sub}</div>
    )}
  </Card>
);

const RoiTimelineChart = ({ base, extra, principal, hasExtra }) => {
  const W = 920, H = 280, padL = 74, padR = 28, padTop = 24, padBot = 42;
  const maxMonth = Math.max(
    1,
    base.points[base.points.length - 1]?.month || 0,
    extra.points[extra.points.length - 1]?.month || 0,
  );
  const maxAmount = Math.max(1, principal);
  const x = (month) => padL + (month / maxMonth) * (W - padL - padR);
  const y = (amount) => padTop + (1 - amount / maxAmount) * (H - padTop - padBot);
  const path = (points) => points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)} ${y(p.balance).toFixed(1)}`)
    .join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxMonth * t));
  const amountTicks = [1, 0.75, 0.5, 0.25, 0].map((t) => Math.round(maxAmount * t));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <rect x={padL} y={padTop} width={W - padL - padR} height={H - padTop - padBot}
        fill={C.cream} stroke={C.border} rx="8"/>
      {amountTicks.map((a) => (
        <g key={'a' + a}>
          <line x1={padL} x2={W - padR} y1={y(a)} y2={y(a)} stroke={C.border} strokeDasharray="4 6"/>
          <text x={padL - 10} y={y(a) + 4} textAnchor="end"
            fontFamily="'JetBrains Mono',monospace" fontSize="10" fill={C.muted}>{rmCompact(a)}</text>
        </g>
      ))}
      {ticks.map((m) => (
        <g key={'m' + m}>
          <line x1={x(m)} x2={x(m)} y1={padTop} y2={H - padBot} stroke={C.border} strokeOpacity="0.55"/>
          <text x={x(m)} y={H - 14} textAnchor="middle"
            fontFamily="'DM Sans',sans-serif" fontSize="11" fill={C.mid}>{Math.round(m / 12)} yr</text>
        </g>
      ))}
      {hasExtra && (
        <path d={path(extra.points)} fill="none" stroke={C.earth} strokeWidth="2.8"
          strokeLinecap="round" strokeLinejoin="round"/>
      )}
      <path d={path(base.points)} fill="none" stroke={C.light} strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={x(base.months)} cy={y(0)} r="4" fill={C.light}/>
      {hasExtra && <circle cx={x(extra.months)} cy={y(0)} r="4" fill={C.earth}/>}
      <text x={padL} y={14} fontFamily="'DM Sans',sans-serif" fontSize="11" fill={C.mid}>
        Remaining principal over time
      </text>
      {!hasExtra && (
        <text x={(padL + W - padR) / 2} y={padTop + 24} textAnchor="middle"
          fontFamily="'DM Sans',sans-serif" fontSize="12" fill={C.muted}>
          No extra monthly payment inserted — following the normal schedule.
        </text>
      )}
      <g transform={`translate(${W - 248} 8)`}>
        <rect width="220" height="34" rx="17" fill={C.raised} stroke={C.border}/>
        <line x1="16" x2="40" y1="12" y2="12" stroke={C.light} strokeWidth="2.4"/>
        <text x="48" y="16" fontFamily="'DM Sans',sans-serif" fontSize="11" fill={C.mid}>normal schedule</text>
        {hasExtra ? (
          <React.Fragment>
            <line x1="16" x2="40" y1="25" y2="25" stroke={C.earth} strokeWidth="2.8"/>
            <text x="48" y="29" fontFamily="'DM Sans',sans-serif" fontSize="11" fill={C.mid}>with extra payment</text>
          </React.Fragment>
        ) : (
          <text x="16" y="29" fontFamily="'DM Sans',sans-serif" fontSize="11" fill={C.muted}>no extra payment added</text>
        )}
      </g>
    </svg>
  );
};

/* ECharts: cumulative rental Income vs Debt outlay (loan + interest +
   furnishing) over the years. Both rise; where Income overtakes Debt is the
   break-even — when the portfolio starts to profit. */
const RoiEarningsChart = ({ pts, breakEven, breakEvenValue, loanYears }) => {
  const elRef = React.useRef(null);
  const chartRef = React.useRef(null);
  React.useEffect(() => {
    if (!window.echarts || !elRef.current) return undefined;
    const chart = window.echarts.init(elRef.current, null, { renderer: 'canvas' });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(elRef.current);
    const t = setTimeout(() => chart.resize(), 300);
    return () => { clearTimeout(t); ro.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);
  React.useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !window.echarts || !pts || !pts.length) return;
    const maxT = pts[pts.length - 1].t;
    const incomeData = pts.map(p => [p.t, Math.round(p.income)]);
    const paidData = pts.map(p => [p.t, Math.round(p.paid)]);
    const incGrad = new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: 'rgba(45,122,79,0.26)' }, { offset: 1, color: 'rgba(45,122,79,0)' },
    ]);
    const sign = (v) => (v < 0 ? '−' : '') + rmCompact(Math.abs(v));
    chart.setOption({
      animationDuration: 1400,
      backgroundColor: 'transparent',
      grid: { left: 8, right: 72, top: 28, bottom: 38, containLabel: true },
      legend: { top: 0, right: 0, textStyle: { color: C.mid, fontFamily: "'DM Sans',sans-serif", fontSize: 11 }, itemWidth: 18, itemHeight: 10 },
      tooltip: {
        trigger: 'axis', backgroundColor: C.deep, borderColor: C.deep, padding: [8, 10],
        textStyle: { color: C.cream, fontFamily: "'DM Sans',sans-serif", fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: C.earth, width: 1, type: [3, 4] } },
        formatter: (ps) => {
          let s = `<div style="font-family:'JetBrains Mono',monospace;font-size:12px">Year ${Math.round(ps[0].value[0])}</div>`;
          ps.forEach(p => { s += `<div style="margin-top:2px">${p.seriesName}: <b>${sign(p.value[1])}</b></div>`; });
          const inc = ps.find(p => /Income/.test(p.seriesName));
          const dbt = ps.find(p => /Cost|Debt/.test(p.seriesName));
          if (inc && dbt) { const gap = inc.value[1] - dbt.value[1]; s += `<div style="margin-top:3px;color:${gap >= 0 ? '#9ED9B0' : '#E6A6A0'}">${gap >= 0 ? 'Profit' : 'Shortfall'}: <b>${sign(gap)}</b></div>`; }
          return s;
        },
      },
      xAxis: {
        type: 'value', min: 0, max: maxT, name: 'years', nameLocation: 'middle', nameGap: 26,
        nameTextStyle: { color: C.mid, fontFamily: "'DM Sans',sans-serif", fontSize: 11 },
        axisLine: { lineStyle: { color: C.border } }, axisTick: { show: false },
        axisLabel: { color: C.mid, fontFamily: "'JetBrains Mono',monospace", fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value', min: 0,
        axisLabel: { color: C.mid, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, formatter: (v) => sign(v) },
        splitLine: { lineStyle: { color: C.border, type: [2, 5] } },
      },
      series: [
        { name: 'Income · rentals', type: 'line', smooth: true, showSymbol: false, data: incomeData,
          lineStyle: { color: C.up, width: 2.8 }, itemStyle: { color: C.up }, areaStyle: { color: incGrad }, z: 3,
          emphasis: { focus: 'series' },
          endLabel: { show: true, distance: 6, formatter: (p) => sign(p.value[1]), color: C.up, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700 },
          markLine: breakEven != null ? {
            silent: true, symbol: 'none', lineStyle: { color: C.deep, width: 1.2, type: [4, 4] },
            label: { show: true, position: 'insideEndTop', color: C.deep, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, formatter: breakEven < 1 ? 'break-even <1y' : `break-even ${breakEven.toFixed(1)}y` },
            data: [{ xAxis: breakEven }],
          } : undefined,
          markPoint: breakEven != null ? {
            symbol: 'pin', symbolSize: 44, symbolOffset: [0, -2], itemStyle: { color: C.up },
            label: { show: true, formatter: breakEven < 1 ? '<1y' : `${breakEven.toFixed(1)}y`, color: C.cream, fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 700 },
            data: [{ coord: [breakEven, Math.round(breakEvenValue || 0)] }],
          } : undefined,
        },
        { name: 'Cost · interest + one-time', type: 'line', smooth: true, showSymbol: false, data: paidData,
          lineStyle: { color: C.down, width: 2, type: [6, 4] }, itemStyle: { color: C.down }, z: 2,
          endLabel: { show: true, distance: 6, formatter: (p) => sign(p.value[1]), color: C.down, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700 },
          markLine: loanYears != null ? {
            silent: true, symbol: 'none', lineStyle: { color: C.down, width: 1, type: [2, 4], opacity: 0.6 },
            label: { show: true, position: 'insideEndBottom', color: C.down, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, formatter: `loan cleared ${Math.round(loanYears)}y` },
            data: [{ xAxis: loanYears }],
          } : undefined,
        },
      ],
    }, true);
  }, [pts, breakEven, breakEvenValue, loanYears]);
  return <div ref={elRef} style={{ width: '100%', height: 300 }}/>;
};

const RoiCalculator = ({ seed }) => {
  const source = seed && Number(seed.propertyPrice) > 0 ? seed : ROI_DEFAULT_SEED;
  const rentLabel = roiRentSearchLabel(source);
  const rentDetail = roiRentSearchDetail(source);
  const [price, setPrice] = roiUseState(Math.round(source.propertyPrice));
  const [depositPct, setDepositPct] = roiUseState(10);
  const [loanPct, setLoanPct] = roiUseState(90);
  const [annualRate, setAnnualRate] = roiUseState(4.2);
  const [years, setYears] = roiUseState(30);
  const [extraMonthly, setExtraMonthly] = roiUseState(0);
  // one-time costs that fold into the portfolio outlay (furnishing, reno, legal…)
  const [costItems, setCostItems] = roiUseState(() => [{ id: roiUid(), name: 'Furnishing', amount: 50000 }]);
  // income side
  const [rentalPrice, setRentalPrice] = roiUseState(Math.max(0, Math.round(source.propertyPrice * 0.0035)));
  const [carparkRent, setCarparkRent] = roiUseState(0);
  const [incomeItems, setIncomeItems] = roiUseState([]);
  const [rentEstimate, setRentEstimate] = roiUseState(null);
  const [rentLoading, setRentLoading] = roiUseState(false);
  const [rentError, setRentError] = roiUseState(null);
  const [rentMode, setRentMode] = roiUseState(source.mukim ? 'live' : 'manual');
  const [progressVal, setProgressVal] = roiUseState(null);
  const progressIntervalRef = roiUseRef(null);

  const startProgress = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgressVal(0);
    let val = 0;
    progressIntervalRef.current = setInterval(() => {
      // Decelerating fill: fast early, crawls near 85%
      const remaining = 85 - val;
      val = Math.min(85, val + Math.max(0.4, remaining * 0.1));
      setProgressVal(Math.round(val));
      if (val >= 84.9) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }, 80);
  };

  const completeProgress = () => {
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
    setProgressVal(100);
    setTimeout(() => setProgressVal(null), 460);
  };

  const fetchMarketRent = () => {
    const { mukim, scheme, district, state, propertyType } = source;
    if (!mukim || rentLoading) return;
    setRentLoading(true);
    setRentError(null);
    startProgress();
    window.API.rentComps({
      mukim,
      scheme,
      district,
      state,
      property_type: propertyType,
    })
      .then(data => {
        setRentEstimate(data);
        const bestRent = data.median_rent_myr || data.avg_rent_myr;
        if (bestRent && data.confidence !== 'none')
          setRentalPrice(Math.round(bestRent));
      })
      .catch(err => setRentError(err.message || 'Failed to fetch market rent'))
      .finally(() => { setRentLoading(false); completeProgress(); });
  };

  roiUseEffect(() => {
    if (seed && Number(seed.propertyPrice) > 0) {
      setPrice(Math.round(seed.propertyPrice));
      setRentalPrice(Math.max(0, Math.round(seed.propertyPrice * 0.0035)));
      setRentEstimate(null);
      setRentError(null);
      setRentMode(seed.mukim ? 'live' : 'manual');
    }
  }, [seed]);

  // Auto-fetch when entering live mode (or on first mount when mukim is set)
  roiUseEffect(() => {
    if (rentMode === 'live' && source.mukim && !rentEstimate && !rentLoading && !rentError) {
      fetchMarketRent();
    }
  }, [rentMode, source.mukim, source.scheme, source.district, source.state, source.propertyType, rentEstimate, rentLoading, rentError]);

  const safe = roiUseMemo(() => {
    const p = roiClamp(price, 1, 100000000);
    const dep = roiClamp(depositPct, 0, 100);
    const loan = roiClamp(loanPct, 0, 100);
    const rate = roiClamp(annualRate, 0, 30);
    const yrs = roiClamp(years, 1, 40);
    const extra = Math.max(0, roiNum(extraMonthly, 0));
    return { p, dep, loan, rate, yrs, extra };
  }, [price, depositPct, loanPct, annualRate, years, extraMonthly]);

  const oneTimeCost = roiUseMemo(
    () => costItems.reduce((s, it) => s + Math.max(0, roiNum(it.amount, 0)), 0),
    [costItems],
  );
  const otherIncome = roiUseMemo(
    () => incomeItems.reduce((s, it) => s + Math.max(0, roiNum(it.amount, 0)), 0),
    [incomeItems],
  );
  const monthlyIncome = Math.max(0, roiNum(rentalPrice, 0)) + Math.max(0, roiNum(carparkRent, 0)) + otherIncome;

  const deposit = safe.p * safe.dep / 100;
  const principal = safe.p * safe.loan / 100;
  const baseSchedule = roiUseMemo(() => (
    roiBuildSchedule({ principal, annualRate: safe.rate, years: safe.yrs, extraMonthly: 0 })
  ), [principal, safe.rate, safe.yrs]);
  const extraSchedule = roiUseMemo(() => (
    roiBuildSchedule({ principal, annualRate: safe.rate, years: safe.yrs, extraMonthly: safe.extra })
  ), [principal, safe.rate, safe.yrs, safe.extra]);

  // Income vs debt over time — the honest break-even.
  //
  // The owner pays the FULL installment every month no matter how short the
  // rent falls, so the loan always clears by the end of its tenure. The
  // principal you repay turns into equity — you own the unit, it isn't lost —
  // so rent doesn't have to out-earn the whole loan, only the money that never
  // comes back: the INTEREST plus the one-time furnishing/reno. Interest stops
  // the moment the loan is cleared while rent keeps stacking, so there is
  // ALWAYS a year the rent catches up. That crossing is the real break-even.
  const roi = roiUseMemo(() => {
    const M = baseSchedule.monthly;
    const inc = monthlyIncome;
    const furnishing = oneTimeCost;
    const totalInterest = baseSchedule.totalInterest;
    const loanYears = baseSchedule.months / 12;
    const sched = baseSchedule.points;                 // [{ month, balance, interest(cumulative) }]
    // cumulative interest paid by year t — plateaus at totalInterest once cleared
    const interestAtYear = (t) => {
      const idx = Math.min(Math.max(0, Math.round(t * 12)), sched.length - 1);
      return sched[idx] ? sched[idx].interest : totalInterest;
    };

    const sunkTotal = furnishing + totalInterest;       // the plateau rent must beat
    const beApprox = inc > 0 ? sunkTotal / (inc * 12) : Infinity;
    const tenureYears = Math.round(safe.yrs);
    // stretch the horizon past the loan tenure so a slow break-even still shows
    const horizon = Math.max(tenureYears, Math.min(60, Math.ceil(Number.isFinite(beApprox) ? beApprox + 1 : tenureYears)));

    const pts = [];
    let breakEven = null, breakEvenValue = null, prevDiff = null;
    for (let t = 0; t <= horizon; t++) {
      const income = inc * 12 * t;                       // cumulative rentals
      const paid = furnishing + interestAtYear(t);       // sunk cost: one-time + interest
      const diff = income - paid;
      // `<= 0` (not `< 0`) so the case where rent already covers the sunk cost
      // from the very first year — income and cost both start at 0 with no
      // one-time cost — is caught as break-even ~0 instead of being missed and
      // mislabelled "rent too low to recover".
      if (prevDiff !== null && breakEven === null && prevDiff <= 0 && diff >= 0) {
        const frac = diff === prevDiff ? 0 : (-prevDiff) / (diff - prevDiff);
        breakEven = (t - 1) + frac;
        breakEvenValue = inc * 12 * breakEven;           // income == cost at the crossing
      }
      pts.push({ t, income, paid });
      prevDiff = diff;
    }

    const netMonthly = inc - M;
    const grossYield = safe.p ? (inc * 12 / safe.p) * 100 : 0;
    const coverage = M ? (inc / M) * 100 : 0;
    const finalProfit = inc * 12 * tenureYears - sunkTotal; // rent out-earned by the time the loan clears
    const investment = deposit + furnishing;                // upfront CASH (deposit + one-time)
    const roiOnInvestment = investment ? (finalProfit / investment) * 100 : 0;
    // how long gross rental takes to add up to the upfront cash you put down
    const upfrontRecoverYears = inc > 0 ? investment / (inc * 12) : null;
    return { pts, breakEven, breakEvenValue, netMonthly, grossYield, finalProfit, roiOnInvestment, installment: M, income: inc, coverage, totalInterest, furnishing, investment, upfrontRecoverYears, loanYears, tenureYears, horizon };
  }, [baseSchedule, deposit, monthlyIncome, oneTimeCost, safe.yrs, safe.p]);

  const interestSaved = Math.max(0, baseSchedule.totalInterest - extraSchedule.totalInterest);
  const monthsSaved = Math.max(0, baseSchedule.months - extraSchedule.months);
  const location = source.locationLabel || ROI_DEFAULT_SEED.locationLabel;
  const rangeText = source.rangeLow && source.rangeHigh
    ? `${rmCompact(source.rangeLow)} - ${rmCompact(source.rangeHigh)}`
    : 'editable estimate';

  const onDepositChange = (value) => {
    const dep = roiClamp(value, 0, 100);
    setDepositPct(dep);
    setLoanPct(+(100 - dep).toFixed(2));
  };
  const onLoanChange = (value) => {
    const loan = roiClamp(value, 0, 100);
    setLoanPct(loan);
    setDepositPct(+(100 - loan).toFixed(2));
  };

  // line-item helpers shared by the cost + income panels
  const patchCost = (id, patch) => setCostItems((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addCost = () => setCostItems((items) => [...items, { id: roiUid(), name: '', amount: 0 }]);
  const removeCost = (id) => setCostItems((items) => items.filter((it) => it.id !== id));
  const patchIncome = (id, patch) => setIncomeItems((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addIncome = () => setIncomeItems((items) => [...items, { id: roiUid(), name: '', amount: 0 }]);
  const removeIncome = (id) => setIncomeItems((items) => items.filter((it) => it.id !== id));

  const addBtnStyle = (accent) => ({
    marginTop: 4, alignSelf: 'start', cursor: 'pointer',
    border: `1px dashed ${accent}`, background: 'transparent', color: accent,
    fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600,
    borderRadius: 8, padding: '7px 12px',
  });
  const sectionLabel = (color, text) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }}/>
      <Eyebrow style={{ color }}>{text}</Eyebrow>
    </div>
  );

  return (
    <div className="roi-calc" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <Eyebrow>ROI Calculator</Eyebrow>
          <Display size={30} weight={500}>Portfolio cost &amp; income planner</Display>
        </div>
        <div style={{
          padding: '9px 13px', borderRadius: 9999, background: C.deep, color: C.cream,
          fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, fontWeight: 600,
        }}>Malaysia loan model</div>
      </div>

      {/* exported valuation context strip */}
      <Card style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <Eyebrow>Exported valuation</Eyebrow>
          <Display size={20} weight={500} style={{ marginTop: 2 }}>{location}</Display>
        </div>
        <div style={{ textAlign: 'right', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid, lineHeight: 1.5 }}>
          <div>{source.propertyType || 'Property type not selected'}</div>
          <div>{source.sourceModel || 'Manual input'} · {rangeText}</div>
        </div>
      </Card>

      {/* INCOME  vs  COST — two panels side by side (income left, cost right) */}
      <div className="roi-panels" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'stretch' }}>
        {/* ── INCOME panel (green-coded) ── */}
        <Card style={{ padding: 18, borderTop: `3px solid ${C.up}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            {sectionLabel(C.up, 'Income · what you earn')}
            <Mono size={15} color={C.up}>{roiFmt(monthlyIncome)} / mo</Mono>
          </div>
          <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
            {/* ── Rental price: Manual or Live market estimate ── */}
            <div style={{ display: 'grid', gap: 10 }}>
              {/* Mode header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Eyebrow>Rental price</Eyebrow>
                <div className="roi-mode-tabs" role="group" aria-label="Rental price source">
                  <button type="button"
                    className={`roi-mode-tab${rentMode === 'manual' ? ' roi-mode-tab--active' : ''}`}
                    onClick={() => setRentMode('manual')}
                    aria-pressed={rentMode === 'manual'}>
                    Manual
                  </button>
                  <button type="button"
                    className={`roi-mode-tab${rentMode === 'live' ? ' roi-mode-tab--active' : ''}${!source.mukim ? ' roi-mode-tab--locked' : ''}`}
                    onClick={() => source.mukim && setRentMode('live')}
                    disabled={!source.mukim}
                    aria-pressed={rentMode === 'live'}
                    title={!source.mukim ? 'Import a valuation with a location to unlock live market data' : `Live listings for ${rentLabel}`}>
                    Live estimate
                  </button>
                </div>
              </div>

              {/* Manual mode */}
              {rentMode === 'manual' && (
                <div className="roi-mode-panel" style={{ display: 'grid', gap: 6 }}>
                  <div className="roi-input-wrap">
                    <input type="number" value={roiInputValue(rentalPrice)} min={0} step={50}
                      placeholder="e.g. 1500" className="roi-input"
                      onChange={(e) => setRentalPrice(Math.max(0, roiNum(e.target.value, 0)))}
                      aria-label="Monthly rental price in RM"/>
                    <span className="roi-input-suffix">RM / mo</span>
                  </div>
                  {source.mukim ? (
                    <div style={{ fontSize: 11.5, color: C.light, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4 }}>
                      Enter your estimate, or switch to{' '}
                      <b style={{ color: C.earth, cursor: 'pointer' }} onClick={() => setRentMode('live')}>
                        Live estimate
                      </b>{' '}
                      to auto-fill from {rentLabel} listings.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: C.muted, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.4 }}>
                      Enter your expected monthly rental. Import a valuation to unlock live market data.
                    </div>
                  )}
                </div>
              )}

              {/* Live mode */}
              {rentMode === 'live' && (
                <div className="roi-mode-panel" style={{ display: 'grid', gap: 8 }}>
                  {/* Progress bar — replaces spinner; shows during load and brief completion flash */}
                  {(rentLoading || progressVal !== null) && (
                    <div className="roi-live-state" style={{ padding: '12px 14px', borderRadius: 10, background: C.earthFaint, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, lineHeight: 1.4,
                          color: progressVal === 100 ? C.up : C.mid, transition: 'color 300ms ease-out' }}>
                          {progressVal === 100
                            ? <React.Fragment>Loaded — listings for <b style={{ color: C.up }}>{rentLabel}</b></React.Fragment>
                            : <React.Fragment>Looking up listings for <b style={{ color: C.deep }}>{rentLabel}</b>…</React.Fragment>
                          }
                        </span>
                        {rentDetail && progressVal !== 100 && (
                          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.light, marginTop: 4, display: 'block' }}>
                            {rentDetail}
                          </span>
                        )}
                        <span className={`roi-progress-pct${progressVal === 100 ? ' roi-progress-pct--complete' : ''}`}
                          aria-live="polite" aria-atomic="true">
                          {progressVal ?? 0}%
                        </span>
                      </div>
                      <div className="roi-progress-track"
                        role="progressbar" aria-valuenow={progressVal ?? 0} aria-valuemin={0} aria-valuemax={100}
                        aria-label="Fetching market rent data">
                        <div className={`roi-progress-fill${progressVal === 100 ? ' roi-progress-fill--complete' : ''}`}
                          style={{ transform: `scaleX(${(progressVal ?? 0) / 100})` }}/>
                      </div>
                    </div>
                  )}
                  {/* Error */}
                  {!rentLoading && rentError && (
                    <div className="roi-live-state" style={{ display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 10, background: 'rgba(166,50,40,0.07)', border: '1px solid rgba(166,50,40,0.22)' }}>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.down }}>{rentError}</div>
                      <button type="button" onClick={fetchMarketRent}
                        style={{ alignSelf: 'start', cursor: 'pointer', border: `1px solid ${C.down}`, background: 'transparent', color: C.down, fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, borderRadius: 7, padding: '6px 12px', transition: 'background 160ms' }}>
                        Try again
                      </button>
                    </div>
                  )}
                  {/* Success — data with confidence */}
                  {!rentLoading && !rentError && rentEstimate && rentEstimate.confidence !== 'none' && (
                    <div className="roi-live-state" style={{ display: 'grid', gap: 8 }}>
                      <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(45,122,79,0.08)', border: '1px solid rgba(45,122,79,0.22)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.up, fontWeight: 600 }}>
                            Market data · {rentLabel}
                          </div>
                          {rentDetail && (
                            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.mid, marginTop: 2 }}>
                              {rentDetail}
                            </div>
                          )}
                          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10.5, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {rentEstimate.confidence} · {rentEstimate.listing_count} listings
                          </span>
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <Mono size={22} color={C.up}>{roiFmt(rentEstimate.median_rent_myr || rentEstimate.avg_rent_myr)}</Mono>
                          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.mid }}>
                            / mo {rentEstimate.median_rent_myr ? 'median' : 'avg'}
                          </span>
                        </div>
                        <div style={{ marginTop: 3, fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.mid }}>
                          Range: {roiFmt(rentEstimate.min_rent_myr)} – {roiFmt(rentEstimate.max_rent_myr)} / mo
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 5 }}>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: C.mid }}>Applied — or type to override:</div>
                        <div className="roi-input-wrap">
                          <input type="number" value={roiInputValue(rentalPrice)} min={0} step={50}
                            placeholder={String(Math.round(rentEstimate.median_rent_myr || rentEstimate.avg_rent_myr || 0))}
                            className="roi-input"
                            onChange={(e) => setRentalPrice(Math.max(0, roiNum(e.target.value, 0)))}
                            aria-label="Monthly rental — override market estimate"/>
                          <span className="roi-input-suffix">RM / mo</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* No listings found */}
                  {!rentLoading && !rentError && rentEstimate && rentEstimate.confidence === 'none' && (
                    <div className="roi-live-state" style={{ display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 10, background: C.earthFaint, border: `1px solid ${C.border}` }}>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid }}>
                        No rental listings found for <b style={{ color: C.deep }}>{rentLabel}</b>. Switch to Manual to enter your own estimate.
                      </div>
                      <button type="button" onClick={() => setRentMode('manual')}
                        style={{ alignSelf: 'start', cursor: 'pointer', border: `1px solid ${C.earth}`, background: 'transparent', color: C.earth, fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, borderRadius: 7, padding: '6px 12px', transition: 'background 160ms' }}>
                        Switch to Manual
                      </button>
                    </div>
                  )}
                  {/* Initial — effect not yet fired (sub-frame fallback) */}
                  {!rentLoading && !rentError && !rentEstimate && progressVal === null && (
                    <div className="roi-live-state" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: C.earthFaint, border: `1px solid ${C.border}` }}>
                      <span className="roi-spinner" aria-hidden="true"/>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid }}>
                        Preparing fetch for <b style={{ color: C.deep }}>{rentLabel}</b>…
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Carpark rental — always visible */}
            <RoiInput label="Carpark rental" value={carparkRent} min={0} step={10}
              onChange={(v) => setCarparkRent(Math.max(0, roiNum(v, 0)))} suffix="RM"/>

            {/* dynamic extra monthly income line items */}
            <div style={{ display: 'grid', gap: 9, paddingTop: 6, borderTop: `1px dashed ${C.border}` }}>
              <Eyebrow style={{ marginBottom: 2 }}>Other monthly income (optional)</Eyebrow>
              {incomeItems.length === 0 && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.muted }}>e.g. storeroom, signage, co-living top-up.</div>
              )}
              {incomeItems.map((it) => (
                <RoiItemRow key={it.id} name={it.name} amount={it.amount} accent={C.up}
                  namePlaceholder="e.g. Storeroom" amountPlaceholder="200"
                  onName={(v) => patchIncome(it.id, { name: v })}
                  onAmount={(v) => patchIncome(it.id, { amount: Math.max(0, roiNum(v, 0)) })}
                  onRemove={() => removeIncome(it.id)}/>
              ))}
              <button type="button" onClick={addIncome} style={addBtnStyle(C.up)}>+ Add income item</button>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid }}>
                <span>Total monthly income</span>
                <Mono size={13} color={C.up}>{roiFmt(monthlyIncome)}</Mono>
              </div>
            </div>
          </div>
        </Card>

        {/* ── COST panel (red-coded) ── */}
        <Card style={{ padding: 18, borderTop: `3px solid ${C.down}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            {sectionLabel(C.down, 'Costs · what you pay')}
            <Mono size={15} color={C.down}>{roiFmt(deposit + oneTimeCost)} upfront</Mono>
          </div>
          <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
            <RoiInput label="Property price" value={price} min={1} step={1000}
              onChange={(v) => setPrice(roiClamp(v, 1, 100000000))} suffix="RM"/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <RoiInput label="Deposit" value={depositPct} min={0} max={100} step={0.1}
                onChange={onDepositChange} suffix="%"/>
              <RoiInput label="Loan" value={loanPct} min={0} max={100} step={0.1}
                onChange={onLoanChange} suffix="%"/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <RoiInput label="Interest" value={annualRate} min={0} max={30} step={0.01}
                onChange={(v) => setAnnualRate(roiClamp(v, 0, 30))} suffix="%"/>
              <RoiInput label="Years" value={years} min={1} max={40} step={1}
                onChange={(v) => setYears(roiClamp(v, 1, 40))}/>
            </div>
            {/* extra payment — set apart from the core loan terms: optional, paid
               on top of the installment to clear the loan faster */}
            <div style={{ display: 'grid', gap: 7, paddingTop: 12, marginTop: 2, borderTop: `1px dashed ${C.border}` }}>
              <RoiInput label="Extra monthly payment (optional)" value={extraMonthly} min={0} step={100}
                onChange={(v) => setExtraMonthly(Math.max(0, roiNum(v, 0)))} suffix="RM"/>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.muted, lineHeight: 1.45 }}>
                Paid <b style={{ color: C.mid }}>on top of</b> your monthly installment to clear the loan faster and cut total interest. Leave at <b style={{ color: C.mid }}>0</b> to keep the normal schedule.
              </div>
            </div>

            {/* dynamic one-time cost line items */}
            <div style={{ display: 'grid', gap: 9, paddingTop: 6, borderTop: `1px dashed ${C.border}` }}>
              <Eyebrow style={{ marginBottom: 2 }}>One-time costs (furnishing, reno…)</Eyebrow>
              {costItems.length === 0 && (
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.muted }}>No one-time costs added.</div>
              )}
              {costItems.map((it) => (
                <RoiItemRow key={it.id} name={it.name} amount={it.amount} accent={C.down}
                  namePlaceholder="e.g. Furnishing" amountPlaceholder="50000"
                  onName={(v) => patchCost(it.id, { name: v })}
                  onAmount={(v) => patchCost(it.id, { amount: Math.max(0, roiNum(v, 0)) })}
                  onRemove={() => removeCost(it.id)}/>
              ))}
              <button type="button" onClick={addCost} style={addBtnStyle(C.down)}>+ Add cost item</button>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid }}>
                <span>Total one-time cost</span>
                <Mono size={13} color={C.down}>{roiFmt(oneTimeCost)}</Mono>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* monthly Income vs Debt summary — the headline A-vs-B comparison */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ flex: 1, padding: '15px 18px', background: 'rgba(45,122,79,0.09)' }}>
            <Eyebrow style={{ color: C.up }}>Income · monthly rental</Eyebrow>
            <Mono size={26} color={C.up} style={{ display: 'block', marginTop: 6 }}>{roiFmt(roi.income)}</Mono>
            <div style={{ marginTop: 4, fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid }}>rent + carpark + other / mo</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', background: C.cream, fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 18, color: C.mid }}>vs</div>
          <div style={{ flex: 1, padding: '15px 18px', background: 'rgba(166,50,40,0.08)', textAlign: 'right' }}>
            <Eyebrow style={{ color: C.down }}>Debt · monthly installment</Eyebrow>
            <Mono size={26} color={C.down} style={{ display: 'block', marginTop: 6 }}>{roiFmt(roi.installment)}</Mono>
            <div style={{ marginTop: 4, fontFamily: "'DM Sans',sans-serif", fontSize: 11.5, color: C.mid }}>what the bank charges you</div>
          </div>
        </div>
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid }}>
          <span>Income covers <b style={{ color: roi.coverage >= 100 ? C.up : C.deep }}>{roi.coverage.toFixed(0)}%</b> of the installment</span>
          <span style={{ color: roi.netMonthly >= 0 ? C.up : C.down, fontWeight: 600 }}>
            {roi.netMonthly >= 0 ? `Net +${roiFmt(roi.netMonthly)} / mo in your pocket` : `You top up ${roiFmt(Math.abs(roi.netMonthly))} / mo`}
          </span>
        </div>
      </Card>

      <div className="roi-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <RoiMetric label="Gross yield" value={`${roi.grossYield.toFixed(1)}%`} sub="annual income ÷ price"/>
        <RoiMetric label="Break-even" value={roi.breakEven != null ? roiYearsLabel(roi.breakEven) : `> ${roi.horizon} yr`}
          sub={roi.breakEven != null ? 'rent out-earns interest + costs' : 'rent too low to recover'} accent={roi.breakEven != null ? C.deep : C.down}/>
        <RoiMetric label={`Net profit @ ${Math.round(safe.yrs)}yr`} value={`${roi.finalProfit < 0 ? '−' : ''}${roiFmt(Math.abs(roi.finalProfit))}`}
          sub={`ROI ${roi.roiOnInvestment >= 0 ? '+' : ''}${roi.roiOnInvestment.toFixed(0)}% on cash in`} accent={roi.finalProfit >= 0 ? C.up : C.down}/>
      </div>

      <Card style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Display size={18} weight={500}>Income vs debt over time</Display>
            <div style={{ marginTop: 4, fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.mid }}>
              You repay the loan in full regardless, and the principal becomes equity you keep — so rent only has to out-earn the interest + one-time costs. Interest stops once the loan clears, so rent always catches up: that crossing is break-even.
            </div>
          </div>
          <Mono size={13} color={roi.breakEven != null ? C.up : C.down}>
            {roi.breakEven != null
              ? (roi.breakEven < 1 ? 'recovers within the first year' : `~${roi.breakEven.toFixed(1)} yr to recover`)
              : 'rent too low to recover'}
          </Mono>
        </div>
        <div style={{ marginTop: 14 }}>
          <RoiEarningsChart pts={roi.pts} breakEven={roi.breakEven} breakEvenValue={roi.breakEvenValue} loanYears={roi.loanYears}/>
        </div>
      </Card>

      <div className="roi-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <RoiMetric label="Deposit amount" value={roiFmt(deposit)} sub={`${safe.dep.toFixed(1)}% upfront`}/>
        <RoiMetric label="Loan principal" value={roiFmt(principal)} sub={`${safe.loan.toFixed(1)}% financed`}/>
        <RoiMetric label="One-time cost" value={roiFmt(oneTimeCost)} sub="furnishing, reno…" accent={oneTimeCost ? C.down : C.mid}/>
        <RoiMetric label="Monthly installment" value={roiFmt(baseSchedule.monthly)} sub="reducing balance"/>
        <RoiMetric label="Interest without extra" value={roiFmt(baseSchedule.totalInterest)}
          sub={roiMonthsLabel(baseSchedule.months)}/>
        <RoiMetric label="Interest with extra" value={roiFmt(extraSchedule.totalInterest)}
          sub={roiMonthsLabel(extraSchedule.months)} accent={safe.extra ? C.earth : C.deep}/>
      </div>

      <Card style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Display size={18} weight={500}>Loan timeline</Display>
            <div style={{ marginTop: 4, fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: C.mid }}>
              {safe.extra > 0
                ? 'Normal schedule compared with recurring extra monthly payment.'
                : 'Remaining loan principal over the tenure.'}
            </div>
          </div>
          {safe.extra > 0 && (
            <Mono size={13} color={interestSaved ? C.up : C.mid}>{roiFmt(interestSaved)} saved · {roiMonthsLabel(monthsSaved)} faster</Mono>
          )}
        </div>
        {safe.extra <= 0 && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 15px', borderRadius: 10, background: `${C.earth}1F`, border: `1px solid ${C.earth}66` }}>
            <span style={{ flexShrink: 0, width: 21, height: 21, borderRadius: '50%', background: C.earth, color: C.cream, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>i</span>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: C.deep, lineHeight: 1.5 }}>
              <b>No extra monthly payment added.</b> The chart below shows your <b>normal schedule only</b>. Type an amount into <b>Extra monthly payment</b> (in the Costs panel) to see how much faster you'd clear the loan and how much interest you'd save.
            </span>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <RoiTimelineChart base={baseSchedule} extra={extraSchedule} principal={principal} hasExtra={safe.extra > 0}/>
        </div>
        {/* upfront cash payback — the deposit + one-time is real money out; how
            long gross rental takes to add back up to it */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, color: C.mid }}>
          <span>Upfront cash <b style={{ color: C.deep }}>{roiFmt(roi.investment)}</b> (deposit + one-time) — real money out of pocket</span>
          <span style={{ color: roi.upfrontRecoverYears != null ? C.up : C.down, fontWeight: 600 }}>
            {roi.upfrontRecoverYears != null
              ? `Gross rental collects it back in ~${roi.upfrontRecoverYears.toFixed(1)} yr`
              : 'Add rental income to recover it'}
          </span>
        </div>
      </Card>

      <style>{`
        @media (max-width: 880px) {
          .roi-panels { grid-template-columns: 1fr !important; }
          .roi-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .roi-stats { grid-template-columns: 1fr !important; }
        }

        /* ── Rental mode tab toggle ── */
        .roi-mode-tabs {
          display: flex;
          gap: 2px;
          background: #DCD7C9;
          border: 1px solid #C8C3B8;
          border-radius: 8px;
          padding: 2px;
          flex-shrink: 0;
        }
        .roi-mode-tab {
          padding: 4px 11px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #3F4F44;
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px;
          font-weight: 500;
          cursor: pointer;
          transition: background 140ms, color 140ms, box-shadow 140ms;
          white-space: nowrap;
          line-height: 1.6;
        }
        .roi-mode-tab:hover:not(:disabled):not(.roi-mode-tab--active) {
          background: rgba(44, 57, 48, 0.09);
        }
        .roi-mode-tab--active {
          background: #2C3930;
          color: #DCD7C9;
          box-shadow: 0 1px 3px rgba(44, 57, 48, 0.2);
        }
        .roi-mode-tab--locked,
        .roi-mode-tab:disabled {
          opacity: 0.38;
          cursor: not-allowed;
        }
        .roi-mode-tab:focus-visible {
          outline: 2px solid #A27B5C;
          outline-offset: 1px;
        }

        /* ── Rental input with inline suffix ── */
        .roi-input-wrap { position: relative; }
        .roi-input {
          width: 100%;
          background: #DCD7C9;
          border: 1px solid rgba(162, 123, 92, 0.28);
          color: #2C3930;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          border-radius: 8px;
          padding: 11px 68px 11px 12px;
          outline: none;
          transition: border-color 160ms, box-shadow 160ms;
          box-sizing: border-box;
          -moz-appearance: textfield;
        }
        .roi-input::-webkit-inner-spin-button,
        .roi-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .roi-input:focus {
          border-color: #A27B5C;
          box-shadow: 0 0 0 3px rgba(162, 123, 92, 0.16);
        }
        .roi-input-suffix {
          position: absolute;
          right: 11px;
          top: 50%;
          transform: translateY(-50%);
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px;
          color: #B0AA9E;
          pointer-events: none;
          white-space: nowrap;
        }

        /* ── Focus ring for existing RoiInput fields ── */
        .roi-calc input[type=number]:focus {
          outline: none;
          border-color: #A27B5C !important;
          box-shadow: 0 0 0 3px rgba(162, 123, 92, 0.16) !important;
        }

        /* ── CSS spinner (fallback only) ── */
        @keyframes roi-spin { to { transform: rotate(360deg); } }
        .roi-spinner {
          display: inline-block;
          flex-shrink: 0;
          width: 14px;
          height: 14px;
          border: 2px solid #C8C3B8;
          border-top-color: #A27B5C;
          border-radius: 50%;
          animation: roi-spin 0.65s linear infinite;
        }

        /* ── Page entrance ── */
        @keyframes roi-enter {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .roi-calc {
          animation: roi-enter 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* ── Mode panel content fade-in on tab switch ── */
        @keyframes roi-panel-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .roi-mode-panel {
          animation: roi-panel-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* ── Live mode state card fade-in ── */
        .roi-live-state {
          animation: roi-panel-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* ── Fetch progress bar ── */
        .roi-progress-track {
          height: 4px;
          background: #C8C3B8;
          border-radius: 2px;
          overflow: hidden;
        }
        .roi-progress-fill {
          height: 100%;
          width: 100%;
          background: #A27B5C;
          border-radius: 2px;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 80ms linear;
        }
        .roi-progress-fill--complete {
          background: #2D7A4F;
          transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), background 280ms ease-out;
        }
        .roi-progress-pct {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          font-weight: 500;
          color: #A27B5C;
          min-width: 34px;
          text-align: right;
          flex-shrink: 0;
          transition: color 280ms ease-out;
        }
        .roi-progress-pct--complete {
          color: #2D7A4F;
        }

        /* ── Reduced motion overrides ── */
        @media (prefers-reduced-motion: reduce) {
          .roi-calc { animation: none; }
          .roi-mode-panel { animation: none; }
          .roi-live-state { animation: none; }
          .roi-spinner { animation: none; border-top-color: #C8C3B8; opacity: 0.5; }
          .roi-mode-tab { transition: none; }
          .roi-input { transition: none; }
          .roi-progress-fill { transition: none; }
          .roi-progress-pct { transition: none; }
        }
      `}</style>
    </div>
  );
};

Object.assign(window, { RoiCalculator });
