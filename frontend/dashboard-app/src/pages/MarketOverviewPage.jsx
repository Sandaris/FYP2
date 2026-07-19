import { useState, useMemo, useEffect, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard, ScrollReveal } from '@/components/shared'
import { Eyebrow } from '@/components/shared/primitives'
import { C } from '@/lib/colors'
import { MKT_PRICE } from '@/lib/napicPrices'
import {
  CHART_THEME,
  chartAreaGrad,
  chartAxisLine,
  chartAxisPointerLine,
  chartAxisPointerShadow,
  chartCategoryAxisLabel,
  chartGrad,
  chartGrid,
  chartLegend,
  chartLoading,
  chartOpts,
  chartSplitLine,
  chartTooltip,
  chartValueAxisLabel,
  chartVisualMap,
  chartBarRadius,
  withChartBase,
} from '@/lib/chartTheme'

// ---- headline figures (actual, from the parquet) --------------------------
const MKT = {
  txns: 416627,
  valueBn: 208.1,        // sum(Price) = RM 208.09 bn
  medianPrice: 371000,
  medianPpm: 3600,       // median Price / built-up Area (RM per m²)
  freehold: 66.4, leasehold: 33.6,
  coverage: 'Jan 2021 – Mar 2026',
}

// quarterly transaction count [quarter, count]
const MKT_QVOL = [
  ['2021 Q1', 4531], ['2021 Q2', 5842], ['2021 Q3', 10105], ['2021 Q4', 28885],
  ['2022 Q1', 24442], ['2022 Q2', 31553], ['2022 Q3', 33058], ['2022 Q4', 29521],
  ['2023 Q1', 27355], ['2023 Q2', 30650], ['2023 Q3', 30770], ['2023 Q4', 29406],
  ['2024 Q1', 27059], ['2024 Q2', 27321], ['2024 Q3', 25971], ['2024 Q4', 9331],
  ['2025 Q1', 7680], ['2025 Q2', 8398], ['2025 Q3', 9719], ['2025 Q4', 9362],
  ['2026 Q1', 5668],
]

// [district, count, median price] — top 12 by volume
const MKT_DIST = [
  ['Johor Bahru', 46111, 499000], ['Petaling', 33861, 550000],
  ['Kuala Lumpur', 26365, 560000], ['Hulu Langat', 22984, 440000],
  ['Kinta', 19155, 299000], ['Klang', 18633, 450000],
  ['Seremban', 17492, 380000], ['Gombak', 12386, 444000],
  ['Timur Laut', 11504, 380000], ['Kuala Muda', 10948, 250000],
  ['Kuantan', 10705, 290000], ['Melaka Tengah', 10629, 300000],
]

// average price per state (RM) — every district mapped to its state, all
// 416,627 rows. [state, mean price, median price, transaction count] — avg desc.
const STATE_AVG = [
  ['Kuala Lumpur', 982117, 560000, 26365],
  ['Putrajaya', 932481, 683500, 772],
  ['Selangor', 608509, 454000, 112047],
  ['Penang', 520642, 380000, 34288],
  ['Johor', 516664, 450000, 73570],
  ['Labuan', 460126, 420000, 380],
  ['Sabah', 445800, 355000, 7528],
  ['Sarawak', 420804, 385000, 12220],
  ['Negeri Sembilan', 383139, 335000, 25349],
  ['Melaka', 325464, 280000, 19347],
  ['Pahang', 315395, 280000, 18906],
  ['Perak', 315099, 271000, 42350],
  ['Kelantan', 313353, 300000, 6702],
  ['Kedah', 310985, 280000, 24733],
  ['Terengganu', 308658, 320000, 10032],
  ['Perlis', 271519, 259000, 2038],
]
const STATE_HIGH = STATE_AVG[0] // Kuala Lumpur — highest average price

const DMED = {}; MKT_DIST.forEach(d => { DMED[d[0]] = d[2] })

// Malaysian states/federal territories, alphabetical — options for the state filter
const MY_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Penang', 'Perak', 'Perlis', 'Putrajaya', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
]
// '' = whole-country tab, always first
const STATE_TABS = ['', ...MY_STATES]
const stateLabel = (s) => s || 'Malaysia (All)'

// backend RM-band keys (plain hyphen) -> display labels (en dash)
const BAND_LABEL = {
  '<200k': '<200k', '200-300k': '200–300k', '300-400k': '300–400k', '400-500k': '400–500k',
  '500-700k': '500–700k', '700k-1m': '700k–1m', '1-1.5m': '1–1.5m', '>1.5m': '>1.5m',
}

// raw `Property Type` dataset labels -> the shorter display labels used on this page
const PTYPE_LABEL = {
  '2 - 2 1/2 Storey Terraced': '2-2½ Storey Terraced',
  '1 - 1 1/2 Storey Terraced': '1-1½ Storey Terraced',
  '1 - 1 1/2 Storey Semi-Detached': '1-1½ Storey Semi-D',
  '2 - 2 1/2 Storey Semi-Detached': '2-2½ Storey Semi-D',
}
const ptypeLabel = (t) => PTYPE_LABEL[t] || t
const BAND_KEYS = Object.keys(BAND_LABEL) // fixed backend band order

// per-state breakdowns for the state filter below — precomputed from the same
// parquet the backend aggregates at request time (see data_query(full_stats=true)
// in backend/api.py). The dataset is static, so there's no need for a live
// fetch per tab: t = [type, count, median][], b = price-band counts in
// BAND_KEYS order, f/l = freehold/leasehold counts. '' = whole country.
const STATE_STATS = {
  '': {
    t: [['2 - 2 1/2 Storey Terraced', 118722, 540000], ['1 - 1 1/2 Storey Terraced', 93697, 285000], ['Condominium/Apartment', 65780, 385000], ['Low-Cost House', 28351, 190000], ['1 - 1 1/2 Storey Semi-Detached', 22030, 380000], ['Low-Cost Flat', 21190, 145000], ['Detached', 18939, 500000], ['2 - 2 1/2 Storey Semi-Detached', 18071, 869000], ['Flat', 16504, 210000], ['Cluster House', 9092, 537000], ['Town House', 4251, 360000]],
    b: [64666, 83685, 76812, 59846, 61421, 37976, 17727, 14494],
    f: 276848, l: 139779,
  },
  'Johor': {
    t: [['2 - 2 1/2 Storey Terraced', 28617, 560000], ['1 - 1 1/2 Storey Terraced', 15814, 382000], ['Condominium/Apartment', 7179, 370000], ['Low-Cost House', 6596, 230000], ['Cluster House', 3567, 910000], ['2 - 2 1/2 Storey Semi-Detached', 3169, 995000], ['Low-Cost Flat', 2629, 130000], ['1 - 1 1/2 Storey Semi-Detached', 2147, 495000], ['Detached', 1955, 550000], ['Flat', 1268, 160000], ['Town House', 629, 250000]],
    b: [9197, 8706, 12017, 13176, 16076, 9299, 3623, 1476],
    f: 63672, l: 9898,
  },
  'Kedah': {
    t: [['1 - 1 1/2 Storey Terraced', 7974, 245000], ['Low-Cost House', 5749, 192000], ['1 - 1 1/2 Storey Semi-Detached', 4338, 370000], ['2 - 2 1/2 Storey Terraced', 3701, 385000], ['2 - 2 1/2 Storey Semi-Detached', 1299, 565000], ['Detached', 973, 550000], ['Condominium/Apartment', 244, 210000], ['Low-Cost Flat', 214, 100000], ['Cluster House', 154, 418000], ['Town House', 53, 190000], ['Flat', 34, 90000]],
    b: [5409, 8344, 5470, 2991, 1898, 493, 92, 36],
    f: 23693, l: 1040,
  },
  'Kelantan': {
    t: [['Detached', 2477, 380000], ['1 - 1 1/2 Storey Terraced', 2132, 230000], ['1 - 1 1/2 Storey Semi-Detached', 787, 330000], ['2 - 2 1/2 Storey Terraced', 711, 330000], ['Low-Cost House', 326, 150000], ['Condominium/Apartment', 91, 260000], ['2 - 2 1/2 Storey Semi-Detached', 88, 460000], ['Low-Cost Flat', 34, 77500], ['Cluster House', 33, 188000], ['Town House', 22, 488000], ['Flat', 1, 50000]],
    b: [1035, 2081, 2074, 1143, 312, 47, 7, 3],
    f: 5333, l: 1369,
  },
  'Kuala Lumpur': {
    t: [['Condominium/Apartment', 15259, 565000], ['2 - 2 1/2 Storey Terraced', 3623, 980000], ['Low-Cost Flat', 2454, 192500], ['Flat', 2031, 240000], ['1 - 1 1/2 Storey Terraced', 1043, 650000], ['Detached', 723, 3900000], ['2 - 2 1/2 Storey Semi-Detached', 560, 2700000], ['Town House', 343, 755000], ['Cluster House', 167, 300000], ['Low-Cost House', 123, 388000], ['1 - 1 1/2 Storey Semi-Detached', 39, 650000]],
    b: [1932, 3049, 3464, 3087, 4155, 3282, 3055, 4341],
    f: 15169, l: 11196,
  },
  'Labuan': {
    t: [['2 - 2 1/2 Storey Terraced', 90, 540000], ['1 - 1 1/2 Storey Terraced', 76, 420000], ['Flat', 56, 170000], ['2 - 2 1/2 Storey Semi-Detached', 52, 669000], ['Condominium/Apartment', 44, 256500], ['Detached', 20, 988000], ['Low-Cost Flat', 17, 130000], ['Low-Cost House', 16, 322500], ['1 - 1 1/2 Storey Semi-Detached', 9, 560000]],
    b: [64, 58, 42, 85, 80, 37, 10, 4],
    f: 5, l: 375,
  },
  'Melaka': {
    t: [['1 - 1 1/2 Storey Terraced', 7260, 260000], ['2 - 2 1/2 Storey Terraced', 4667, 350000], ['Low-Cost House', 1582, 150000], ['1 - 1 1/2 Storey Semi-Detached', 1359, 410000], ['Condominium/Apartment', 1164, 207500], ['Detached', 1005, 600000], ['2 - 2 1/2 Storey Semi-Detached', 764, 637000], ['Cluster House', 490, 414000], ['Low-Cost Flat', 398, 85000], ['Town House', 389, 150000], ['Flat', 269, 130000]],
    b: [4780, 5677, 3960, 2459, 1699, 564, 139, 69],
    f: 11541, l: 7806,
  },
  'Negeri Sembilan': {
    t: [['2 - 2 1/2 Storey Terraced', 9046, 500000], ['1 - 1 1/2 Storey Terraced', 8889, 260000], ['Low-Cost House', 1665, 153000], ['Condominium/Apartment', 1482, 165000], ['Detached', 1182, 530000], ['1 - 1 1/2 Storey Semi-Detached', 956, 424000], ['Low-Cost Flat', 734, 80000], ['2 - 2 1/2 Storey Semi-Detached', 677, 750000], ['Flat', 309, 150000], ['Cluster House', 205, 350000], ['Town House', 204, 171000]],
    b: [4863, 6140, 4290, 3643, 4477, 1486, 328, 122],
    f: 21699, l: 3650,
  },
  'Pahang': {
    t: [['1 - 1 1/2 Storey Terraced', 8819, 260000], ['1 - 1 1/2 Storey Semi-Detached', 2990, 341000], ['2 - 2 1/2 Storey Terraced', 2721, 420000], ['Low-Cost House', 1855, 160000], ['Condominium/Apartment', 1037, 330000], ['Detached', 837, 300000], ['2 - 2 1/2 Storey Semi-Detached', 500, 667000], ['Low-Cost Flat', 80, 74000], ['Flat', 32, 160000], ['Cluster House', 29, 150000], ['Town House', 6, 350000]],
    b: [4244, 6427, 4228, 2133, 1227, 464, 131, 52],
    f: 11528, l: 7378,
  },
  'Penang': {
    t: [['Condominium/Apartment', 8757, 530000], ['2 - 2 1/2 Storey Terraced', 6496, 547000], ['Low-Cost Flat', 5494, 135000], ['Flat', 5286, 280000], ['1 - 1 1/2 Storey Terraced', 3072, 340000], ['2 - 2 1/2 Storey Semi-Detached', 1719, 830000], ['Low-Cost House', 893, 250000], ['Detached', 890, 1100000], ['1 - 1 1/2 Storey Semi-Detached', 749, 495000], ['Cluster House', 545, 280000], ['Town House', 387, 380000]],
    b: [6216, 5605, 5862, 4441, 5549, 3623, 1617, 1375],
    f: 29949, l: 4339,
  },
  'Perak': {
    t: [['1 - 1 1/2 Storey Terraced', 17346, 246000], ['2 - 2 1/2 Storey Terraced', 10084, 370000], ['Low-Cost House', 3327, 170000], ['Cluster House', 2506, 250000], ['Detached', 2498, 340000], ['1 - 1 1/2 Storey Semi-Detached', 2312, 370000], ['Condominium/Apartment', 2304, 230000], ['2 - 2 1/2 Storey Semi-Detached', 1448, 600000], ['Low-Cost Flat', 321, 70000], ['Town House', 121, 308000], ['Flat', 83, 100000]],
    b: [7835, 16800, 8807, 4848, 2887, 823, 206, 144],
    f: 17286, l: 25064,
  },
  'Perlis': {
    t: [['1 - 1 1/2 Storey Terraced', 830, 241000], ['Low-Cost House', 432, 140000], ['1 - 1 1/2 Storey Semi-Detached', 382, 368000], ['2 - 2 1/2 Storey Terraced', 163, 385000], ['2 - 2 1/2 Storey Semi-Detached', 89, 489000], ['Cluster House', 69, 25000], ['Detached', 62, 517500], ['Low-Cost Flat', 6, 50000], ['Condominium/Apartment', 5, 233000]],
    b: [666, 607, 431, 231, 86, 15, 1, 1],
    f: 1402, l: 636,
  },
  'Putrajaya': {
    t: [['Condominium/Apartment', 309, 610000], ['2 - 2 1/2 Storey Terraced', 243, 980000], ['Low-Cost Flat', 119, 275000], ['2 - 2 1/2 Storey Semi-Detached', 77, 2004000], ['Detached', 14, 2673000], ['Town House', 7, 470000], ['Cluster House', 2, 1522000], ['Flat', 1, 270000]],
    b: [2, 147, 71, 39, 146, 155, 59, 153],
    f: 772, l: 0,
  },
  'Sabah': {
    t: [['2 - 2 1/2 Storey Terraced', 2395, 440000], ['Condominium/Apartment', 2173, 280000], ['1 - 1 1/2 Storey Terraced', 1134, 320000], ['2 - 2 1/2 Storey Semi-Detached', 507, 800000], ['Low-Cost House', 423, 210000], ['Low-Cost Flat', 282, 165000], ['Detached', 251, 673000], ['1 - 1 1/2 Storey Semi-Detached', 128, 483000], ['Flat', 120, 184000], ['Cluster House', 71, 250000], ['Town House', 44, 580000]],
    b: [1004, 1709, 1632, 1119, 1052, 620, 245, 147],
    f: 464, l: 7064,
  },
  'Sarawak': {
    t: [['1 - 1 1/2 Storey Terraced', 3576, 322500], ['2 - 2 1/2 Storey Terraced', 3065, 470000], ['Condominium/Apartment', 1579, 408000], ['2 - 2 1/2 Storey Semi-Detached', 1041, 688000], ['Low-Cost House', 1013, 210000], ['1 - 1 1/2 Storey Semi-Detached', 799, 460000], ['Detached', 398, 600000], ['Flat', 295, 128000], ['Low-Cost Flat', 226, 75000], ['Town House', 186, 336000], ['Cluster House', 42, 250000]],
    b: [1465, 2031, 2899, 2731, 2029, 789, 197, 79],
    f: 1586, l: 10634,
  },
  'Selangor': {
    t: [['2 - 2 1/2 Storey Terraced', 42310, 650000], ['Condominium/Apartment', 23688, 335000], ['1 - 1 1/2 Storey Terraced', 13486, 390000], ['Low-Cost Flat', 8049, 150000], ['Flat', 6685, 180000], ['2 - 2 1/2 Storey Semi-Detached', 5744, 1400000], ['Detached', 3949, 1630000], ['Low-Cost House', 3445, 295000], ['Town House', 1806, 400000], ['1 - 1 1/2 Storey Semi-Detached', 1678, 460000], ['Cluster House', 1207, 833000]],
    b: [14263, 13784, 17807, 16108, 19367, 16225, 8006, 6487],
    f: 66004, l: 46043,
  },
  'Terengganu': {
    t: [['1 - 1 1/2 Storey Semi-Detached', 3357, 350000], ['1 - 1 1/2 Storey Terraced', 2246, 244000], ['Detached', 1705, 400000], ['Low-Cost House', 906, 140000], ['2 - 2 1/2 Storey Terraced', 790, 360000], ['Condominium/Apartment', 465, 232000], ['2 - 2 1/2 Storey Semi-Detached', 337, 460000], ['Low-Cost Flat', 133, 60000], ['Town House', 54, 77000], ['Flat', 34, 97500], ['Cluster House', 5, 120000]],
    b: [1691, 2520, 3758, 1612, 381, 54, 11, 5],
    f: 6745, l: 3287,
  },
}

// derive the three chart row-sets for a given state tab from STATE_STATS
const statsForState = (state) => {
  const s = STATE_STATS[state] || STATE_STATS['']
  return {
    ptypeRows: s.t.map(([type, count, median]) => ({ label: ptypeLabel(type), count, median })),
    bandRows: BAND_KEYS.map((band, i) => ({ band, count: s.b[i] })),
    tenureRows: [
      { tenure: 'Freehold', count: s.f },
      { tenure: 'Leasehold', count: s.l },
    ].filter((t) => t.count > 0),
  }
}

// ---- shared chart helpers -------------------------------------------------
const mFmt = (n) => Number(n).toLocaleString('en-US')
const mRM = (n) => 'RM ' + mFmt(Math.round(n))

// ---- choropleth ↔ bar morph: average price by state (the showpiece) -------
const StatePriceMorph = () => {
  const elRef = useRef(null)
  const chartRef = useRef(null)
  const optionsRef = useRef(null)
  const [view, setView] = useState('map')   // 'map' | 'bar'
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!elRef.current) return undefined
    const chart = echarts.init(elRef.current, CHART_THEME, { renderer: 'canvas' })
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(elRef.current)
    const t0 = setTimeout(() => chart.resize(), 320)
    let disposed = false

    const asc = [...STATE_AVG].sort((a, b) => a[1] - b[1]) // ascending → highest at top of the bar list
    const items = asc.map(d => ({ name: d[0], value: d[1] }))
    const META = Object.fromEntries(STATE_AVG.map(d => [d[0], d]))
    const visualMap = chartVisualMap({
      min: 270000, max: 700000, calculable: true,
      text: ['High', 'Low'],
      formatter: (v) => 'RM' + Math.round(v / 1000) + 'k',
    })
    const tooltip = chartTooltip({
      trigger: 'item',
      formatter: (p) => {
        const m = META[p.name]
        return `${p.name}<br/>Avg price: <b>${mRM(p.value)}</b>` +
          (m ? `<br/>Median ${mRM(m[2])} · ${mFmt(m[3])} txns` : '')
      },
    })
    const mapOption = withChartBase({
      visualMap, tooltip,
      series: [{
        id: 'statePrice', type: 'map', map: 'malaysia', roam: true,
        aspectScale: 1, zoom: 1.06,
        universalTransition: true, animationDurationUpdate: 1500,
        data: items, label: { show: false },
        itemStyle: { borderColor: C.cream, borderWidth: 0.6 },
        emphasis: { label: { show: true, color: C.deep, fontFamily: "'DM Sans',sans-serif" }, itemStyle: { areaColor: C.earthLight } },
        select: { disabled: true },
      }],
    })
    const barOption = withChartBase({
      visualMap, tooltip,
      grid: chartGrid({ left: 118, right: 74, top: 8, bottom: 62 }),
      xAxis: {
        type: 'value',
        splitLine: chartSplitLine,
        axisLabel: chartValueAxisLabel({ formatter: (v) => 'RM' + Math.round(v / 1000) + 'k' }),
      },
      yAxis: {
        type: 'category', data: items.map(i => i.name),
        axisTick: { show: false }, axisLine: chartAxisLine,
        axisLabel: chartCategoryAxisLabel(),
      },
      series: {
        id: 'statePrice', type: 'bar', universalTransition: true, animationDurationUpdate: 1500,
        barWidth: '62%', data: items.map(i => i.value),
        label: { show: true, position: 'right', ...chartValueAxisLabel(), formatter: (p) => 'RM' + Math.round(p.value / 1000) + 'k' },
      },
    })

    optionsRef.current = { map: mapOption, bar: barOption }

    chart.showLoading(chartLoading)
    fetch('/malaysia-states.geojson').then(r => r.json()).then(geo => {
      if (disposed) return
      echarts.registerMap('malaysia', geo)
      chart.hideLoading()
      chart.setOption(mapOption)
      chart.resize()
      setReady(true)
    }).catch(() => { if (!disposed) chart.hideLoading() })

    return () => { disposed = true; clearTimeout(t0); ro.disconnect(); chart.dispose(); chartRef.current = null }
  }, [])

  // morph between the two views whenever the toggle flips (universalTransition)
  useEffect(() => {
    if (!ready || !chartRef.current || !optionsRef.current) return
    chartRef.current.setOption(view === 'map' ? optionsRef.current.map : optionsRef.current.bar, true)
  }, [view, ready])

  return (
    <div className="w-full">
      <div className="flex justify-center mb-1">
        <div className="inline-flex gap-1 bg-[#DCD7C9] p-1 rounded-full border border-[#C8C3B8] shadow-md">
          {[['map', 'Map'], ['bar', 'Ranking']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              className={`rounded-full px-5 py-1.5 text-[12.5px] font-semibold transition-all duration-200 ${
                view === id ? 'bg-[#2C3930] text-[#DCD7C9]' : 'bg-transparent text-[#3F4F44]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div ref={elRef} style={{ width: '100%', height: 430 }} />
    </div>
  )
}

// ---- ChartCard — shadcn Card wrapper --------------------------------------
const ChartCard = ({ title, note, children }) => (
  <Card>
    <CardHeader className="pb-2">
      <div className="flex justify-between items-baseline gap-3">
        <CardTitle className="font-display text-[18px] font-medium text-[#2C3930]">{title}</CardTitle>
        {note && <span className="text-[11.5px] text-[#3F4F44] text-right">{note}</span>}
      </div>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

// ---- state filter — a row of "folder" tabs sitting on top of the panel below
const StateFilterBar = ({ value, onChange }) => (
  <div className="flex items-end gap-2">
    <div className="flex gap-1.5 overflow-x-auto flex-1 pb-px" style={{ scrollbarWidth: 'thin' }}>
      {STATE_TABS.map((s) => {
        const active = value === s
        return (
          <button
            key={s || 'all'}
            onClick={() => onChange(s)}
            className="shrink-0 font-sans text-[12.5px] font-semibold px-4 py-2 rounded-t-lg border whitespace-nowrap transition-colors duration-150"
            style={active ? {
              background: C.deep, color: C.cream, borderColor: C.deep,
            } : {
              background: C.raised, color: C.mid, borderColor: C.border, borderBottomColor: 'transparent',
            }}
          >
            {stateLabel(s)}
          </button>
        )
      })}
    </div>
  </div>
)

// ---- Main page ------------------------------------------------------------
export default function MarketOverviewPage() {
  const volOption = useMemo(() => withChartBase({
    grid: chartGrid(),
    tooltip: {
      trigger: 'axis', ...chartTooltip(),
      axisPointer: chartAxisPointerLine,
      valueFormatter: (v) => mFmt(v) + ' transactions',
    },
    xAxis: {
      type: 'category', data: MKT_QVOL.map(d => d[0]), boundaryGap: false,
      axisLine: chartAxisLine, axisTick: { show: false },
      axisLabel: { ...chartValueAxisLabel(), interval: (i, v) => v.endsWith('Q1'), formatter: (v) => v.split(' ')[0] },
    },
    yAxis: {
      type: 'value', splitLine: chartSplitLine,
      axisLabel: { ...chartValueAxisLabel(), formatter: (v) => (v >= 1000 ? v / 1000 + 'k' : v) },
    },
    series: [{
      type: 'line', smooth: true, showSymbol: false, data: MKT_QVOL.map(d => d[1]),
      lineStyle: { color: C.earth, width: 2.4 },
      areaStyle: { color: chartAreaGrad(C.earth, 0.34, 0.02) },
      markArea: {
        silent: true, itemStyle: { color: C.deep, opacity: 0.05 },
        label: { show: true, position: 'top', ...chartValueAxisLabel({ fontSize: 9, fontFamily: "'DM Sans',sans-serif" }), formatter: 'provisional' },
        data: [[{ xAxis: '2024 Q4' }, { xAxis: '2026 Q1' }]],
      },
    }],
  }), [])

  const priceOption = useMemo(() => withChartBase({
    grid: chartGrid(),
    tooltip: {
      trigger: 'axis', ...chartTooltip(),
      axisPointer: chartAxisPointerLine,
      valueFormatter: (v) => mRM(v),
    },
    xAxis: {
      type: 'category', data: MKT_PRICE.map(d => d[0]), boundaryGap: false,
      axisLine: chartAxisLine, axisTick: { show: false },
      axisLabel: { ...chartValueAxisLabel(), interval: (i, v) => v.endsWith('Q1') && Number(v.slice(0, 4)) % 5 === 0, formatter: (v) => v.split(' ')[0] },
    },
    yAxis: {
      type: 'value', scale: true, splitLine: chartSplitLine,
      axisLabel: { ...chartValueAxisLabel(), formatter: (v) => 'RM' + Math.round(v / 1000) + 'k' },
    },
    series: [{
      type: 'line', smooth: true, showSymbol: false, data: MKT_PRICE.map(d => d[1]),
      lineStyle: { color: C.mid, width: 2.4 },
      areaStyle: { color: chartAreaGrad(C.mid, 0.34, 0.02) },
    }],
  }), [])

  // ---- state filter: every chart below the tab bar reads from the
  // precomputed STATE_STATS table, except "Top districts" which stays a
  // fixed, whole-country ranking.
  const [stateFilter, setStateFilter] = useState('')
  const { ptypeRows, bandRows, tenureRows } = useMemo(() => statsForState(stateFilter), [stateFilter])

  const histOption = useMemo(() => withChartBase({
    grid: chartGrid({ left: 46, right: 16, top: 18, bottom: 30 }),
    tooltip: { trigger: 'axis', ...chartTooltip(), axisPointer: chartAxisPointerShadow, valueFormatter: (v) => mFmt(v) },
    xAxis: {
      type: 'category', data: bandRows.map(d => BAND_LABEL[d.band] || d.band),
      axisLine: chartAxisLine, axisTick: { show: false },
      axisLabel: { ...chartValueAxisLabel(), fontSize: 9, interval: 0 },
    },
    yAxis: { type: 'value', splitLine: chartSplitLine, axisLabel: { ...chartValueAxisLabel(), formatter: (v) => (v >= 1000 ? v / 1000 + 'k' : v) } },
    series: [{ type: 'bar', barWidth: '62%', data: bandRows.map(d => d.count), itemStyle: { borderRadius: chartBarRadius.vertical, color: chartGrad(0, 1, C.earthLight, C.earth) } }],
  }), [bandRows])

  const tenureOption = useMemo(() => withChartBase({
    tooltip: { trigger: 'item', ...chartTooltip(), formatter: (p) => `${p.name}<br/><b>${mFmt(p.value)}</b> (${p.percent}%)` },
    legend: chartLegend({ bottom: 2 }),
    series: [{
      type: 'pie', radius: ['54%', '80%'], center: ['50%', '45%'],
      data: tenureRows.map(t => ({ name: t.tenure, value: t.count })),
      itemStyle: { borderColor: C.cream, borderWidth: 3 },
      label: { ...chartCategoryAxisLabel({ fontSize: 12 }), formatter: '{b}\n{d}%' },
      labelLine: { lineStyle: { color: C.border } },
      color: [C.earth, C.mid],
    }],
  }), [tenureRows])

  const ptypeTotal = useMemo(() => ptypeRows.reduce((s, d) => s + d.count, 0), [ptypeRows])
  const ptypeMed = useMemo(() => Object.fromEntries(ptypeRows.map(d => [d.label, d.median])), [ptypeRows])

  const ptypeCountOption = useMemo(() => {
    const asc = [...ptypeRows].sort((a, b) => a.count - b.count)
    return withChartBase({
      grid: chartGrid({ left: 142, right: 56, top: 6, bottom: 22 }),
      tooltip: {
        trigger: 'axis', ...chartTooltip(), axisPointer: chartAxisPointerShadow,
        formatter: (ps) => { const p = ps[0]; return `${p.name}<br/>Transactions: <b>${mFmt(p.value)}</b><br/>Median: ${mRM(ptypeMed[p.name])}` },
      },
      xAxis: { type: 'value', splitLine: chartSplitLine, axisLabel: { ...chartValueAxisLabel(), formatter: (v) => (v >= 1000 ? v / 1000 + 'k' : v) } },
      yAxis: { type: 'category', data: asc.map(d => d.label), axisTick: { show: false }, axisLine: chartAxisLine, axisLabel: chartCategoryAxisLabel() },
      series: [{
        type: 'bar', barWidth: '62%', data: asc.map(d => d.count),
        itemStyle: { borderRadius: chartBarRadius.horizontal, color: chartGrad(1, 0, C.earthLight, C.earth) },
        label: { show: true, position: 'right', ...chartValueAxisLabel(), formatter: (p) => mFmt(p.value) },
      }],
    })
  }, [ptypeRows, ptypeMed])

  const ptypePriceOption = useMemo(() => {
    const byPrice = [...ptypeRows].sort((a, b) => a.median - b.median)
    return withChartBase({
      grid: chartGrid({ left: 142, right: 64, top: 6, bottom: 22 }),
      tooltip: {
        trigger: 'axis', ...chartTooltip(), axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(63,79,68,0.08)' } },
        formatter: (ps) => { const p = ps[0]; return `${p.name}<br/>Median price: <b>${mRM(p.value)}</b>` },
      },
      xAxis: { type: 'value', splitLine: chartSplitLine, axisLabel: { ...chartValueAxisLabel(), formatter: (v) => 'RM' + v / 1000 + 'k' } },
      yAxis: { type: 'category', data: byPrice.map(d => d.label), axisTick: { show: false }, axisLine: chartAxisLine, axisLabel: chartCategoryAxisLabel() },
      series: [{
        type: 'bar', barWidth: '62%', data: byPrice.map(d => d.median),
        itemStyle: { borderRadius: chartBarRadius.horizontal, color: chartGrad(1, 0, C.light, C.mid) },
        label: { show: true, position: 'right', ...chartValueAxisLabel(), formatter: (p) => 'RM' + Math.round(p.value / 1000) + 'k' },
      }],
    })
  }, [ptypeRows])

  const distOption = useMemo(() => {
    const asc = [...MKT_DIST].reverse()
    return withChartBase({
      grid: chartGrid({ left: 122, right: 58, top: 6, bottom: 24 }),
      tooltip: {
        trigger: 'axis', ...chartTooltip(), axisPointer: chartAxisPointerShadow,
        formatter: (ps) => { const p = ps[0]; return `${p.name}<br/>Transactions: <b>${mFmt(p.value)}</b><br/>Median: ${mRM(DMED[p.name])}` },
      },
      xAxis: { type: 'value', splitLine: chartSplitLine, axisLabel: { ...chartValueAxisLabel(), formatter: (v) => (v >= 1000 ? v / 1000 + 'k' : v) } },
      yAxis: { type: 'category', data: asc.map(d => d[0]), axisTick: { show: false }, axisLine: chartAxisLine, axisLabel: chartCategoryAxisLabel() },
      series: [{
        type: 'bar', barWidth: '64%', data: asc.map(d => d[1]),
        itemStyle: { borderRadius: chartBarRadius.horizontal, color: chartGrad(1, 0, C.earthLight, C.earth) },
        label: { show: true, position: 'right', ...chartValueAxisLabel(), formatter: (p) => mFmt(p.value) },
      }],
    })
  }, [])

  return (
    <div className="p-6 space-y-5">
      <ScrollReveal>
        <div>
          <p className="text-[11px] font-sans font-medium uppercase tracking-[0.14em] text-[#A27B5C]">
            Property Market Overview
          </p>
          <span className="font-display text-[28px] font-medium text-[#2C3930] block mt-1.5">
            Malaysia residential property market
          </span>
          <div className="mt-1.5 font-sans text-[13px] text-[#3F4F44]">
            {mFmt(MKT.txns)} transactions · {MKT.coverage} · source: NAPIC Open Transaction Data
          </div>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        <ScrollReveal delay={0}><StatCard label="Transactions" value={mFmt(MKT.txns)} sub="residential, 2021–2026" /></ScrollReveal>
        <ScrollReveal delay={60}><StatCard label="Total value" value={`RM ${MKT.valueBn} bn`} sub="sum of all sale prices" accent={C.earth} /></ScrollReveal>
        <ScrollReveal delay={120}><StatCard label="Median price" value={mRM(MKT.medianPrice)} sub="mean RM 499,460" /></ScrollReveal>
        <ScrollReveal delay={180}><StatCard label="Median unit price" value={`RM ${mFmt(MKT.medianPpm)}`} sub="per m² · ≈ RM 334 psf" /></ScrollReveal>
        <ScrollReveal delay={240}><StatCard label="Freehold share" value={`${MKT.freehold}%`} sub={`Leasehold ${MKT.leasehold}%`} accent={C.up} /></ScrollReveal>
      </div>

      <ScrollReveal>
        <ChartCard title="Average price by state" note="toggle map / ranking · drag / scroll to explore the map">
          <div className="flex items-baseline gap-2.5 flex-wrap mt-0.5 mb-0.5">
            <span className="text-[10.5px] font-semibold tracking-[0.08em] uppercase text-[#DCD7C9] bg-[#A27B5C] px-2.5 py-0.5 rounded-full">
              Highest
            </span>
            <span className="font-display text-[20px] font-medium text-[#2C3930]">{STATE_HIGH[0]}</span>
            <span className="font-mono text-[17px] font-medium text-[#A27B5C]">{mRM(STATE_HIGH[1])} avg</span>
            <span className="font-sans text-[12px] text-[#3F4F44]">
              · median {mRM(STATE_HIGH[2])} across {mFmt(STATE_HIGH[3])} transactions
            </span>
          </div>
          <StatePriceMorph />
        </ChartCard>
      </ScrollReveal>

      <ScrollReveal>
        <div className="grid grid-cols-2 gap-[18px] max-[980px]:grid-cols-1">
          <ChartCard title="Transaction volume" note="quarterly · 2024 Q4 onward still being reported">
            <ReactECharts option={volOption} style={{ height: 300 }} opts={chartOpts} />
            <p className="mt-2 font-sans text-[11.5px] text-[#3F4F44] leading-relaxed">
              The market ran at ~30,000 sales a quarter through 2022–2024. The shaded tail is provisional —
              NAPIC registers transactions with a lag, so recent quarters understate true activity.
            </p>
          </ChartCard>
          <ChartCard title="Average house price" note="Malaysia · quarterly · 2000–2025 · NAPIC">
            <ReactECharts option={priceOption} style={{ height: 300 }} opts={chartOpts} />
            <p className="mt-2 font-sans text-[11.5px] text-[#3F4F44] leading-relaxed">
              The mean residential price climbed from ~RM135k in 2000 to ~RM511k by 2025 — a 3.8× rise, with
              the steepest run-up over 2010–2015 and a gentler, steady grind since.
            </p>
          </ChartCard>
        </div>
      </ScrollReveal>

      <ScrollReveal>
        <Eyebrow style={{ margin: '0 0 6px' }}>Filter by state — applies to every chart below</Eyebrow>
        <StateFilterBar value={stateFilter} onChange={setStateFilter} />
        <div
          className="rounded-b-2xl rounded-tr-2xl p-4 sm:p-5"
          style={{ background: C.raised, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.deep}` }}
        >
          <div className="grid grid-cols-2 gap-[18px] max-[980px]:grid-cols-1 mb-[18px]">
            <ChartCard title="Price distribution" note={`count by RM band · ${stateLabel(stateFilter)}`}>
              <ReactECharts option={histOption} style={{ height: 240 }} opts={chartOpts} />
            </ChartCard>
            <ChartCard title="Tenure" note={`freehold vs leasehold · ${stateLabel(stateFilter)}`}>
              <ReactECharts option={tenureOption} style={{ height: 240 }} opts={chartOpts} />
            </ChartCard>
          </div>
          <div className="grid grid-cols-2 gap-[18px] max-[980px]:grid-cols-1">
            <ChartCard title="Transactions by property type" note={`${mFmt(ptypeTotal)} txns · ${stateLabel(stateFilter)}`}>
              <ReactECharts option={ptypeCountOption} style={{ height: 320 }} opts={chartOpts} />
            </ChartCard>
            <ChartCard title="Median price by property type" note={`RM, secondary market · ${stateLabel(stateFilter)}`}>
              <ReactECharts option={ptypePriceOption} style={{ height: 320 }} opts={chartOpts} />
            </ChartCard>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal>
        <ChartCard title="Top districts by transaction volume" note="Klang Valley + Johor lead">
          <ReactECharts option={distOption} style={{ height: 360 }} opts={chartOpts} />
        </ChartCard>
      </ScrollReveal>
    </div>
  )
}
