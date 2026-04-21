import ReactECharts from 'echarts-for-react'

export default function LineChart({ data, xKey, yKey, color = '#6366f1', unit = '' }) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#cbd5e1', fontSize: 12 },
      formatter: (params) => `${params[0].name}<br/><b>${params[0].value}${unit}</b>`,
    },
    grid: { left: 50, right: 20, top: 20, bottom: 50 },
    xAxis: {
      type: 'category',
      data: data.map(d => d[xKey]),
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        type: 'line',
        data: data.map(d => d[yKey]),
        smooth: true,
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: { color: `${color}18` },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 260 }} notMerge />
}
