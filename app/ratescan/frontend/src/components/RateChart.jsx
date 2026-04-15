import ReactECharts from 'echarts-for-react'

/** Shared theme tokens derived from isDark flag */
function themeTokens(isDark) {
  return {
    textColor:    isDark ? '#94a3b8' : '#475569',   // slate-400 / slate-600
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

  const medians = [
    summary.variable.median,
    summary.fixed[1].median, summary.fixed[2].median,
    summary.fixed[3].median, summary.fixed[4].median, summary.fixed[5].median,
  ]
  const p25s = [
    summary.variable.p25,
    summary.fixed[1].p25, summary.fixed[2].p25,
    summary.fixed[3].p25, summary.fixed[4].p25, summary.fixed[5].p25,
  ]
  const p75s = [
    summary.variable.p75,
    summary.fixed[1].p75, summary.fixed[2].p75,
    summary.fixed[3].p75, summary.fixed[4].p75, summary.fixed[5].p75,
  ]

  // Band series: lower edge = P25, upper edge = (P75 - P25) stacked on top
  const bandBase  = p25s
  const bandDelta = p75s.map((v, i) => +(v - p25s[i]).toFixed(3))

  return (tokens) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tokens.tooltipBg,
      borderColor:     tokens.tooltipBorder,
      textStyle:       { color: tokens.tooltipText, fontSize: 13 },
      formatter: (params) => {
        const med = params.find((p) => p.seriesName === 'Median rate')
        const p25 = params.find((p) => p.seriesName === 'p25-base')
        const rng = params.find((p) => p.seriesName === 'range')
        const p25Val = p25  ? Number(p25.value).toFixed(2)  : '—'
        const p75Val = (p25 && rng)
          ? (Number(p25.value) + Number(rng.value)).toFixed(2)
          : '—'
        return med
          ? `<b>${params[0].axisValueLabel}</b><br/>
             ${med.marker} Median: <b>${Number(med.value).toFixed(2)}%</b><br/>
             <span style="opacity:.6">P25–P75: ${p25Val}% – ${p75Val}%</span>`
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
      // Invisible base for stacked band (P25)
      {
        name: 'p25-base',
        type: 'line',
        data: bandBase,
        lineStyle: { opacity: 0 },
        symbol: 'none',
        stack: 'band',
        areaStyle: { opacity: 0 },
        tooltip: { show: true },
      },
      // Stacked range band (P25–P75)
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
      // Main median trend line
      {
        name: 'Median rate',
        type: 'line',
        data: medians,
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
