import { useState, useMemo, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { Card } from '@/components/ui/card'
import { ScrollReveal } from '@/components/shared'
import { C } from '@/lib/colors'
import { API } from '@/lib/api'
import { MKT_YOY } from '@/lib/napicPrices'
import {
  chartAreaGrad,
  chartAxisLine,
  chartAxisPointerLine,
  chartAxisPointerShadow,
  chartCategoryAxisLabel,
  chartDataZoomSlider,
  chartOpts,
  chartSplitLine,
  chartTooltip,
  chartValueAxisLabel,
  withChartBase,
} from '@/lib/chartTheme'

// ---- Static data ------------------------------------------------------------
const HCR_LATEST = {
  period: '2025 Q3',
  probability: 0.1718,
  regime: 'low',
}

const HCR_INDICATORS = [
  { key: 'sales_vol_yoy', label: 'Transaction volume YoY', desc: 'Number of residential properties sold each quarter, shown as year-on-year (YoY) growth. Represents the housing demand of the period.', unit: '%', chart: 'bar', values: [{ period: '2023 Q4', value: 10.46 }, { period: '2024 Q1', value: 16.61 }, { period: '2024 Q2', value: -3.20 }, { period: '2024 Q3', value: 2.70 }, { period: '2024 Q4', value: 1.63 }, { period: '2025 Q1', value: -5.61 }, { period: '2025 Q2', value: 3.26 }, { period: '2025 Q3', value: -5.16 }] },
  { key: 'unsold_co', label: 'Completed unsold units', desc: 'Completed but unsold units — the market overhang. A direct indication of excess supply.', unit: ' units', chart: 'line', values: [{ period: '2023 Q4', value: 25816.00 }, { period: '2024 Q1', value: 24208.00 }, { period: '2024 Q2', value: 22642.00 }, { period: '2024 Q3', value: 21968.00 }, { period: '2024 Q4', value: 23149.00 }, { period: '2025 Q1', value: 23515.00 }, { period: '2025 Q2', value: 26911.00 }, { period: '2025 Q3', value: 28672.00 }] },
  { key: 'unsold_uc', label: 'Under-construction unsold units', desc: 'Unsold units still under construction. Also a supply signal, but milder than overhang — these are still in the midst of being marketed.', unit: ' units', chart: 'line', values: [{ period: '2023 Q4', value: 51132.00 }, { period: '2024 Q1', value: 54320.00 }, { period: '2024 Q2', value: 57934.00 }, { period: '2024 Q3', value: 60552.00 }, { period: '2024 Q4', value: 60934.00 }, { period: '2025 Q1', value: 62753.00 }, { period: '2025 Q2', value: 65033.00 }, { period: '2025 Q3', value: 69356.00 }] },
  { key: 'planned_supply_yoy', label: 'Planned supply YoY', desc: 'Incoming residential supply approved to enter the market, shown as YoY change. Signals future supply and hence potential downward pressure on future prices.', unit: '%', chart: 'bar', values: [{ period: '2023 Q4', value: -4.55 }, { period: '2024 Q1', value: -0.47 }, { period: '2024 Q2', value: 4.39 }, { period: '2024 Q3', value: 6.93 }, { period: '2024 Q4', value: 3.57 }, { period: '2025 Q1', value: -3.20 }, { period: '2025 Q2', value: -20.01 }, { period: '2025 Q3', value: -37.07 }] },
  { key: 'impaired_ratio', label: 'Property loan impaired ratio', desc: 'Loans that have missed repayment as a percentage of all outstanding residential loans. Indicates the credit risk of the property market (potential for a housing bubble).', unit: '%', chart: 'line', values: [{ period: '2023 Q4', value: 1.36 }, { period: '2024 Q1', value: 1.34 }, { period: '2024 Q2', value: 1.32 }, { period: '2024 Q3', value: 1.25 }, { period: '2024 Q4', value: 1.20 }, { period: '2025 Q1', value: 1.17 }, { period: '2025 Q2', value: 1.14 }, { period: '2025 Q3', value: 1.12 }] },
  { key: 'credit_gdp_yoy', label: 'Credit-to-GDP YoY', desc: 'Outstanding household loans relative to annual GDP, shown as quarterly YoY change. A measure of household indebtedness and hence another indication of credit risk.', unit: '%', chart: 'bar', values: [{ period: '2023 Q4', value: 3.24 }, { period: '2024 Q1', value: 3.65 }, { period: '2024 Q2', value: 1.22 }, { period: '2024 Q3', value: -1.21 }, { period: '2024 Q4', value: -1.38 }, { period: '2025 Q1', value: -1.20 }, { period: '2025 Q2', value: 0.25 }, { period: '2025 Q3', value: 1.86 }] },
]

const HCR_CYCLE = [
  { period: '1989 Q1', year: 1989.00, cyc: 6.87, pos: 1 },
  { period: '1989 Q2', year: 1989.25, cyc: 4.08, pos: 1 },
  { period: '1989 Q3', year: 1989.50, cyc: 1.29, pos: 1 },
  { period: '1989 Q4', year: 1989.75, cyc: -1.51, pos: 0 },
  { period: '1990 Q1', year: 1990.00, cyc: -3.18, pos: 0 },
  { period: '1990 Q2', year: 1990.25, cyc: -6.32, pos: 0 },
  { period: '1990 Q3', year: 1990.50, cyc: -8.81, pos: 0 },
  { period: '1990 Q4', year: 1990.75, cyc: -4.43, pos: 0 },
  { period: '1991 Q1', year: 1991.00, cyc: -0.42, pos: 0 },
  { period: '1991 Q2', year: 1991.25, cyc: 3.33, pos: 1 },
  { period: '1991 Q3', year: 1991.50, cyc: 2.69, pos: 1 },
  { period: '1991 Q4', year: 1991.75, cyc: 2.02, pos: 1 },
  { period: '1992 Q1', year: 1992.00, cyc: 2.74, pos: 1 },
  { period: '1992 Q2', year: 1992.25, cyc: 3.12, pos: 1 },
  { period: '1992 Q3', year: 1992.50, cyc: 1.08, pos: 1 },
  { period: '1992 Q4', year: 1992.75, cyc: -0.58, pos: 0 },
  { period: '1993 Q1', year: 1993.00, cyc: -1.85, pos: 0 },
  { period: '1993 Q2', year: 1993.25, cyc: -4.16, pos: 0 },
  { period: '1993 Q3', year: 1993.50, cyc: -6.67, pos: 0 },
  { period: '1993 Q4', year: 1993.75, cyc: -7.77, pos: 0 },
  { period: '1994 Q1', year: 1994.00, cyc: -6.71, pos: 0 },
  { period: '1994 Q2', year: 1994.25, cyc: -10.37, pos: 0 },
  { period: '1994 Q3', year: 1994.50, cyc: -9.60, pos: 0 },
  { period: '1994 Q4', year: 1994.75, cyc: -5.20, pos: 0 },
  { period: '1995 Q1', year: 1995.00, cyc: -0.20, pos: 0 },
  { period: '1995 Q2', year: 1995.25, cyc: 2.11, pos: 1 },
  { period: '1995 Q3', year: 1995.50, cyc: 4.00, pos: 1 },
  { period: '1995 Q4', year: 1995.75, cyc: 7.05, pos: 1 },
  { period: '1996 Q1', year: 1996.00, cyc: 11.34, pos: 1 },
  { period: '1996 Q2', year: 1996.25, cyc: 13.37, pos: 1 },
  { period: '1996 Q3', year: 1996.50, cyc: 14.02, pos: 1 },
  { period: '1996 Q4', year: 1996.75, cyc: 14.74, pos: 1 },
  { period: '1997 Q1', year: 1997.00, cyc: 16.98, pos: 1 },
  { period: '1997 Q2', year: 1997.25, cyc: 15.63, pos: 1 },
  { period: '1997 Q3', year: 1997.50, cyc: 10.80, pos: 1 },
  { period: '1997 Q4', year: 1997.75, cyc: 4.21, pos: 1 },
  { period: '1998 Q1', year: 1998.00, cyc: 2.22, pos: 1 },
  { period: '1998 Q2', year: 1998.25, cyc: -4.07, pos: 0 },
  { period: '1998 Q3', year: 1998.50, cyc: -9.31, pos: 0 },
  { period: '1998 Q4', year: 1998.75, cyc: -8.72, pos: 0 },
  { period: '1999 Q1', year: 1999.00, cyc: -10.47, pos: 0 },
  { period: '1999 Q2', year: 1999.25, cyc: -10.68, pos: 0 },
  { period: '1999 Q3', year: 1999.50, cyc: -9.11, pos: 0 },
  { period: '1999 Q4', year: 1999.75, cyc: -5.76, pos: 0 },
  { period: '2000 Q1', year: 2000.00, cyc: -4.30, pos: 0 },
  { period: '2000 Q2', year: 2000.25, cyc: -1.12, pos: 0 },
  { period: '2000 Q3', year: 2000.50, cyc: -1.09, pos: 0 },
  { period: '2000 Q4', year: 2000.75, cyc: -0.59, pos: 0 },
  { period: '2001 Q1', year: 2001.00, cyc: -2.02, pos: 0 },
  { period: '2001 Q2', year: 2001.25, cyc: -2.23, pos: 0 },
  { period: '2001 Q3', year: 2001.50, cyc: -2.05, pos: 0 },
  { period: '2001 Q4', year: 2001.75, cyc: -2.16, pos: 0 },
  { period: '2002 Q1', year: 2002.00, cyc: -2.35, pos: 0 },
  { period: '2002 Q2', year: 2002.25, cyc: -1.48, pos: 0 },
  { period: '2002 Q3', year: 2002.50, cyc: -0.83, pos: 0 },
  { period: '2002 Q4', year: 2002.75, cyc: 1.43, pos: 1 },
  { period: '2003 Q1', year: 2003.00, cyc: 0.90, pos: 1 },
  { period: '2003 Q2', year: 2003.25, cyc: -1.23, pos: 0 },
  { period: '2003 Q3', year: 2003.50, cyc: 2.29, pos: 1 },
  { period: '2003 Q4', year: 2003.75, cyc: 2.76, pos: 1 },
  { period: '2004 Q1', year: 2004.00, cyc: 4.75, pos: 1 },
  { period: '2004 Q2', year: 2004.25, cyc: 3.11, pos: 1 },
  { period: '2004 Q3', year: 2004.50, cyc: 1.63, pos: 1 },
  { period: '2004 Q4', year: 2004.75, cyc: 2.06, pos: 1 },
  { period: '2005 Q1', year: 2005.00, cyc: 3.09, pos: 1 },
  { period: '2005 Q2', year: 2005.25, cyc: 3.81, pos: 1 },
  { period: '2005 Q3', year: 2005.50, cyc: 1.01, pos: 1 },
  { period: '2005 Q4', year: 2005.75, cyc: 1.21, pos: 1 },
  { period: '2006 Q1', year: 2006.00, cyc: 1.83, pos: 1 },
  { period: '2006 Q2', year: 2006.25, cyc: 0.69, pos: 1 },
  { period: '2006 Q3', year: 2006.50, cyc: -1.08, pos: 0 },
  { period: '2006 Q4', year: 2006.75, cyc: 3.65, pos: 1 },
  { period: '2007 Q1', year: 2007.00, cyc: 4.35, pos: 1 },
  { period: '2007 Q2', year: 2007.25, cyc: 2.10, pos: 1 },
  { period: '2007 Q3', year: 2007.50, cyc: 1.77, pos: 1 },
  { period: '2007 Q4', year: 2007.75, cyc: 1.70, pos: 1 },
  { period: '2008 Q1', year: 2008.00, cyc: 4.73, pos: 1 },
  { period: '2008 Q2', year: 2008.25, cyc: 1.74, pos: 1 },
  { period: '2008 Q3', year: 2008.50, cyc: 2.30, pos: 1 },
  { period: '2008 Q4', year: 2008.75, cyc: -3.16, pos: 0 },
  { period: '2009 Q1', year: 2009.00, cyc: -4.42, pos: 0 },
  { period: '2009 Q2', year: 2009.25, cyc: -4.50, pos: 0 },
  { period: '2009 Q3', year: 2009.50, cyc: -5.95, pos: 0 },
  { period: '2009 Q4', year: 2009.75, cyc: -6.39, pos: 0 },
  { period: '2010 Q1', year: 2010.00, cyc: -8.40, pos: 0 },
  { period: '2010 Q2', year: 2010.25, cyc: -6.91, pos: 0 },
  { period: '2010 Q3', year: 2010.50, cyc: -8.96, pos: 0 },
  { period: '2010 Q4', year: 2010.75, cyc: -7.99, pos: 0 },
  { period: '2011 Q1', year: 2011.00, cyc: -7.71, pos: 0 },
  { period: '2011 Q2', year: 2011.25, cyc: -8.38, pos: 0 },
  { period: '2011 Q3', year: 2011.50, cyc: -9.13, pos: 0 },
  { period: '2011 Q4', year: 2011.75, cyc: -5.53, pos: 0 },
  { period: '2012 Q1', year: 2012.00, cyc: -2.30, pos: 0 },
  { period: '2012 Q2', year: 2012.25, cyc: -1.49, pos: 0 },
  { period: '2012 Q3', year: 2012.50, cyc: -2.98, pos: 0 },
  { period: '2012 Q4', year: 2012.75, cyc: 3.91, pos: 1 },
  { period: '2013 Q1', year: 2013.00, cyc: -0.61, pos: 0 },
  { period: '2013 Q2', year: 2013.25, cyc: 1.76, pos: 1 },
  { period: '2013 Q3', year: 2013.50, cyc: 5.39, pos: 1 },
  { period: '2013 Q4', year: 2013.75, cyc: 2.82, pos: 1 },
  { period: '2014 Q1', year: 2014.00, cyc: 0.95, pos: 1 },
  { period: '2014 Q2', year: 2014.25, cyc: 3.88, pos: 1 },
  { period: '2014 Q3', year: 2014.50, cyc: 5.01, pos: 1 },
  { period: '2014 Q4', year: 2014.75, cyc: 2.63, pos: 1 },
  { period: '2015 Q1', year: 2015.00, cyc: 3.20, pos: 1 },
  { period: '2015 Q2', year: 2015.25, cyc: 0.66, pos: 1 },
  { period: '2015 Q3', year: 2015.50, cyc: 2.25, pos: 1 },
  { period: '2015 Q4', year: 2015.75, cyc: -0.69, pos: 0 },
  { period: '2016 Q1', year: 2016.00, cyc: 3.68, pos: 1 },
  { period: '2016 Q2', year: 2016.25, cyc: 1.77, pos: 1 },
  { period: '2016 Q3', year: 2016.50, cyc: 3.65, pos: 1 },
  { period: '2016 Q4', year: 2016.75, cyc: 2.33, pos: 1 },
  { period: '2017 Q1', year: 2017.00, cyc: 7.31, pos: 1 },
  { period: '2017 Q2', year: 2017.25, cyc: 7.09, pos: 1 },
  { period: '2017 Q3', year: 2017.50, cyc: 9.23, pos: 1 },
  { period: '2017 Q4', year: 2017.75, cyc: 7.76, pos: 1 },
  { period: '2018 Q1', year: 2018.00, cyc: 7.18, pos: 1 },
  { period: '2018 Q2', year: 2018.25, cyc: 5.53, pos: 1 },
  { period: '2018 Q3', year: 2018.50, cyc: 5.17, pos: 1 },
  { period: '2018 Q4', year: 2018.75, cyc: 3.82, pos: 1 },
  { period: '2019 Q1', year: 2019.00, cyc: 4.14, pos: 1 },
  { period: '2019 Q2', year: 2019.25, cyc: 2.58, pos: 1 },
  { period: '2019 Q3', year: 2019.50, cyc: 2.22, pos: 1 },
  { period: '2019 Q4', year: 2019.75, cyc: -0.03, pos: 0 },
  { period: '2020 Q1', year: 2020.00, cyc: 1.23, pos: 1 },
  { period: '2020 Q2', year: 2020.25, cyc: -1.96, pos: 0 },
  { period: '2020 Q3', year: 2020.50, cyc: -7.24, pos: 0 },
  { period: '2020 Q4', year: 2020.75, cyc: -5.08, pos: 0 },
  { period: '2021 Q1', year: 2021.00, cyc: -5.97, pos: 0 },
  { period: '2021 Q2', year: 2021.25, cyc: -7.80, pos: 0 },
  { period: '2021 Q3', year: 2021.50, cyc: -13.32, pos: 0 },
  { period: '2021 Q4', year: 2021.75, cyc: -7.78, pos: 0 },
  { period: '2022 Q1', year: 2022.00, cyc: -6.84, pos: 0 },
  { period: '2022 Q2', year: 2022.25, cyc: -8.03, pos: 0 },
  { period: '2022 Q3', year: 2022.50, cyc: -3.11, pos: 0 },
  { period: '2022 Q4', year: 2022.75, cyc: -3.03, pos: 0 },
  { period: '2023 Q1', year: 2023.00, cyc: 1.71, pos: 1 },
  { period: '2023 Q2', year: 2023.25, cyc: -1.87, pos: 0 },
  { period: '2023 Q3', year: 2023.50, cyc: -1.59, pos: 0 },
  { period: '2023 Q4', year: 2023.75, cyc: 0.88, pos: 1 },
  { period: '2024 Q1', year: 2024.00, cyc: 4.21, pos: 1 },
  { period: '2024 Q2', year: 2024.25, cyc: 3.19, pos: 1 },
  { period: '2024 Q3', year: 2024.50, cyc: 4.58, pos: 1 },
  { period: '2024 Q4', year: 2024.75, cyc: 7.73, pos: 1 },
  { period: '2025 Q1', year: 2025.00, cyc: 7.05, pos: 1 },
  { period: '2025 Q2', year: 2025.25, cyc: 3.60, pos: 1 },
  { period: '2025 Q3', year: 2025.50, cyc: -9.14, pos: 0 },
]

// Each phase gets a `short` tag drawn on top of its band, the full `label`
// (tooltip title), a `desc` helper shown on hover, and a `row` (0 = top line,
// 1 = dropped one line) so tightly-spaced tags don't collide.
const HCR_PERIODS = [
  { from: 1997.5, to: 1999.0, row: 0, short: 'AFC', label: 'Asian Financial Crisis',
    desc: 'Regional currency and asset collapse pulled prices sharply below their long-run trend.' },
  { from: 2008.5, to: 2009.5, row: 0, short: 'GFC', label: 'Global Financial Crisis',
    desc: 'The global credit crunch briefly dented demand and prices dipped under trend.' },
  { from: 2010.75, to: 2011.75, row: 0, short: 'LTV cap', label: 'LTV restriction on 3rd+ housing loans',
    desc: 'Bank Negara capped the loan-to-value ratio at 70% on third and subsequent housing loans to rein in speculative buying.' },
  { from: 2011.0, to: 2013.75, row: 1, short: 'Housing boom', label: 'Housing boom',
    desc: 'A stretch of rapid price appreciation that pushed the cycle well above its trend line.' },
  { from: 2014.0, to: 2016.75, row: 0, short: 'Cooling', label: 'Cooling measures / RPGT tightening',
    desc: 'Higher Real Property Gains Tax and tighter lending brought prices back down toward trend.' },
  { from: 2020.0, to: 2021.75, row: 0, short: 'COVID-19', label: 'COVID-19 disruption',
    desc: 'Pandemic lockdowns froze transaction activity and briefly pushed prices below trend.' },
  { from: 2022.25, to: 2024.75, row: 1, short: 'Recovery', label: 'Post-pandemic housing recovery',
    desc: 'Reopening and low interest rates drove a rebound back toward and above trend.' },
]

// ---- Helper functions -------------------------------------------------------
const hcrNum = (v, unit = '') => {
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('en-MY') + unit
  return v.toFixed(Math.abs(v) < 10 ? 2 : 1) + unit
}
const hcrQuarter = (p) => {
  if (p.period) return p.period
  const year = Math.floor(p.year)
  const q = Math.max(1, Math.min(4, Math.floor((p.year - year) * 4 + 1.05)))
  return `${year} Q${q}`
}
const hcrPhasesForYear = (year) => HCR_PERIODS.filter(e => year >= e.from && year <= e.to)
// nearest HCR_CYCLE quarter label to a fractional year. Both cycle-page charts
// pin their crisis-event bands through this + the shared HCR_CYCLE period axis,
// so a given event sits at the same x on both — they line up vertically.
const hcrPeriodAtYear = (yr) => {
  let best = HCR_CYCLE[0]
  for (const p of HCR_CYCLE) if (Math.abs(p.year - yr) < Math.abs(best.year - yr)) best = p
  return best.period
}

// ---- RegimePanel — the housing cycle gauge ---------------------------------
const RegimePanel = ({ latest }) => {
  const p = Math.max(0, Math.min(1, latest.probability ?? HCR_LATEST.probability))
  const high = p > 0.5
  return (
    <Card className="p-6">
      <div className="flex justify-between gap-4 items-start flex-wrap">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C]">Housing cycle signal</p>
          <span className="font-display text-[34px] font-medium text-[#2C3930] block mt-2">
            House prices are currently{' '}
            <span className={`font-bold ${high ? 'text-[#A63228]' : 'text-[#2D7A4F]'}`}>{high ? 'HIGH' : 'LOW'}</span>
          </span>
          <p className="mt-2 text-sm text-[#3F4F44]">
            Current prediction for dependent variable <code className="font-mono text-xs">cycle_pos = 1</code> at {latest.period || HCR_LATEST.period}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C]">Housing cycle index score</p>
          <span className={`font-mono text-[34px] font-medium ${high ? 'text-[#A63228]' : 'text-[#2D7A4F]'}`}>{p.toFixed(3)}</span>
        </div>
      </div>

      {/* Gauge bar */}
      <div className="mt-6">
        <div
          className="relative h-8 rounded-full border border-[#C8C3B8] shadow-inner overflow-visible"
          style={{ background: `linear-gradient(90deg, #2D7A4F 0%, #f4f1ea 50%, #A63228 100%)` }}
        >
          <div
            className="absolute top-[-7px] w-4 h-12 rounded-full bg-[#2C3930]"
            style={{ left: `calc(${p * 100}% - 8px)`, boxShadow: `0 0 0 4px #EDE9E1, 0 8px 24px ${high ? '#A63228' : '#2D7A4F'}88` }}
          />
        </div>
        <div className="mt-2 grid grid-cols-3 font-mono text-[11px] text-[#3F4F44]">
          <span>0.00 low-price regime</span>
          <span className="text-center">0.50 neutral threshold</span>
          <span className="text-right">1.00 high-price regime</span>
        </div>
      </div>
    </Card>
  )
}

// ---- CycleComponentChart ---------------------------------------------------
const CycleComponentChart = () => {
  const option = useMemo(() => withChartBase({
    grid: { left: 52, right: 22, top: 22, bottom: 78 },
    tooltip: {
      trigger: 'axis',
      ...chartTooltip(),
      axisPointer: chartAxisPointerLine,
      formatter: (ps) => {
        const p = ps.find(x => x.seriesName === 'cycle') || ps[0]
        const v = +p.data
        const period = p.axisValue
        const yy = parseInt(period, 10)
        const q = parseInt(period.split('Q')[1], 10) || 1
        const phases = hcrPhasesForYear(yy + (q - 1) * 0.25)
        const above = v >= 0
        return (
          `<div style="font-family:'JetBrains Mono',monospace;font-size:12px">${period}</div>` +
          `<div style="margin-top:4px">Cycle: <b>${above ? '+' : ''}${v.toFixed(2)}k</b></div>` +
          `<div>${above ? 'Above trend / upward pressure' : 'Below trend / low-price pressure'}</div>` +
          phases.map(e => (
            `<div style="margin-top:6px;color:${C.earthLight};font-weight:600">${e.label}</div>` +
            `<div style="max-width:230px;white-space:normal;font-size:11px;line-height:1.45;opacity:0.85">${e.desc}</div>`
          )).join('')
        )
      },
    },
    xAxis: {
      type: 'category',
      data: HCR_CYCLE.map(p => p.period),
      boundaryGap: false,
      axisLine: chartAxisLine,
      axisTick: { show: false },
      axisLabel: {
        ...chartValueAxisLabel(),
        interval: (i, v) => v.endsWith('Q1') && parseInt(v, 10) % 5 === 0,
        formatter: (v) => v.split(' ')[0],
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { ...chartValueAxisLabel(), formatter: (v) => (v > 0 ? '+' : '') + v },
      splitLine: chartSplitLine,
    },
    dataZoom: [chartDataZoomSlider()],
    series: [
      // green fill above the zero line
      {
        name: 'pos', type: 'line', silent: true, showSymbol: false, z: 1,
        data: HCR_CYCLE.map(p => (p.cyc >= 0 ? +p.cyc.toFixed(2) : 0)),
        lineStyle: { width: 0 }, areaStyle: { color: 'rgba(45,122,79,0.22)', origin: 0 },
      },
      // red fill below the zero line
      {
        name: 'neg', type: 'line', silent: true, showSymbol: false, z: 1,
        data: HCR_CYCLE.map(p => (p.cyc <= 0 ? +p.cyc.toFixed(2) : 0)),
        lineStyle: { width: 0 }, areaStyle: { color: 'rgba(166,50,40,0.20)', origin: 0 },
      },
      // the cyclical line itself + zero line + historical-context bands
      {
        name: 'cycle', type: 'line', showSymbol: false, symbol: 'circle', symbolSize: 7, z: 3,
        data: HCR_CYCLE.map(p => +p.cyc.toFixed(2)),
        lineStyle: { color: C.deep, width: 1.8 }, emphasis: { focus: 'series', scale: 1.4 },
        markLine: {
          silent: true, symbol: 'none', label: { show: false },
          lineStyle: { color: C.deep, width: 1.2 }, data: [{ yAxis: 0 }],
        },
        markArea: {
          silent: true, itemStyle: { color: C.earth, opacity: 0.07 },
          // short phase tag pinned to the top of each band — the same deep-green
          // pill / cream text as the toggles elsewhere in the app (crisp ~9:1).
          // Row-1 tags drop via a label offset so tight neighbours don't collide.
          label: {
            show: true, position: 'insideTop', distance: 6,
            color: C.cream, backgroundColor: C.deep,
            padding: [3, 8], borderRadius: 6,
            fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
            shadowBlur: 5, shadowColor: 'rgba(44,57,48,0.30)', shadowOffsetY: 1,
          },
          data: HCR_PERIODS.map(e => [
            { xAxis: hcrPeriodAtYear(e.from), name: e.short, label: e.row ? { offset: [0, 24] } : undefined },
            { xAxis: hcrPeriodAtYear(e.to) },
          ]),
        },
      },
    ],
  }), [])

  return (
    <Card className="p-6">
      <div className="flex justify-between items-baseline gap-3 mb-1">
        <span className="font-display text-[22px] font-medium text-[#2C3930]">HP-filter cyclical component</span>
        <span className="text-xs text-[#3F4F44]">Mean price minus HP trend, RM '000 · drag the slider to zoom</span>
      </div>
      <ReactECharts option={option} style={{ height: 360 }} opts={chartOpts} />
    </Card>
  )
}

// ---- PriceGrowthChart — NAPIC mean-price YoY growth, annotated with the same
// crisis-event bands as the cyclical component above -------------------------
const PriceGrowthChart = () => {
  // Share the cyclical chart's exact 1989–2025 quarter axis so the crisis-event
  // bands line up vertically between the two charts. The NAPIC price series only
  // starts in 2000, so YoY is null before 2001 Q1 (blank on the left).
  const periods = HCR_CYCLE.map(p => p.period)
  const yoyByPeriod = Object.fromEntries(MKT_YOY.map(d => [d[0], d[1]]))
  const data = periods.map(p => {
    const v = yoyByPeriod[p]
    return v == null ? null : +v.toFixed(2)
  })

  const option = useMemo(() => withChartBase({
    grid: { left: 52, right: 22, top: 22, bottom: 78 },
    tooltip: {
      trigger: 'axis',
      ...chartTooltip(),
      axisPointer: chartAxisPointerLine,
      formatter: (ps) => {
        const p = ps.find(x => x.seriesName === 'yoy') || ps[0]
        const period = p.axisValue
        const v = p.data
        if (v == null) {
          return `<div style="font-family:'JetBrains Mono',monospace;font-size:12px">${period}</div>` +
            `<div style="margin-top:4px;opacity:0.8">Price series starts 2000</div>`
        }
        const yy = parseInt(period, 10)
        const q = parseInt(period.split('Q')[1], 10) || 1
        const active = hcrPhasesForYear(yy + (q - 1) * 0.25)
        return (
          `<div style="font-family:'JetBrains Mono',monospace;font-size:12px">${period}</div>` +
          `<div style="margin-top:4px">YoY growth: <b>${v >= 0 ? '+' : ''}${v.toFixed(1)}%</b></div>` +
          active.map(e => (
            `<div style="margin-top:6px;color:${C.earthLight};font-weight:600">${e.label}</div>` +
            `<div style="max-width:230px;white-space:normal;font-size:11px;line-height:1.45;opacity:0.85">${e.desc}</div>`
          )).join('')
        )
      },
    },
    xAxis: {
      type: 'category',
      data: periods,
      boundaryGap: false,
      axisLine: chartAxisLine,
      axisTick: { show: false },
      axisLabel: {
        ...chartValueAxisLabel(),
        interval: (i, v) => v.endsWith('Q1') && parseInt(v, 10) % 5 === 0,
        formatter: (v) => v.split(' ')[0],
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { ...chartValueAxisLabel(), formatter: (v) => (v > 0 ? '+' : '') + v + '%' },
      splitLine: chartSplitLine,
    },
    dataZoom: [chartDataZoomSlider()],
    series: [{
      // NAPIC YoY growth stays positive across the whole 2001–2025 span, so a
      // single green line reads cleanly; the dashed zero line marks the floor.
      name: 'yoy', type: 'line', smooth: true, showSymbol: false, symbol: 'circle', symbolSize: 7, z: 3,
      connectNulls: false,
      data,
      lineStyle: { color: C.up, width: 1.8 },
      areaStyle: { color: chartAreaGrad(C.up, 0.26, 0.02) },
      emphasis: { focus: 'series', scale: 1.4 },
      markLine: {
        silent: true, symbol: 'none', label: { show: false },
        lineStyle: { color: C.deep, width: 1.2 }, data: [{ yAxis: 0 }],
      },
      markArea: {
        silent: true, itemStyle: { color: C.earth, opacity: 0.07 },
        // same deep-green pill / cream text as the cyclical-component bands;
        // row-1 tags drop via a label offset so tight neighbours don't collide.
        label: {
          show: true, position: 'insideTop', distance: 6,
          color: C.cream, backgroundColor: C.deep,
          padding: [3, 8], borderRadius: 6,
          fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
          shadowBlur: 5, shadowColor: 'rgba(44,57,48,0.30)', shadowOffsetY: 1,
        },
        data: HCR_PERIODS.map(e => [
          { xAxis: hcrPeriodAtYear(e.from), name: e.short, label: e.row ? { offset: [0, 24] } : undefined },
          { xAxis: hcrPeriodAtYear(e.to) },
        ]),
      },
    }],
  }), [])

  return (
    <Card className="p-6">
      <div className="flex justify-between items-baseline gap-3 mb-1">
        <span className="font-display text-[22px] font-medium text-[#2C3930]">House price growth (YoY)</span>
        <span className="text-xs text-[#3F4F44]">Mean price, % change vs a year earlier · NAPIC · drag the slider to zoom</span>
      </div>
      <ReactECharts option={option} style={{ height: 360 }} opts={chartOpts} />
    </Card>
  )
}

// ---- IndicatorChart — one mini-chart per indicator -------------------------
const IndicatorChart = ({ ind }) => {
  const vals = ind.values
  const latest = vals[vals.length - 1]
  const prev = vals[vals.length - 2] || vals[0]
  const up = latest.value >= prev.value
  const accent = up ? C.down : C.up
  const base = C.earth

  const option = useMemo(() => {
    const periods = vals.map(v => v.period)
    const data = vals.map(v => +v.value)
    const lastIdx = vals.length - 1
    const common = withChartBase({
      grid: { left: 8, right: 12, top: 16, bottom: 22 },
      tooltip: {
        trigger: 'axis', ...chartTooltip({ padding: [8, 10] }),
        axisPointer: ind.chart === 'bar' ? chartAxisPointerShadow : chartAxisPointerLine,
        formatter: (ps) => {
          const p = ps[0]
          return `<div style="font-family:'JetBrains Mono',monospace;font-size:11px">${p.axisValue}</div>` +
            `<div style="margin-top:2px">${ind.label}: <b>${hcrNum(+p.data, ind.unit)}</b></div>`
        },
      },
      xAxis: {
        type: 'category', data: periods, boundaryGap: ind.chart === 'bar',
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: {
          ...chartValueAxisLabel({ color: C.muted, fontSize: 9 }),
          interval: (i) => i === 0 || i === lastIdx, formatter: (v) => v,
        },
      },
      yAxis: { type: 'value', show: false, scale: true },
    })
    if (ind.chart === 'bar') {
      return {
        ...common, series: [{
          type: 'bar', data, barWidth: '56%',
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: (p) => (p.dataIndex === lastIdx ? accent : 'rgba(162,123,92,0.45)'),
          },
          markLine: {
            silent: true, symbol: 'none', label: { show: false },
            lineStyle: { color: C.border, width: 1 }, data: [{ yAxis: 0 }],
          },
        }],
      }
    }
    return {
      ...common, series: [{
        type: 'line', data, smooth: true, showSymbol: false, symbol: 'circle',
        lineStyle: { color: base, width: 2 },
        areaStyle: { color: chartAreaGrad(C.earth, 0.30, 0.02) },
        emphasis: { focus: 'series' },
        markLine: {
          silent: true, symbol: 'none', label: { show: false },
          lineStyle: { color: C.border, width: 1 }, data: [{ yAxis: 0 }],
        },
        markPoint: {
          symbol: 'circle', symbolSize: 9, silent: true, label: { show: false },
          data: [{ coord: [lastIdx, latest.value], itemStyle: { color: accent } }],
        },
      }],
    }
  }, [ind, accent])

  return (
    <Card className="p-4">
      <div className="flex justify-between gap-2 items-baseline">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A27B5C]">{ind.key}</p>
          <span className="font-display text-[17px] font-medium text-[#2C3930] block mt-1">{ind.label}</span>
        </div>
        <span className="font-mono text-sm font-medium" style={{ color: accent }}>{hcrNum(latest.value, ind.unit)}</span>
      </div>
      <ReactECharts option={option} style={{ height: 124 }} opts={chartOpts} />
      {ind.desc && (
        <p className="mt-2.5 pt-2.5 border-t border-[#C8C3B8] text-xs text-[#3F4F44] leading-relaxed">{ind.desc}</p>
      )}
    </Card>
  )
}

// ---- SentimentPage ---------------------------------------------------------
export default function SentimentPage() {
  const [latest, setLatest] = useState(HCR_LATEST)

  useEffect(() => {
    let dead = false
    if (!API.hcrCurrent) return undefined
    API.hcrCurrent()
      .then(data => {
        if (!dead && data && typeof data.probability === 'number') {
          setLatest({
            period: data.period || HCR_LATEST.period,
            probability: data.probability,
            regime: data.regime || (data.probability > 0.5 ? 'high' : 'low'),
          })
        }
      })
      .catch(() => {})
    return () => { dead = true }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <ScrollReveal>
        <RegimePanel latest={latest} />
      </ScrollReveal>
      <ScrollReveal delay={80}>
        <CycleComponentChart />
      </ScrollReveal>
      <ScrollReveal delay={100}>
        <PriceGrowthChart />
      </ScrollReveal>
      <ScrollReveal delay={120}>
        <Card className="p-6">
          <div className="flex justify-between items-baseline gap-3 mb-4">
            <span className="font-display text-[22px] font-medium text-[#2C3930]">Recent two years of regression indicators</span>
            <span className="text-xs text-[#3F4F44]">Latest point glows red for uptrend, green for downtrend</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {HCR_INDICATORS.map((ind, i) => (
              <ScrollReveal key={ind.key} delay={i * 50}>
                <IndicatorChart ind={ind} />
              </ScrollReveal>
            ))}
          </div>
        </Card>
      </ScrollReveal>
    </div>
  )
}
