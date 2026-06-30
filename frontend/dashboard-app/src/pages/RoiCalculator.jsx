import { useState, useMemo, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { C } from '@/lib/colors'
import { ScrollReveal } from '@/components/shared'
import { API } from '@/lib/api'
import {
  chartAreaGrad,
  chartAxisLine,
  chartAxisPointerLine,
  chartLegend,
  chartOpts,
  chartSplitLine,
  chartTooltip,
  chartValueAxisLabel,
  withChartBase,
} from '@/lib/chartTheme'

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatRM = (n) => 'RM ' + Number(n).toLocaleString('en-US')
const rmCompact = (n) => {
  if (n >= 1000000) return 'RM ' + (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return 'RM ' + Math.round(n / 1000) + 'k'
  return 'RM ' + Math.round(n)
}

// ── Constants ─────────────────────────────────────────────────────────────────

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
}

let ROI_UID = 0
const roiUid = () => (ROI_UID += 1)

// ── Pure calculation functions ────────────────────────────────────────────────

const roiClamp = (value, min, max) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

const roiNum = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const roiRentSearchLabel = (source) => {
  if (source.scheme) return source.scheme
  if (source.locationLabel && source.locationLabel !== 'Manual property estimate') return source.locationLabel
  return source.mukim || 'this area'
}

const roiRentSearchDetail = (source) => {
  const bits = [source.propertyType, source.district, source.state].filter(Boolean)
  return bits.join(' · ')
}

const roiInputValue = (value) => (roiNum(value, 0) === 0 ? '' : value)

const roiFmt = (value) => formatRM(Math.round(roiNum(value, 0)))

const roiMonthsLabel = (months) => {
  const m = Math.max(0, Math.round(roiNum(months, 0)))
  const y = Math.floor(m / 12)
  const r = m % 12
  if (!y) return `${r} mo`
  if (!r) return `${y} yr`
  return `${y} yr ${r} mo`
}

const roiYearsLabel = (yr) => (yr == null ? null : yr < 1 ? '< 1 yr' : `${yr.toFixed(1)} yr`)

const roiMonthlyPayment = (principal, annualRate, years) => {
  const p = Math.max(0, roiNum(principal, 0))
  const months = Math.max(1, Math.round(roiNum(years, 1) * 12))
  const rate = Math.max(0, roiNum(annualRate, 0)) / 100 / 12
  if (!p) return 0
  if (!rate) return p / months
  return p * rate / (1 - Math.pow(1 + rate, -months))
}

const roiBuildSchedule = ({ principal, annualRate, years, extraMonthly }) => {
  const start = Math.max(0, roiNum(principal, 0))
  const months = Math.max(1, Math.round(roiNum(years, 1) * 12))
  const rate = Math.max(0, roiNum(annualRate, 0)) / 100 / 12
  const scheduled = roiMonthlyPayment(start, annualRate, years)
  const extra = Math.max(0, roiNum(extraMonthly, 0))
  let balance = start
  let totalInterest = 0
  const points = [{ month: 0, balance: start, interest: 0 }]
  let month = 0
  const maxMonths = months + 1200

  while (balance > 0.01 && month < maxMonths) {
    month += 1
    const interest = balance * rate
    totalInterest += interest
    const due = Math.min(balance + interest, scheduled + extra)
    const principalPaid = Math.max(0, due - interest)
    balance = Math.max(0, balance - principalPaid)
    points.push({ month, balance, interest: totalInterest })
    if (!rate && scheduled + extra <= 0) break
  }

  return {
    points,
    months: month,
    monthly: scheduled,
    totalInterest,
    totalPaid: start + totalInterest,
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const RoiInput = ({ label, value, onChange, suffix, min, max, step = 1, placeholder = '0' }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C]">{label}</Label>
    <div className="relative">
      <Input
        type="number"
        value={roiInputValue(value)}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-[#DCD7C9] border-[#A27B5C]/25 text-[#2C3930] focus:border-[#A27B5C] focus:ring-[#A27B5C]/20 ${suffix ? 'pr-14' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#B0AA9E] pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  </div>
)

const RoiItemRow = ({ name, amount, onName, onAmount, onRemove, accent, namePlaceholder, amountPlaceholder }) => {
  const fieldCls = 'w-full bg-[#DCD7C9] border border-[#A27B5C]/25 text-[#2C3930] text-[13.5px] rounded-lg px-3 py-[9px] outline-none focus:border-[#A27B5C] focus:ring-2 focus:ring-[#A27B5C]/20'
  return (
    <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 118px 30px' }}>
      <input
        type="text"
        value={name}
        placeholder={namePlaceholder || 'Item name'}
        onChange={(e) => onName(e.target.value)}
        className={fieldCls}
      />
      <div className="relative">
        <input
          type="number"
          value={roiInputValue(amount)}
          min={0}
          step={100}
          placeholder={amountPlaceholder || '0'}
          onChange={(e) => onAmount(e.target.value)}
          className={`${fieldCls} pr-10 text-right`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#B0AA9E] pointer-events-none">RM</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="w-[30px] h-[30px] rounded-lg cursor-pointer bg-transparent flex items-center justify-center text-base leading-none"
        style={{ border: `1px solid ${accent || C.border}`, color: accent || C.mid }}
      >×</button>
    </div>
  )
}

const RoiMetric = ({ label, value, sub, accent }) => (
  <Card className="p-4 min-h-[94px]">
    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#A27B5C]">{label}</p>
    <p className="font-mono text-xl font-medium mt-2" style={{ color: accent || C.deep }}>{value}</p>
    {sub && <p className="text-xs text-[#5C7065] mt-1.5 leading-snug">{sub}</p>}
  </Card>
)

const RoiTimelineChart = ({ base, extra, principal, hasExtra }) => {
  const W = 920, H = 280, padL = 74, padR = 28, padTop = 24, padBot = 42
  const maxMonth = Math.max(
    1,
    base.points[base.points.length - 1]?.month || 0,
    extra.points[extra.points.length - 1]?.month || 0,
  )
  const maxAmount = Math.max(1, principal)
  const x = (month) => padL + (month / maxMonth) * (W - padL - padR)
  const y = (amount) => padTop + (1 - amount / maxAmount) * (H - padTop - padBot)
  const path = (points) => points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)} ${y(p.balance).toFixed(1)}`)
    .join(' ')
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxMonth * t))
  const amountTicks = [1, 0.75, 0.5, 0.25, 0].map((t) => Math.round(maxAmount * t))

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
          <>
            <line x1="16" x2="40" y1="25" y2="25" stroke={C.earth} strokeWidth="2.8"/>
            <text x="48" y="29" fontFamily="'DM Sans',sans-serif" fontSize="11" fill={C.mid}>with extra payment</text>
          </>
        ) : (
          <text x="16" y="29" fontFamily="'DM Sans',sans-serif" fontSize="11" fill={C.muted}>no extra payment added</text>
        )}
      </g>
    </svg>
  )
}

const RoiEarningsChart = ({ pts, breakEven, breakEvenValue, loanYears }) => {
  const option = useMemo(() => {
    if (!pts || !pts.length) return {}
    const maxT = pts[pts.length - 1].t
    const incomeData = pts.map(p => [p.t, Math.round(p.income)])
    const paidData = pts.map(p => [p.t, Math.round(p.paid)])
    const incGrad = chartAreaGrad(C.up, 0.26, 0)
    const sign = (v) => (v < 0 ? '−' : '') + rmCompact(Math.abs(v))
    return withChartBase({
      animationDuration: 1400,
      grid: { left: 8, right: 72, top: 28, bottom: 38, containLabel: true },
      legend: chartLegend({ top: 0, right: 0 }),
      tooltip: {
        trigger: 'axis', ...chartTooltip({ padding: [8, 10] }),
        axisPointer: chartAxisPointerLine,
        formatter: (ps) => {
          let s = `<div style="font-family:'JetBrains Mono',monospace;font-size:12px">Year ${Math.round(ps[0].value[0])}</div>`
          ps.forEach(p => { s += `<div style="margin-top:2px">${p.seriesName}: <b>${sign(p.value[1])}</b></div>` })
          const inc = ps.find(p => /Income/.test(p.seriesName))
          const dbt = ps.find(p => /Cost|Debt/.test(p.seriesName))
          if (inc && dbt) {
            const gap = inc.value[1] - dbt.value[1]
            s += `<div style="margin-top:3px;color:${gap >= 0 ? '#9ED9B0' : '#E6A6A0'}">${gap >= 0 ? 'Profit' : 'Shortfall'}: <b>${sign(gap)}</b></div>`
          }
          return s
        },
      },
      xAxis: {
        type: 'value', min: 0, max: maxT, name: 'years', nameLocation: 'middle', nameGap: 26,
        nameTextStyle: { color: C.mid, fontFamily: "'DM Sans',sans-serif", fontSize: 11 },
        axisLine: chartAxisLine, axisTick: { show: false },
        axisLabel: chartValueAxisLabel(),
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value', min: 0,
        axisLabel: { ...chartValueAxisLabel(), formatter: (v) => sign(v) },
        splitLine: chartSplitLine,
      },
      series: [
        {
          name: 'Income · rentals', type: 'line', smooth: true, showSymbol: false, data: incomeData,
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
        {
          name: 'Cost · interest + one-time', type: 'line', smooth: true, showSymbol: false, data: paidData,
          lineStyle: { color: C.down, width: 2, type: [6, 4] }, itemStyle: { color: C.down }, z: 2,
          endLabel: { show: true, distance: 6, formatter: (p) => sign(p.value[1]), color: C.down, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700 },
          markLine: loanYears != null ? {
            silent: true, symbol: 'none', lineStyle: { color: C.down, width: 1, type: [2, 4], opacity: 0.6 },
            label: { show: true, position: 'insideEndBottom', color: C.down, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, formatter: `loan cleared ${Math.round(loanYears)}y` },
            data: [{ xAxis: loanYears }],
          } : undefined,
        },
      ],
    })
  }, [pts, breakEven, breakEvenValue, loanYears])

  return <ReactECharts option={option} style={{ height: 300 }} opts={chartOpts} />
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RoiCalculator({ seed }) {
  const source = seed && Number(seed.propertyPrice) > 0 ? seed : ROI_DEFAULT_SEED
  const rentLabel = roiRentSearchLabel(source)
  const rentDetail = roiRentSearchDetail(source)
  const [price, setPrice] = useState(Math.round(source.propertyPrice))
  const [depositPct, setDepositPct] = useState(10)
  const [loanPct, setLoanPct] = useState(90)
  const [annualRate, setAnnualRate] = useState(4.2)
  const [years, setYears] = useState(30)
  const [extraMonthly, setExtraMonthly] = useState(0)
  const [costItems, setCostItems] = useState(() => [{ id: roiUid(), name: 'Furnishing', amount: 50000 }])
  const [rentalPrice, setRentalPrice] = useState(Math.max(0, Math.round(source.propertyPrice * 0.0035)))
  const [carparkRent, setCarparkRent] = useState(0)
  const [incomeItems, setIncomeItems] = useState([])
  const [rentEstimate, setRentEstimate] = useState(null)
  const [rentLoading, setRentLoading] = useState(false)
  const [rentError, setRentError] = useState(null)
  const [rentMode, setRentMode] = useState(source.mukim ? 'live' : 'manual')
  const fetchMarketRent = (forceRefresh = false) => {
    const { mukim, scheme, district, state, propertyType } = source
    if (!mukim || rentLoading) return
    setRentLoading(true)
    setRentError(null)
    setRentEstimate(null)
    API.rentComps({
      mukim,
      scheme,
      district,
      state,
      property_type: propertyType,
    }, { forceRefresh })
      .then(data => {
        setRentEstimate(data)
        const bestRent = data.median_rent_myr || data.avg_rent_myr
        if (bestRent && data.confidence !== 'none')
          setRentalPrice(Math.round(bestRent))
      })
      .catch(err => setRentError(err.message || 'Failed to fetch market rent'))
      .finally(() => { setRentLoading(false) })
  }

  useEffect(() => {
    if (seed && Number(seed.propertyPrice) > 0) {
      setPrice(Math.round(seed.propertyPrice))
      setRentalPrice(Math.max(0, Math.round(seed.propertyPrice * 0.0035)))
      setRentEstimate(null)
      setRentError(null)
      setRentMode(seed.mukim ? 'live' : 'manual')
    }
  }, [seed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rentMode === 'live' && source.mukim && !rentEstimate && !rentLoading && !rentError) {
      fetchMarketRent()
    }
  }, [rentMode, source.mukim, source.scheme, source.district, source.state, source.propertyType, rentEstimate, rentLoading, rentError]) // eslint-disable-line react-hooks/exhaustive-deps

  const safe = useMemo(() => {
    const p = roiClamp(price, 1, 100000000)
    const dep = roiClamp(depositPct, 0, 100)
    const loan = roiClamp(loanPct, 0, 100)
    const rate = roiClamp(annualRate, 0, 30)
    const yrs = roiClamp(years, 1, 40)
    const extra = Math.max(0, roiNum(extraMonthly, 0))
    return { p, dep, loan, rate, yrs, extra }
  }, [price, depositPct, loanPct, annualRate, years, extraMonthly])

  const oneTimeCost = useMemo(
    () => costItems.reduce((s, it) => s + Math.max(0, roiNum(it.amount, 0)), 0),
    [costItems],
  )
  const otherIncome = useMemo(
    () => incomeItems.reduce((s, it) => s + Math.max(0, roiNum(it.amount, 0)), 0),
    [incomeItems],
  )
  const monthlyIncome = Math.max(0, roiNum(rentalPrice, 0)) + Math.max(0, roiNum(carparkRent, 0)) + otherIncome

  const deposit = safe.p * safe.dep / 100
  const principal = safe.p * safe.loan / 100
  const baseSchedule = useMemo(() => (
    roiBuildSchedule({ principal, annualRate: safe.rate, years: safe.yrs, extraMonthly: 0 })
  ), [principal, safe.rate, safe.yrs])
  const extraSchedule = useMemo(() => (
    roiBuildSchedule({ principal, annualRate: safe.rate, years: safe.yrs, extraMonthly: safe.extra })
  ), [principal, safe.rate, safe.yrs, safe.extra])

  const roi = useMemo(() => {
    const M = baseSchedule.monthly
    const inc = monthlyIncome
    const furnishing = oneTimeCost
    const totalInterest = baseSchedule.totalInterest
    const loanYears = baseSchedule.months / 12
    const sched = baseSchedule.points
    const interestAtYear = (t) => {
      const idx = Math.min(Math.max(0, Math.round(t * 12)), sched.length - 1)
      return sched[idx] ? sched[idx].interest : totalInterest
    }

    const sunkTotal = furnishing + totalInterest
    const beApprox = inc > 0 ? sunkTotal / (inc * 12) : Infinity
    const tenureYears = Math.round(safe.yrs)
    const horizon = Math.max(tenureYears, Math.min(60, Math.ceil(Number.isFinite(beApprox) ? beApprox + 1 : tenureYears)))

    const pts = []
    let breakEven = null, breakEvenValue = null, prevDiff = null
    for (let t = 0; t <= horizon; t++) {
      const income = inc * 12 * t
      const paid = furnishing + interestAtYear(t)
      const diff = income - paid
      if (prevDiff !== null && breakEven === null && prevDiff <= 0 && diff >= 0) {
        const frac = diff === prevDiff ? 0 : (-prevDiff) / (diff - prevDiff)
        breakEven = (t - 1) + frac
        breakEvenValue = inc * 12 * breakEven
      }
      pts.push({ t, income, paid })
      prevDiff = diff
    }

    const netMonthly = inc - M
    const grossYield = safe.p ? (inc * 12 / safe.p) * 100 : 0
    const coverage = M ? (inc / M) * 100 : 0
    const finalProfit = inc * 12 * tenureYears - sunkTotal
    const investment = deposit + furnishing
    const roiOnInvestment = investment ? (finalProfit / investment) * 100 : 0
    const upfrontRecoverYears = inc > 0 ? investment / (inc * 12) : null
    return { pts, breakEven, breakEvenValue, netMonthly, grossYield, finalProfit, roiOnInvestment, installment: M, income: inc, coverage, totalInterest, furnishing, investment, upfrontRecoverYears, loanYears, tenureYears, horizon }
  }, [baseSchedule, deposit, monthlyIncome, oneTimeCost, safe.yrs, safe.p])

  const interestSaved = Math.max(0, baseSchedule.totalInterest - extraSchedule.totalInterest)
  const monthsSaved = Math.max(0, baseSchedule.months - extraSchedule.months)
  const location = source.locationLabel || ROI_DEFAULT_SEED.locationLabel
  const rangeText = source.rangeLow && source.rangeHigh
    ? `${rmCompact(source.rangeLow)} - ${rmCompact(source.rangeHigh)}`
    : 'editable estimate'

  const onDepositChange = (value) => {
    const dep = roiClamp(value, 0, 100)
    setDepositPct(dep)
    setLoanPct(+(100 - dep).toFixed(2))
  }
  const onLoanChange = (value) => {
    const loan = roiClamp(value, 0, 100)
    setLoanPct(loan)
    setDepositPct(+(100 - loan).toFixed(2))
  }

  const patchCost = (id, patch) => setCostItems((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const addCost = () => setCostItems((items) => [...items, { id: roiUid(), name: '', amount: 0 }])
  const removeCost = (id) => setCostItems((items) => items.filter((it) => it.id !== id))
  const patchIncome = (id, patch) => setIncomeItems((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const addIncome = () => setIncomeItems((items) => [...items, { id: roiUid(), name: '', amount: 0 }])
  const removeIncome = (id) => setIncomeItems((items) => items.filter((it) => it.id !== id))

  const sectionLabel = (color, text) => (
    <div className="flex items-center gap-2">
      <span className="w-[9px] h-[9px] rounded-[2px] inline-block flex-shrink-0" style={{ background: color }}/>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color }}>{text}</p>
    </div>
  )

  return (
    <div className="max-w-[1180px] mx-auto grid gap-[18px]">
      <style>{`
        @keyframes rentLookupSlide {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>

      <ScrollReveal>
        <div className="flex justify-between items-end gap-[18px] flex-wrap">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C]">ROI Calculator</p>
          <span className="font-display text-[30px] font-medium text-[#2C3930]">Portfolio cost &amp; income planner</span>
        </div>
        <div className="px-[13px] py-[9px] rounded-full bg-[#2C3930] text-[#DCD7C9] text-[12.5px] font-semibold">
          Malaysia loan model
        </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={60}>
        <Card className="px-[18px] py-[14px] flex justify-between items-center gap-[14px] flex-wrap">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C]">Exported valuation</p>
          <span className="font-display text-[20px] font-medium text-[#2C3930] mt-0.5 block">{location}</span>
        </div>
        <div className="text-right text-[12.5px] text-[#3F4F44] leading-relaxed">
          <div>{source.propertyType || 'Property type not selected'}</div>
          <div>{source.sourceModel || 'Manual input'} · {rangeText}</div>
        </div>
      </Card>
      </ScrollReveal>

      <ScrollReveal delay={100}>
      <div className="grid gap-[18px] items-stretch" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Income panel */}
        <Card className="p-[18px] border-t-4 border-t-[#2D7A4F]">
          <div className="flex justify-between items-baseline gap-2.5 flex-wrap">
            {sectionLabel(C.up, 'Income · what you earn')}
            <span className="font-mono font-medium text-[15px]" style={{ color: C.up }}>{roiFmt(monthlyIncome)} / mo</span>
          </div>
          <div className="grid gap-[14px] mt-[14px]">

            {/* Rental price section */}
            <div className="grid gap-2.5">
              <div className="flex justify-between items-center gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C]">Rental price</p>
                <Tabs value={rentMode} onValueChange={(v) => source.mukim ? setRentMode(v) : null}>
                  <TabsList className="bg-[#DCD7C9] border border-[#C8C3B8] h-auto p-0.5 gap-0.5">
                    <TabsTrigger
                      value="manual"
                      className="text-[11.5px] font-medium px-[11px] py-1 data-[state=active]:bg-[#2C3930] data-[state=active]:text-[#DCD7C9] data-[state=active]:shadow-sm"
                    >
                      Manual
                    </TabsTrigger>
                    <TabsTrigger
                      value="live"
                      disabled={!source.mukim}
                      title={!source.mukim ? 'Import a valuation with a location to unlock live market data' : `Live listings for ${rentLabel}`}
                      className="text-[11.5px] font-medium px-[11px] py-1 data-[state=active]:bg-[#2C3930] data-[state=active]:text-[#DCD7C9] data-[state=active]:shadow-sm disabled:opacity-40"
                    >
                      Live estimate
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="mt-0">
                    <div className="grid gap-1.5 mt-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
                      <div className="relative">
                        <Input
                          type="number"
                          value={roiInputValue(rentalPrice)}
                          min={0}
                          step={50}
                          placeholder="e.g. 1500"
                          onChange={(e) => setRentalPrice(Math.max(0, roiNum(e.target.value, 0)))}
                          aria-label="Monthly rental price in RM"
                          className="bg-[#DCD7C9] border-[#A27B5C]/25 text-[#2C3930] focus:border-[#A27B5C] focus:ring-[#A27B5C]/20 pr-16"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#B0AA9E] pointer-events-none">RM / mo</span>
                      </div>
                      {source.mukim ? (
                        <div className="text-[11.5px] leading-snug" style={{ color: C.light }}>
                          Enter your estimate, or switch to{' '}
                          <b className="cursor-pointer" style={{ color: C.earth }} onClick={() => setRentMode('live')}>
                            Live estimate
                          </b>{' '}
                          to auto-fill from {rentLabel} listings.
                        </div>
                      ) : (
                        <div className="text-[11.5px] leading-snug" style={{ color: C.muted }}>
                          Enter your expected monthly rental. Import a valuation to unlock live market data.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="live" className="mt-0">
                    <div className="grid gap-2 mt-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
                      {rentLoading && (
                        <div className="animate-in fade-in duration-200 p-[14px] rounded-[10px]" style={{ background: C.earthFaint, border: `1px solid ${C.border}` }}>
                          <div className="flex items-start gap-2.5 mb-2.5">
                            <span
                              className="inline-block flex-shrink-0 w-3.5 h-3.5 mt-0.5 rounded-full border-2 border-[#C8C3B8] border-t-[#A27B5C] animate-spin"
                              aria-hidden="true"
                            />
                            <span className="text-[12.5px] leading-snug" style={{ color: C.mid }} aria-live="polite" aria-atomic="true">
                              <span>Looking up listings online for </span>
                              <b style={{ color: C.deep }}>{rentLabel}</b>
                              <span>…</span>
                            </span>
                          </div>
                          <div
                            className="h-1 rounded-full overflow-hidden bg-[#C8C3B8]"
                            role="progressbar"
                            aria-busy="true"
                            aria-label="Fetching market rent data"
                          >
                            <div
                              className="h-full w-[38%] rounded-full bg-[#A27B5C]"
                              style={{ animation: 'rentLookupSlide 1.4s ease-in-out infinite' }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Error */}
                      {!rentLoading && rentError && (
                        <div className="animate-in fade-in duration-200 grid gap-2 p-[14px] rounded-[10px]" style={{ background: 'rgba(166,50,40,0.07)', border: '1px solid rgba(166,50,40,0.22)' }}>
                          <div className="text-[12.5px]" style={{ color: C.down }}>{rentError}</div>
                          <Button type="button" variant="outline" size="sm" onClick={() => fetchMarketRent(true)}
                            className="self-start border-[#A63228] text-[#A63228] bg-transparent hover:bg-[#A63228]/10">
                            Try again
                          </Button>
                        </div>
                      )}
                      {/* Success */}
                      {!rentLoading && !rentError && rentEstimate && rentEstimate.confidence !== 'none' && (
                        <div className="animate-in fade-in duration-200 grid gap-2">
                          <div className="p-[14px] rounded-[10px]" style={{ background: 'rgba(45,122,79,0.08)', border: '1px solid rgba(45,122,79,0.22)' }}>
                            <div className="flex justify-between items-center gap-2 flex-wrap">
                              <div className="text-[12px] font-semibold" style={{ color: C.up }}>
                                Market data · {rentLabel}
                              </div>
                              <span className="text-[10.5px] uppercase tracking-[0.08em]" style={{ color: C.mid }}>
                                {rentEstimate.confidence} · {rentEstimate.listing_count} listings
                              </span>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                              <span className="font-mono text-[22px] font-medium" style={{ color: C.up }}>
                                {roiFmt(rentEstimate.median_rent_myr || rentEstimate.avg_rent_myr)}
                              </span>
                              <span className="text-[12px]" style={{ color: C.mid }}>
                                / mo {rentEstimate.median_rent_myr ? 'median' : 'avg'}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px]" style={{ color: C.mid }}>
                              Range: {roiFmt(rentEstimate.min_rent_myr)} – {roiFmt(rentEstimate.max_rent_myr)} / mo
                            </div>
                          </div>
                          <div className="grid gap-1.5">
                            <div className="text-[11px]" style={{ color: C.mid }}>Applied — or type to override:</div>
                            <div className="relative">
                              <Input
                                type="number"
                                value={roiInputValue(rentalPrice)}
                                min={0}
                                step={50}
                                placeholder={String(Math.round(rentEstimate.median_rent_myr || rentEstimate.avg_rent_myr || 0))}
                                onChange={(e) => setRentalPrice(Math.max(0, roiNum(e.target.value, 0)))}
                                aria-label="Monthly rental — override market estimate"
                                className="bg-[#DCD7C9] border-[#A27B5C]/25 text-[#2C3930] focus:border-[#A27B5C] focus:ring-[#A27B5C]/20 pr-16"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#B0AA9E] pointer-events-none">RM / mo</span>
                            </div>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={fetchMarketRent}
                            className="self-start border-[#A27B5C] text-[#A27B5C] bg-transparent hover:bg-[#A27B5C]/10">
                            Refresh estimate
                          </Button>
                        </div>
                      )}
                      {/* No listings */}
                      {!rentLoading && !rentError && rentEstimate && rentEstimate.confidence === 'none' && (
                        <div className="animate-in fade-in duration-200 grid gap-2 p-[14px] rounded-[10px]" style={{ background: C.earthFaint, border: `1px solid ${C.border}` }}>
                          <div className="text-[12.5px]" style={{ color: C.mid }}>
                            No rental listings found for <b style={{ color: C.deep }}>{rentLabel}</b>. Switch to Manual to enter your own estimate.
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button type="button" variant="outline" size="sm" onClick={() => fetchMarketRent(true)}
                              className="border-[#A27B5C] text-[#A27B5C] bg-transparent hover:bg-[#A27B5C]/10">
                              Try again
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setRentMode('manual')}
                              className="border-[#A27B5C] text-[#A27B5C] bg-transparent hover:bg-[#A27B5C]/10">
                              Switch to Manual
                            </Button>
                          </div>
                        </div>
                      )}
                      {/* Initial fallback */}
                      {!rentLoading && !rentError && !rentEstimate && (
                        <div className="animate-in fade-in duration-200 flex items-center gap-2.5 p-[14px] rounded-[10px]" style={{ background: C.earthFaint, border: `1px solid ${C.border}` }}>
                          <span
                            className="inline-block flex-shrink-0 w-3.5 h-3.5 rounded-full border-2 border-[#C8C3B8] border-t-[#A27B5C] animate-spin"
                            aria-hidden="true"
                          />
                          <span className="text-[12.5px]" style={{ color: C.mid }}>
                            Preparing fetch for <b style={{ color: C.deep }}>{rentLabel}</b>…
                          </span>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Carpark rental */}
            <RoiInput label="Carpark rental" value={carparkRent} min={0} step={10}
              onChange={(v) => setCarparkRent(Math.max(0, roiNum(v, 0)))} suffix="RM"/>

            {/* Other monthly income */}
            <div className="grid gap-[9px] pt-1.5 border-t border-dashed" style={{ borderColor: C.border }}>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C] mb-0.5">Other monthly income (optional)</p>
              {incomeItems.length === 0 && (
                <div className="text-[12px]" style={{ color: C.muted }}>e.g. storeroom, signage, co-living top-up.</div>
              )}
              {incomeItems.map((it) => (
                <RoiItemRow key={it.id} name={it.name} amount={it.amount} accent={C.up}
                  namePlaceholder="e.g. Storeroom" amountPlaceholder="200"
                  onName={(v) => patchIncome(it.id, { name: v })}
                  onAmount={(v) => patchIncome(it.id, { amount: Math.max(0, roiNum(v, 0)) })}
                  onRemove={() => removeIncome(it.id)}/>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addIncome}
                className="self-start border-dashed border-[#2D7A4F] text-[#2D7A4F] bg-transparent hover:bg-[#2D7A4F]/10">
                + Add income item
              </Button>
              <div className="flex justify-between text-[12.5px]" style={{ color: C.mid }}>
                <span>Total monthly income</span>
                <span className="font-mono font-medium text-[13px]" style={{ color: C.up }}>{roiFmt(monthlyIncome)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Cost panel */}
        <Card className="p-[18px] border-t-4 border-t-[#A63228]">
          <div className="flex justify-between items-baseline gap-2.5 flex-wrap">
            {sectionLabel(C.down, 'Costs · what you pay')}
            <span className="font-mono font-medium text-[15px]" style={{ color: C.down }}>{roiFmt(deposit + oneTimeCost)} upfront</span>
          </div>
          <div className="grid gap-[14px] mt-[14px]">
            <RoiInput label="Property price" value={price} min={1} step={1000}
              onChange={(v) => setPrice(roiClamp(v, 1, 100000000))} suffix="RM"/>
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <RoiInput label="Deposit" value={depositPct} min={0} max={100} step={0.1}
                onChange={onDepositChange} suffix="%"/>
              <RoiInput label="Loan" value={loanPct} min={0} max={100} step={0.1}
                onChange={onLoanChange} suffix="%"/>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <RoiInput label="Interest" value={annualRate} min={0} max={30} step={0.01}
                onChange={(v) => setAnnualRate(roiClamp(v, 0, 30))} suffix="%"/>
              <RoiInput label="Years" value={years} min={1} max={40} step={1}
                onChange={(v) => setYears(roiClamp(v, 1, 40))}/>
            </div>
            {/* Extra payment */}
            <div className="grid gap-[7px] pt-3 mt-0.5 border-t border-dashed" style={{ borderColor: C.border }}>
              <RoiInput label="Extra monthly payment (optional)" value={extraMonthly} min={0} step={100}
                onChange={(v) => setExtraMonthly(Math.max(0, roiNum(v, 0)))} suffix="RM"/>
              <div className="text-[11.5px] leading-snug" style={{ color: C.muted }}>
                Paid <b style={{ color: C.mid }}>on top of</b> your monthly installment to clear the loan faster and cut total interest. Leave at <b style={{ color: C.mid }}>0</b> to keep the normal schedule.
              </div>
            </div>
            {/* One-time cost items */}
            <div className="grid gap-[9px] pt-1.5 border-t border-dashed" style={{ borderColor: C.border }}>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C] mb-0.5">One-time costs (furnishing, reno…)</p>
              {costItems.length === 0 && (
                <div className="text-[12px]" style={{ color: C.muted }}>No one-time costs added.</div>
              )}
              {costItems.map((it) => (
                <RoiItemRow key={it.id} name={it.name} amount={it.amount} accent={C.down}
                  namePlaceholder="e.g. Furnishing" amountPlaceholder="50000"
                  onName={(v) => patchCost(it.id, { name: v })}
                  onAmount={(v) => patchCost(it.id, { amount: Math.max(0, roiNum(v, 0)) })}
                  onRemove={() => removeCost(it.id)}/>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addCost}
                className="self-start border-dashed border-[#A63228] text-[#A63228] bg-transparent hover:bg-[#A63228]/10">
                + Add cost item
              </Button>
              <div className="flex justify-between text-[12.5px]" style={{ color: C.mid }}>
                <span>Total one-time cost</span>
                <span className="font-mono font-medium text-[13px]" style={{ color: C.down }}>{roiFmt(oneTimeCost)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
      </ScrollReveal>

      <ScrollReveal>
      <Card className="p-0 overflow-hidden">
        <div className="flex items-stretch">
          <div className="flex-1 px-[18px] py-[15px]" style={{ background: 'rgba(45,122,79,0.09)' }}>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: C.up }}>Income · monthly rental</p>
            <span className="font-mono text-[26px] font-medium block mt-1.5" style={{ color: C.up }}>{roiFmt(roi.income)}</span>
            <div className="mt-1 text-[11.5px]" style={{ color: C.mid }}>rent + carpark + other / mo</div>
          </div>
          <div className="flex items-center justify-center px-3" style={{ background: C.cream, fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 18, color: C.mid }}>vs</div>
          <div className="flex-1 px-[18px] py-[15px] text-right" style={{ background: 'rgba(166,50,40,0.08)' }}>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: C.down }}>Debt · monthly installment</p>
            <span className="font-mono text-[26px] font-medium block mt-1.5" style={{ color: C.down }}>{roiFmt(roi.installment)}</span>
            <div className="mt-1 text-[11.5px]" style={{ color: C.mid }}>what the bank charges you</div>
          </div>
        </div>
        <div className="px-[18px] py-2.5 flex justify-between gap-2.5 flex-wrap text-[12.5px]" style={{ borderTop: `1px solid ${C.border}`, color: C.mid }}>
          <span>Income covers <b style={{ color: roi.coverage >= 100 ? C.up : C.deep }}>{roi.coverage.toFixed(0)}%</b> of the installment</span>
          <span className="font-semibold" style={{ color: roi.netMonthly >= 0 ? C.up : C.down }}>
            {roi.netMonthly >= 0 ? `Net +${roiFmt(roi.netMonthly)} / mo in your pocket` : `You top up ${roiFmt(Math.abs(roi.netMonthly))} / mo`}
          </span>
        </div>
      </Card>
      </ScrollReveal>

      <ScrollReveal>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <RoiMetric label="Gross yield" value={`${roi.grossYield.toFixed(1)}%`} sub="annual income ÷ price"/>
        <RoiMetric
          label="Break-even"
          value={roi.breakEven != null ? roiYearsLabel(roi.breakEven) : `> ${roi.horizon} yr`}
          sub={roi.breakEven != null ? 'rent out-earns interest + costs' : 'rent too low to recover'}
          accent={roi.breakEven != null ? C.deep : C.down}
        />
        <RoiMetric
          label={`Net profit @ ${Math.round(safe.yrs)}yr`}
          value={`${roi.finalProfit < 0 ? '−' : ''}${roiFmt(Math.abs(roi.finalProfit))}`}
          sub={`ROI ${roi.roiOnInvestment >= 0 ? '+' : ''}${roi.roiOnInvestment.toFixed(0)}% on cash in`}
          accent={roi.finalProfit >= 0 ? C.up : C.down}
        />
      </div>
      </ScrollReveal>

      <ScrollReveal>
      <Card className="p-[18px]">
        <div className="flex justify-between items-baseline gap-3 flex-wrap">
          <div>
            <span className="font-display text-[18px] font-medium text-[#2C3930]">Income vs debt over time</span>
            <div className="mt-1 text-[12px]" style={{ color: C.mid }}>
              You repay the loan in full regardless, and the principal becomes equity you keep — so rent only has to out-earn the interest + one-time costs. Interest stops once the loan clears, so rent always catches up: that crossing is break-even.
            </div>
          </div>
          <span className="font-mono font-medium text-[13px]" style={{ color: roi.breakEven != null ? C.up : C.down }}>
            {roi.breakEven != null
              ? (roi.breakEven < 1 ? 'recovers within the first year' : `~${roi.breakEven.toFixed(1)} yr to recover`)
              : 'rent too low to recover'}
          </span>
        </div>
        <div className="mt-[14px]">
          <RoiEarningsChart pts={roi.pts} breakEven={roi.breakEven} breakEvenValue={roi.breakEvenValue} loanYears={roi.loanYears}/>
        </div>
      </Card>
      </ScrollReveal>

      <ScrollReveal>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <RoiMetric label="Deposit amount" value={roiFmt(deposit)} sub={`${safe.dep.toFixed(1)}% upfront`}/>
        <RoiMetric label="Loan principal" value={roiFmt(principal)} sub={`${safe.loan.toFixed(1)}% financed`}/>
        <RoiMetric label="One-time cost" value={roiFmt(oneTimeCost)} sub="furnishing, reno…" accent={oneTimeCost ? C.down : C.mid}/>
        <RoiMetric label="Monthly installment" value={roiFmt(baseSchedule.monthly)} sub="reducing balance"/>
        <RoiMetric label="Interest without extra" value={roiFmt(baseSchedule.totalInterest)} sub={roiMonthsLabel(baseSchedule.months)}/>
        <RoiMetric label="Interest with extra" value={roiFmt(extraSchedule.totalInterest)} sub={roiMonthsLabel(extraSchedule.months)} accent={safe.extra ? C.earth : C.deep}/>
      </div>
      </ScrollReveal>

      <ScrollReveal>
      <Card className="p-[18px]">
        <div className="flex justify-between items-baseline gap-3 flex-wrap">
          <div>
            <span className="font-display text-[18px] font-medium text-[#2C3930]">Loan timeline</span>
            <div className="mt-1 text-[12px]" style={{ color: C.mid }}>
              {safe.extra > 0
                ? 'Normal schedule compared with recurring extra monthly payment.'
                : 'Remaining loan principal over the tenure.'}
            </div>
          </div>
          {safe.extra > 0 && (
            <span className="font-mono font-medium text-[13px]" style={{ color: interestSaved ? C.up : C.mid }}>
              {roiFmt(interestSaved)} saved · {roiMonthsLabel(monthsSaved)} faster
            </span>
          )}
        </div>
        {safe.extra <= 0 && (
          <div className="mt-3 flex items-start gap-[11px] px-[15px] py-3 rounded-[10px]" style={{ background: `${C.earth}1F`, border: `1px solid ${C.earth}66` }}>
            <span className="flex-shrink-0 w-[21px] h-[21px] rounded-full flex items-center justify-center mt-0.5 text-[13px] font-bold italic"
              style={{ background: C.earth, color: C.cream }}>i</span>
            <span className="text-[13px] leading-relaxed" style={{ color: C.deep }}>
              <b>No extra monthly payment added.</b> The chart below shows your <b>normal schedule only</b>. Type an amount into <b>Extra monthly payment</b> (in the Costs panel) to see how much faster you'd clear the loan and how much interest you'd save.
            </span>
          </div>
        )}
        <div className="mt-[18px]">
          <RoiTimelineChart base={baseSchedule} extra={extraSchedule} principal={principal} hasExtra={safe.extra > 0}/>
        </div>
        <div className="mt-[14px] pt-[14px] flex justify-between gap-2.5 flex-wrap text-[12.5px]" style={{ borderTop: `1px solid ${C.border}`, color: C.mid }}>
          <span>Upfront cash <b style={{ color: C.deep }}>{roiFmt(roi.investment)}</b> (deposit + one-time) — real money out of pocket</span>
          <span className="font-semibold" style={{ color: roi.upfrontRecoverYears != null ? C.up : C.down }}>
            {roi.upfrontRecoverYears != null
              ? `Gross rental collects it back in ~${roi.upfrontRecoverYears.toFixed(1)} yr`
              : 'Add rental income to recover it'}
          </span>
        </div>
      </Card>
      </ScrollReveal>

    </div>
  )
}
