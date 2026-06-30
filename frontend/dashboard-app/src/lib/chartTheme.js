import * as echarts from 'echarts'
import { C } from './colors'

/** shadcn-style series palette — use for `color` on multi-series charts */
export const CHART_PALETTE = [C.earth, C.mid, C.light, C.up, C.earthLight, C.down, C.stable]

/** Choropleth / heat ramp (cream → earth → forest) */
export const CHART_RAMP = ['#EDE9E1', '#DCC2A6', '#CBA886', '#B98E66', '#9E7350', '#7C5639', '#5E3E26']

const FONTS = {
  sans: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
}

let registered = false

/** Register once at app boot — ReactECharts passes `theme: CHART_THEME` in opts */
export const CHART_THEME = 'mytanah'

export function registerChartTheme() {
  if (registered) return
  registered = true
  echarts.registerTheme(CHART_THEME, {
    color: CHART_PALETTE,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: FONTS.sans, color: C.mid },
    title: {
      textStyle: { color: C.deep, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500 },
    },
    line: {
      itemStyle: { borderWidth: 2 },
      lineStyle: { width: 2, cap: 'round', join: 'round' },
      symbolSize: 6,
      symbol: 'circle',
      smooth: false,
    },
    bar: {
      itemStyle: { barBorderWidth: 0, borderRadius: [6, 6, 0, 0] },
    },
    pie: {
      itemStyle: { borderColor: C.cream, borderWidth: 2 },
    },
    categoryAxis: {
      axisLine: { show: true, lineStyle: { color: C.border } },
      axisTick: { show: false },
      axisLabel: { color: C.mid, fontFamily: FONTS.mono, fontSize: 10 },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: C.mid, fontFamily: FONTS.mono, fontSize: 10 },
      splitLine: { lineStyle: { color: C.border, type: [3, 6], opacity: 0.65 } },
    },
    legend: {
      textStyle: { color: C.mid, fontFamily: FONTS.sans, fontSize: 11 },
      itemGap: 16,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
    },
    tooltip: {
      backgroundColor: C.deep,
      borderColor: C.border,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: C.cream, fontFamily: FONTS.sans, fontSize: 12 },
    },
  })
}

/** ECharts linear gradient helper */
export function chartGrad(x2, y2, colorTop, colorBottom) {
  return new echarts.graphic.LinearGradient(0, 0, x2, y2, [
    { offset: 0, color: colorTop },
    { offset: 1, color: colorBottom },
  ])
}

/** Area fill from a hex brand color */
export function chartAreaGrad(hex, opacityTop = 0.28, opacityBottom = 0) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return chartGrad(0, 1, `rgba(${r},${g},${b},${opacityTop})`, `rgba(${r},${g},${b},${opacityBottom})`)
}

export const chartOpts = { renderer: 'canvas', theme: CHART_THEME }

export const chartTooltip = (overrides = {}) => ({
  backgroundColor: C.deep,
  borderColor: C.border,
  borderWidth: 1,
  padding: [10, 12],
  extraCssText: 'border-radius: 8px; box-shadow: 0 4px 16px rgba(44,57,48,0.12);',
  textStyle: { color: C.cream, fontFamily: FONTS.sans, fontSize: 12 },
  ...overrides,
})

export const chartAxisPointerLine = {
  type: 'line',
  lineStyle: { color: C.earth, width: 1, type: [3, 4] },
}

export const chartAxisPointerShadow = {
  type: 'shadow',
  shadowStyle: { color: 'rgba(162,123,92,0.08)' },
}

export const chartValueAxisLabel = (overrides = {}) => ({
  color: C.mid,
  fontFamily: FONTS.mono,
  fontSize: 10,
  ...overrides,
})

export const chartCategoryAxisLabel = (overrides = {}) => ({
  color: C.deep,
  fontFamily: FONTS.sans,
  fontSize: 11,
  ...overrides,
})

export const chartAxisLine = { lineStyle: { color: C.border } }
export const chartSplitLine = { lineStyle: { color: C.border, type: [3, 6], opacity: 0.65 } }

export const chartLegend = (overrides = {}) => ({
  textStyle: { color: C.mid, fontFamily: FONTS.sans, fontSize: 11 },
  itemGap: 16,
  icon: 'roundRect',
  itemWidth: 12,
  itemHeight: 8,
  ...overrides,
})

export const chartGrid = (overrides = {}) => ({
  left: 56,
  right: 22,
  top: 28,
  bottom: 44,
  ...overrides,
})

export const chartLoading = {
  text: 'Loading…',
  textColor: C.mid,
  color: C.earth,
  maskColor: 'rgba(237,233,225,0.45)',
  fontSize: 12,
  fontFamily: FONTS.sans,
}

export const chartDataZoomSlider = (overrides = {}) => ({
  type: 'slider',
  bottom: 18,
  height: 20,
  borderColor: 'transparent',
  backgroundColor: 'rgba(200,195,184,0.14)',
  fillerColor: 'rgba(162,123,92,0.14)',
  borderRadius: 4,
  dataBackground: {
    lineStyle: { color: C.border, width: 1 },
    areaStyle: { color: 'rgba(162,123,92,0.06)' },
  },
  selectedDataBackground: {
    lineStyle: { color: C.earth, width: 1.2 },
    areaStyle: { color: 'rgba(162,123,92,0.16)' },
  },
  handleStyle: { color: C.cream, borderColor: C.earth, borderWidth: 1 },
  moveHandleStyle: { color: C.earthLight },
  textStyle: { color: C.mid, fontFamily: FONTS.mono, fontSize: 9 },
  ...overrides,
})

export const chartVisualMap = (overrides = {}) => ({
  type: 'continuous',
  orient: 'horizontal',
  left: 'center',
  bottom: 2,
  itemWidth: 10,
  itemHeight: 80,
  inRange: { color: CHART_RAMP },
  textStyle: { color: C.mid, fontFamily: FONTS.mono, fontSize: 9 },
  ...overrides,
})

export const chartBarRadius = {
  vertical: [6, 6, 0, 0],
  horizontal: [0, 6, 6, 0],
}

/** Merge transparent background + palette onto any option object */
export function withChartBase(option) {
  return {
    backgroundColor: 'transparent',
    color: CHART_PALETTE,
    ...option,
  }
}
