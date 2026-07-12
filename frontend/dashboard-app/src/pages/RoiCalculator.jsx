import { useState, useMemo, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Slider } from '@/components/ui/slider'
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

const ROI_STRATEGY_COLORS = [C.earth, C.up, C.down, C.stable]
const ROI_MAX_STRATEGIES = ROI_STRATEGY_COLORS.length

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
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#3F4F44] pointer-events-none">
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
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#3F4F44] pointer-events-none">RM</span>
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

const RoiExtraPaymentRow = ({ index, amount, color, max, onAmount, onRemove, canRemove }) => {
  const sliderMax = Math.max(max, amount)
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-[9px] h-[9px] rounded-full flex-shrink-0" style={{ background: color }}/>
          <span className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: C.earth }}>
            Strategy {index + 1}
          </span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove strategy"
            className="w-[22px] h-[22px] rounded-md cursor-pointer bg-transparent flex items-center justify-center text-[13px] leading-none"
            style={{ border: `1px solid ${C.border}`, color: C.mid }}
          >×</button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative w-[130px] flex-shrink-0">
          <input
            type="number"
            value={roiInputValue(amount)}
            min={0}
            step={50}
            placeholder="0"
            onChange={(e) => onAmount(e.target.value)}
            className="w-full bg-[#DCD7C9] border border-[#A27B5C]/25 text-[#2C3930] text-[13.5px] rounded-lg pl-3 pr-9 py-[9px] outline-none focus:border-[#A27B5C] focus:ring-2 focus:ring-[#A27B5C]/20"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] text-[#3F4F44] pointer-events-none">RM</span>
        </div>
        <Slider
          value={[Math.min(amount, sliderMax)]}
          max={sliderMax}
          step={50}
          color={color}
          onValueChange={([v]) => onAmount(v)}
          className="flex-1"
          aria-label={`Strategy ${index + 1} extra monthly payment`}
        />
      </div>
    </div>
  )
}

const RoiSavingsHighlight = ({ results }) => {
  if (!results.length) return null
  const cols = Math.min(results.length, 3)
  return (
    <div className="mt-[14px] grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {results.map((r) => (
        <div key={r.id} className="rounded-[12px] px-[16px] py-[13px]" style={{ background: `${r.color}17`, border: `1px solid ${r.color}55` }}>
          <div className="flex items-center gap-1.5">
            <span className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ background: r.color }}/>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: r.color }}>
              +{roiFmt(r.amount)} / mo
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-[22px] font-semibold" style={{ color: C.deep }}>{roiFmt(r.interestSaved)}</span>
            <span className="text-[11.5px]" style={{ color: C.mid }}>saved</span>
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: C.mid }}>
            loan cleared <b style={{ color: C.deep }}>{roiMonthsLabel(r.monthsSaved)}</b> faster
          </div>
        </div>
      ))}
    </div>
  )
}

const RoiMetric = ({ label, value, sub, accent, tooltip }) => {
  const body = (
    <>
      <p
        className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#A27B5C] w-fit"
        style={tooltip ? { textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: C.muted, textUnderlineOffset: 4 } : undefined}
      >
        {label}
      </p>
      <p className="font-mono text-xl font-medium mt-2" style={{ color: accent || C.deep }}>{value}</p>
      {sub && <p className="text-xs text-[#3F4F44] mt-1.5 leading-snug">{sub}</p>}
    </>
  )

  if (!tooltip) {
    return <Card className="p-4 min-h-[94px]">{body}</Card>
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="p-4 min-h-[94px] cursor-help">{body}</Card>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-[12.5px] leading-snug">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const RoiTimelineChart = ({ base, extras, principal }) => {
  const active = useMemo(() => extras.filter((e) => e.amount > 0), [extras])

  const option = useMemo(() => {
    const maxMonth = Math.max(
      1,
      base.points[base.points.length - 1]?.month || 0,
      ...active.map((e) => e.schedule.points[e.schedule.points.length - 1]?.month || 0),
    )
    const maxAmount = Math.max(1, principal) * 1.03

    // Pad each series to a flat 0-balance tail so the line (and tooltip) reads
    // cleanly past the month a loan is actually paid off.
    const toSeriesData = (points) => {
      const data = points.map((p) => [p.month, Math.round(p.balance)])
      const last = points[points.length - 1]
      if (last && last.month < maxMonth) data.push([maxMonth, 0])
      return data
    }

    const baseSeries = {
      name: 'Normal schedule',
      type: 'line', smooth: false, showSymbol: false, data: toSeriesData(base.points),
      lineStyle: { color: C.light, width: 2.4 }, itemStyle: { color: C.light }, z: 2,
      emphasis: { focus: 'series' },
      markPoint: {
        symbol: 'circle', symbolSize: 9, itemStyle: { color: C.light, borderColor: C.cream, borderWidth: 1.5 },
        label: { show: false }, data: [{ coord: [base.months, 0] }],
      },
    }
    const extraSeries = active.map((e) => ({
      name: `+${roiFmt(e.amount)} / mo`,
      type: 'line', smooth: false, showSymbol: false, data: toSeriesData(e.schedule.points),
      lineStyle: { color: e.color, width: 2.6 }, itemStyle: { color: e.color }, z: 3,
      emphasis: { focus: 'series' },
      markPoint: {
        symbol: 'circle', symbolSize: 9, itemStyle: { color: e.color, borderColor: C.cream, borderWidth: 1.5 },
        label: { show: false }, data: [{ coord: [e.schedule.months, 0] }],
      },
    }))

    return withChartBase({
      animationDuration: 900,
      grid: { left: 8, right: 16, top: 40, bottom: 34, containLabel: true },
      legend: chartLegend({ top: 0, left: 0 }),
      tooltip: {
        trigger: 'axis', ...chartTooltip({ padding: [8, 10] }),
        axisPointer: chartAxisPointerLine,
        formatter: (ps) => {
          const month = ps[0]?.value?.[0] ?? 0
          let s = `<div style="font-family:'JetBrains Mono',monospace;font-size:12px">${roiMonthsLabel(month)} into the loan</div>`
          ps.forEach((p) => {
            s += `<div style="margin-top:2px">${p.marker} ${p.seriesName}: <b>${roiFmt(p.value[1])}</b> still owed</div>`
          })
          return s
        },
      },
      xAxis: {
        type: 'value', min: 0, max: maxMonth, splitNumber: 5,
        axisLine: chartAxisLine, axisTick: { show: false },
        axisLabel: { ...chartValueAxisLabel(), formatter: (v) => `${Math.round(v / 12)}yr` },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value', min: 0, max: Math.round(maxAmount),
        axisLabel: { ...chartValueAxisLabel(), formatter: (v) => rmCompact(v) },
        splitLine: chartSplitLine,
      },
      series: [baseSeries, ...extraSeries],
    })
  }, [base, active, principal])

  return <ReactECharts option={option} style={{ height: 300 }} opts={chartOpts} notMerge/>
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
            label: { show: false },
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
  const [extraPayments, setExtraPayments] = useState(() => [{ id: roiUid(), amount: 0 }])
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
    return { p, dep, loan, rate, yrs }
  }, [price, depositPct, loanPct, annualRate, years])

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

  const extraSchedules = useMemo(() => (
    extraPayments.map((p, i) => {
      const amount = Math.max(0, roiNum(p.amount, 0))
      return {
        id: p.id,
        amount,
        color: ROI_STRATEGY_COLORS[i % ROI_STRATEGY_COLORS.length],
        schedule: roiBuildSchedule({ principal, annualRate: safe.rate, years: safe.yrs, extraMonthly: amount }),
      }
    })
  ), [extraPayments, principal, safe.rate, safe.yrs])

  const extraResults = useMemo(() => (
    extraSchedules.map((s) => ({
      ...s,
      interestSaved: Math.max(0, baseSchedule.totalInterest - s.schedule.totalInterest),
      monthsSaved: Math.max(0, baseSchedule.months - s.schedule.months),
    }))
  ), [extraSchedules, baseSchedule])

  const activeResults = useMemo(() => (
    extraResults
      .map((r, i) => ({ ...r, num: i + 1 }))
      .filter((r) => r.amount > 0)
  ), [extraResults])
  const extraSliderMax = Math.max(1000, Math.round((baseSchedule.monthly * 2) / 50) * 50)

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
    // Payback from monthly cash flow only counts if rent actually clears the installment —
    // gross rental alone overstates payback when the owner is topping up the shortfall.
    const netPaybackYears = netMonthly > 0 ? investment / (netMonthly * 12) : null
    return { pts, breakEven, breakEvenValue, netMonthly, grossYield, finalProfit, roiOnInvestment, installment: M, income: inc, coverage, totalInterest, furnishing, investment, netPaybackYears, loanYears, tenureYears, horizon }
  }, [baseSchedule, deposit, monthlyIncome, oneTimeCost, safe.yrs, safe.p])

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

  const patchExtra = (id, amount) => setExtraPayments((items) => items.map((it) => (it.id === id ? { ...it, amount: Math.max(0, roiNum(amount, 0)) } : it)))
  const addExtra = () => setExtraPayments((items) => (items.length >= ROI_MAX_STRATEGIES ? items : [...items, { id: roiUid(), amount: 0 }]))
  const removeExtra = (id) => setExtraPayments((items) => items.filter((it) => it.id !== id))

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
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#3F4F44] pointer-events-none">RM / mo</span>
                      </div>
                      {source.mukim ? (
                        <div className="text-[11.5px] leading-snug" style={{ color: C.mid }}>
                          Enter your estimate, or switch to{' '}
                          <b className="cursor-pointer" style={{ color: C.earth }} onClick={() => setRentMode('live')}>
                            Live estimate
                          </b>{' '}
                          to auto-fill from {rentLabel} listings.
                        </div>
                      ) : (
                        <div className="text-[11.5px] leading-snug" style={{ color: C.mid }}>
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
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#3F4F44] pointer-events-none">RM / mo</span>
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
                <div className="text-[12px]" style={{ color: C.mid }}>e.g. storeroom, signage, co-living top-up.</div>
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
            {/* One-time cost items */}
            <div className="grid gap-[9px] pt-1.5 border-t border-dashed" style={{ borderColor: C.border }}>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C] mb-0.5">One-time costs (furnishing, reno…)</p>
              {costItems.length === 0 && (
                <div className="text-[12px]" style={{ color: C.mid }}>No one-time costs added.</div>
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
        <RoiMetric
          label="Gross yield"
          value={`${roi.grossYield.toFixed(1)}%`}
          sub="annual income ÷ price"
          tooltip="Annual rental income (rent + carpark + other) divided by the property price. A top-line yield — before interest, installment, or one-time costs, and the same whether you finance with a loan or pay cash."
        />
        <RoiMetric
          label="Break-even"
          value={roi.breakEven != null ? roiYearsLabel(roi.breakEven) : `> ${roi.horizon} yr`}
          sub={roi.breakEven != null ? 'rent out-earns interest + costs' : 'rent too low to recover'}
          accent={roi.breakEven != null ? C.deep : C.down}
          tooltip="The year cumulative rent collected catches up to cumulative interest + one-time costs. Loan principal isn't counted as a cost here — it converts into home equity you keep — so this is a softer bar than covering the full monthly installment."
        />
        <RoiMetric
          label={`Net profit @ ${Math.round(safe.yrs)}yr`}
          value={`${roi.finalProfit < 0 ? '−' : ''}${roiFmt(Math.abs(roi.finalProfit))}`}
          sub={`ROI ${roi.roiOnInvestment >= 0 ? '+' : ''}${roi.roiOnInvestment.toFixed(0)}% on cash in`}
          accent={roi.finalProfit >= 0 ? C.up : C.down}
          tooltip="Total rent collected over the full loan tenure, minus one-time costs and total interest paid (principal excluded, same as break-even). ROI% divides that profit by your actual cash in — deposit + one-time costs, not the property price — so it reflects the leverage from financing most of the purchase with a loan."
        />
      </div>
      </ScrollReveal>

      <ScrollReveal>
      <Card className="p-[18px]">
        <div className="flex justify-between items-baseline gap-3 flex-wrap">
          <span className="font-display text-[18px] font-medium text-[#2C3930]">Income vs debt over time</span>
          <span className="font-mono font-medium text-[13px] flex-shrink-0" style={{ color: roi.breakEven != null ? C.up : C.down }}>
            {roi.breakEven != null
              ? (roi.breakEven < 1 ? 'recovers within the first year' : `~${roi.breakEven.toFixed(1)} yr to recover`)
              : 'rent too low to recover'}
          </span>
        </div>
        <div className="mt-1 text-[12px]" style={{ color: C.mid }}>
          You repay the loan in full regardless, and the principal becomes equity you keep — so rent only has to out-earn the interest + one-time costs. Interest stops once the loan clears, so rent always catches up: that crossing is break-even.
        </div>
        <div className="mt-[14px]">
          <RoiEarningsChart pts={roi.pts} breakEven={roi.breakEven} breakEvenValue={roi.breakEvenValue} loanYears={roi.loanYears}/>
        </div>
      </Card>
      </ScrollReveal>

      <ScrollReveal>
      <Card className="p-[18px]">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="font-display text-[18px] font-medium text-[#2C3930]">Cash payback</span>
          <span className="font-mono font-medium text-[13px]" style={{ color: roi.netMonthly >= 0 ? C.up : C.down }}>
            {roi.netMonthly >= 0 ? `+${roiFmt(roi.netMonthly)} / mo` : `−${roiFmt(Math.abs(roi.netMonthly))} / mo`}
          </span>
        </div>
        <div className="mt-2.5 text-[13px] leading-[2]" style={{ color: C.mid }}>
          You pay <b className="font-mono text-[21px] font-semibold" style={{ color: C.deep }}>{roiFmt(roi.investment)}</b> upfront (deposit + one-time costs).{' '}
          {roi.netMonthly >= 0 ? (
            <>Rent covers the installment with <b className="font-mono text-[21px] font-semibold" style={{ color: C.up }}>{roiFmt(roi.netMonthly)}</b> left over each month — at that pace you take the upfront cash back in <b className="font-mono text-[21px] font-semibold" style={{ color: C.deep }}>~{roiYearsLabel(roi.netPaybackYears)}</b>.</>
          ) : (
            <>After the installment, you're topping up <b className="font-mono text-[21px] font-semibold" style={{ color: C.down }}>{roiFmt(Math.abs(roi.netMonthly))}</b> from your own pocket every month — so rent alone never pays that upfront cash back. You'd be funding the shortfall for the full <b className="font-mono text-[21px] font-semibold" style={{ color: C.deep }}>{roiYearsLabel(roi.loanYears)}</b>, until the loan is cleared.</>
          )}
        </div>
        <div className="mt-2.5 pt-2.5 border-t border-dashed text-[11.5px] leading-snug" style={{ borderColor: C.border, color: C.mid }}>
          <b style={{ color: C.mid }}>Assumption:</b> once the loan is fully paid off, the property is yours outright and can be liquidated (sold) — at that point your upfront cash{roi.netMonthly < 0 ? ' and every monthly top-up' : ''} is recovered through the underlying asset value, regardless of how monthly cash flow ran along the way.
        </div>
      </Card>
      </ScrollReveal>

      <ScrollReveal>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <RoiMetric label="Deposit amount" value={roiFmt(deposit)} sub={`${safe.dep.toFixed(1)}% upfront`}/>
        <RoiMetric label="Loan principal" value={roiFmt(principal)} sub={`${safe.loan.toFixed(1)}% financed`}/>
        <RoiMetric label="One-time cost" value={roiFmt(oneTimeCost)} sub="furnishing, reno…" accent={oneTimeCost ? C.down : C.mid}/>
        <RoiMetric label="Monthly installment" value={roiFmt(baseSchedule.monthly)} sub="reducing balance"/>
      </div>
      </ScrollReveal>

      <ScrollReveal>
      <Card className="p-[18px]">
        <div className="flex justify-between items-baseline gap-3 flex-wrap">
          <div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="font-display text-[18px] font-medium text-[#2C3930] cursor-help underline decoration-dotted decoration-1 underline-offset-4"
                    style={{ textDecorationColor: C.muted }}
                  >
                    Loan timeline
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] text-[12.5px] leading-snug">
                  If a buyer can afford to pay more toward the installment, this section shows how much they save in total loan tenure.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="mt-1 text-[12px]" style={{ color: C.mid }}>
              See how much you could save — in interest and payoff time — if you can afford to pay more than the minimum installment each month.
            </div>
          </div>
        </div>

        {/* Extra payment strategies */}
        <div className="mt-[16px] grid gap-[14px] pt-3 border-t border-dashed" style={{ borderColor: C.border }}>
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: C.earth }}>
              Extra monthly payment (optional) · compare strategies
            </p>
            {extraPayments.length < ROI_MAX_STRATEGIES && (
              <Button type="button" variant="outline" size="sm" onClick={addExtra}
                className="self-start border-dashed border-[#A27B5C] text-[#A27B5C] bg-transparent hover:bg-[#A27B5C]/10">
                + Add strategy
              </Button>
            )}
          </div>
          <div className="grid gap-[14px]" style={{ gridTemplateColumns: extraPayments.length > 1 ? '1fr 1fr' : '1fr' }}>
            {extraPayments.map((p, i) => (
              <RoiExtraPaymentRow
                key={p.id}
                index={i}
                amount={Math.max(0, roiNum(p.amount, 0))}
                color={ROI_STRATEGY_COLORS[i % ROI_STRATEGY_COLORS.length]}
                max={extraSliderMax}
                onAmount={(v) => patchExtra(p.id, v)}
                onRemove={() => removeExtra(p.id)}
                canRemove={extraPayments.length > 1}
              />
            ))}
          </div>
          <div className="text-[11.5px] leading-snug" style={{ color: C.mid }}>
            Paid <b style={{ color: C.mid }}>on top of</b> the monthly installment to clear the loan faster and cut total interest. Add another strategy to compare amounts side by side. Leave at <b style={{ color: C.mid }}>0</b> to keep the normal schedule.
          </div>
        </div>

        <RoiSavingsHighlight results={activeResults}/>

        {activeResults.length === 0 && (
          <div className="mt-3 flex items-start gap-[11px] px-[15px] py-3 rounded-[10px]" style={{ background: `${C.earth}1F`, border: `1px solid ${C.earth}66` }}>
            <span className="flex-shrink-0 w-[21px] h-[21px] rounded-full flex items-center justify-center mt-0.5 text-[13px] font-bold italic"
              style={{ background: C.earth, color: C.cream }}>i</span>
            <span className="text-[13px] leading-relaxed" style={{ color: C.deep }}>
              <b>No extra monthly payment added.</b> The chart below shows your <b>normal schedule only</b>. Drag a strategy's slider above to see how much faster you'd clear the loan and how much interest you'd save.
            </span>
          </div>
        )}
        <div className="mt-[18px]">
          <RoiTimelineChart base={baseSchedule} extras={extraSchedules} principal={principal}/>
        </div>

        {activeResults.length > 0 && (
          <div className="mt-[18px] grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(1 + activeResults.length, 4)}, 1fr)` }}>
            <RoiMetric label="Interest without extra" value={roiFmt(baseSchedule.totalInterest)} sub={roiMonthsLabel(baseSchedule.months)}/>
            {activeResults.map((r) => (
              <RoiMetric
                key={r.id}
                label={`Interest with extra · Strategy ${r.num}`}
                value={roiFmt(r.schedule.totalInterest)}
                sub={`${roiMonthsLabel(r.schedule.months)} · +${roiFmt(r.amount)}/mo`}
                accent={r.color}
              />
            ))}
          </div>
        )}

        <div className="mt-[14px] pt-[14px] flex justify-between gap-2.5 flex-wrap text-[12.5px]" style={{ borderTop: `1px solid ${C.border}`, color: C.mid }}>
          <span>Upfront cash <b style={{ color: C.deep }}>{roiFmt(roi.investment)}</b> (deposit + one-time) — real money out of pocket</span>
          <span className="font-semibold" style={{ color: roi.netPaybackYears != null ? C.up : C.down }}>
            {roi.netPaybackYears != null
              ? `Net rent collects it back in ~${roi.netPaybackYears.toFixed(1)} yr`
              : 'Recovered at loan payoff via liquidation — see Cash payback above'}
          </span>
        </div>
      </Card>
      </ScrollReveal>

    </div>
  )
}
