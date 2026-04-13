import ReactECharts from 'echarts-for-react'

/** Shared theme tokens derived from isDark flag */
function themeTokens(isDark) {
  return {
    textColor:    isDark ? '#94a3b8' : '#64748b',   // slate-400 / slate-500
    gridLine:     isDark ? '#1e293b' : '#e2e8f0',   // slate-800 / slate-200
    axisLine:     isDark ? '#334155' : '#cbd5e1',   // slate-700 / slate-300
    tooltipBg:    isDark ? '#0f172a' : '#ffffff',   // slate-950 / white
    tooltipBorder:isDark ? '#1e293b' : '#e2e8f0',
    tooltipText:  isDark ? '#f1f5f9' : '#0f172a',
  }
}

/**
 * RateChart — thin wrapper around ReactECharts.
 * Accepts a function `buildOption(tokens)` so the chart can rebuild its
 * ECharts option whenever the theme changes, without re-mounting.
 */
export default function RateChart({ buildOption, isDark, height = '320px' }) {
  const tokens  = themeTokens(isDark)
  const option  = buildOption(tokens)

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      opts={{ renderer: 'svg' }}
      notMerge
    />
  )
}

/** ── Pre-built option factories ─────────────────────────────────────────── */

/**
 * Term trend chart — single line connecting avg rates across:
 * Variable → Y1 → Y2 → Y3 → Y4 → Y5
 * Min/max band shown as a shaded area behind the line.
 */
export function buildTermTrendOption(summary) {
  const labels = ['Variable', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']

  const avgs = [
    summary.variable.avg,
    summary.fixed[1].avg, summary.fixed[2].avg,
    summary.fixed[3].avg, summary.fixed[4].avg, summary.fixed[5].avg,
  ]
  const mins = [
    summary.variable.min,
    summary.fixed[1].min, summary.fixed[2].min,
    summary.fixed[3].min, summary.fixed[4].min, summary.fixed[5].min,
  ]
  const maxs = [
    summary.variable.max,
    summary.fixed[1].max, summary.fixed[2].max,
    summary.fixed[3].max, summary.fixed[4].max, summary.fixed[5].max,
  ]

  // Band series: lower edge = min, upper edge = (max - min) stacked on top
  const bandBase  = mins
  const bandDelta = maxs.map((v, i) => +(v - mins[i]).toFixed(3))

  return (tokens) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tokens.tooltipBg,
      borderColor:     tokens.tooltipBorder,
      textStyle:       { color: tokens.tooltipText, fontSize: 13 },
      formatter: (params) => {
        const avg = params.find((p) => p.seriesName === 'Avg rate')
        const mn  = params.find((p) => p.seriesName === 'min-base')
        const rng = params.find((p) => p.seriesName === 'range')
        const minVal = mn  ? Number(mn.value).toFixed(2)  : '—'
        const maxVal = (mn && rng)
          ? (Number(mn.value) + Number(rng.value)).toFixed(2)
          : '—'
        return avg
          ? `<b>${params[0].axisValueLabel}</b><br/>
             ${avg.marker} Avg: <b>${Number(avg.value).toFixed(2)}%</b><br/>
             <span style="opacity:.6">Range: ${minVal}% – ${maxVal}%</span>`
          : ''
      },
    },
    grid: { top: 24, left: 8, right: 8, bottom: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: true,
      axisLine:  { lineStyle: { color: tokens.axisLine } },
      axisTick:  { show: false },
      axisLabel: { color: tokens.textColor, fontSize: 13, fontWeight: 500 },
    },
    yAxis: {
      type: 'value',
      min: (v) => +(v.min - 0.3).toFixed(1),
      max: (v) => +(v.max + 0.2).toFixed(1),
      axisLabel: { color: tokens.textColor, fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: tokens.gridLine } },
      axisLine:  { show: false },
      axisTick:  { show: false },
    },
    series: [
      // Invisible base for stacked band
      {
        name: 'min-base',
        type: 'line',
        data: bandBase,
        lineStyle: { opacity: 0 },
        symbol: 'none',
        stack: 'band',
        areaStyle: { opacity: 0 },
        tooltip: { show: true },
      },
      // Stacked range band
      {
        name: 'range',
        type: 'line',
        data: bandDelta,
        lineStyle: { opacity: 0 },
        symbol: 'none',
        stack: 'band',
        areaStyle: { color: '#6366f1', opacity: 0.10 },
        tooltip: { show: true },
      },
      // Main avg trend line
      {
        name: 'Avg rate',
        type: 'line',
        data: avgs,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#6366f1', width: 3 },
        itemStyle: { color: '#6366f1', borderColor: '#ffffff', borderWidth: 2 },
        label: {
          show: true,
          position: 'top',
          formatter: (p) => `${Number(p.value).toFixed(2)}%`,
          color: tokens.textColor,
          fontSize: 11,
          fontWeight: 600,
        },
      },
    ],
  })
}

/**
 * Smooth line chart: 12-month trend for variable, fixed 1Y, fixed 3Y.
 */
export function buildLineOption(trend) {
  const months  = trend.map((d) => d.month)
  const varData = trend.map((d) => d.variable)
  const fix1    = trend.map((d) => d.fixed1)
  const fix3    = trend.map((d) => d.fixed3)

  const areaSeries = (name, data, color) => ({
    name,
    type: 'line',
    data,
    smooth: true,
    symbol: 'circle',
    symbolSize: 5,
    lineStyle: { color, width: 2 },
    itemStyle: { color },
    areaStyle: { color, opacity: 0.08 },
  })

  return (tokens) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tokens.tooltipBg,
      borderColor:     tokens.tooltipBorder,
      textStyle:       { color: tokens.tooltipText, fontSize: 13 },
      formatter: (params) =>
        `<b>${params[0].name}</b><br/>` +
        params.map((p) => `${p.marker} ${p.seriesName}: <b>${p.value.toFixed(2)}%</b>`).join('<br/>'),
    },
    legend: {
      bottom: 0,
      textStyle: { color: tokens.textColor, fontSize: 12 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { top: 16, left: 8, right: 8, bottom: 48, containLabel: true },
    xAxis: {
      type: 'category',
      data: months,
      boundaryGap: false,
      axisLine:  { lineStyle: { color: tokens.axisLine } },
      axisTick:  { show: false },
      axisLabel: { color: tokens.textColor, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 5.0,
      axisLabel: { color: tokens.textColor, fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: tokens.gridLine } },
      axisLine:  { show: false },
      axisTick:  { show: false },
    },
    series: [
      areaSeries('Variable',  varData, '#6366f1'),
      areaSeries('Fixed 1Y',  fix1,    '#34d399'),
      areaSeries('Fixed 3Y',  fix3,    '#fbbf24'),
    ],
  })
}
