import ReactECharts from 'echarts-for-react'

export default function HorizontalBarChart({ data = [], labelKey = 'label', valueKey = 'count', color = '#6366f1' }) {
  const items = [...data].reverse()

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    grid: { top: 5, right: 60, bottom: 5, left: 5, containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'category',
      data: items.map(d => d[labelKey]),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 11, width: 120, overflow: 'truncate' },
    },
    series: [{
      type: 'bar',
      data: items.map(d => d[valueKey]),
      barMaxWidth: 24,
      itemStyle: { color, borderRadius: [0, 4, 4, 0] },
      label: {
        show: true,
        position: 'right',
        color: '#64748b',
        fontSize: 11,
        formatter: p => p.value.toLocaleString(),
      },
    }],
  }

  return <ReactECharts option={option} style={{ height: Math.max(160, items.length * 28) }} />
}
