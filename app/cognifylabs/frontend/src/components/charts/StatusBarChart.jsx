import ReactECharts from 'echarts-for-react'

const COLOURS = { '2xx': '#22c55e', '3xx': '#f59e0b', '4xx': '#f97316', '5xx': '#ef4444', 'unknown': '#64748b' }

export default function StatusBarChart({ data = {} }) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]))

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    grid: { top: 10, right: 10, bottom: 30, left: 60 },
    xAxis: {
      type: 'category',
      data: entries.map(([k]) => k),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b', fontSize: 12 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [{
      type: 'bar',
      data: entries.map(([k, v]) => ({ value: v, itemStyle: { color: COLOURS[k] || '#6366f1', borderRadius: [4, 4, 0, 0] } })),
      barMaxWidth: 60,
    }],
  }

  return <ReactECharts option={option} style={{ height: 220 }} />
}
