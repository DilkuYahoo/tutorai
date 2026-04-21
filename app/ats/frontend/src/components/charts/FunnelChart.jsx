import ReactECharts from 'echarts-for-react'

export default function FunnelChart({ data }) {
  const maxCount = data[0]?.count ?? 1

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#cbd5e1', fontSize: 12 },
      formatter: (p) => `${p.name}: <b>${p.value}</b>`,
    },
    grid: { left: 140, right: 60, top: 10, bottom: 10 },
    xAxis: {
      type: 'value',
      max: maxCount,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d.stage).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        data: data.map(d => d.count).reverse(),
        barMaxWidth: 32,
        itemStyle: { color: '#6366f1', borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          color: '#94a3b8',
          fontSize: 12,
          formatter: '{c}',
        },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 220 }} notMerge />
}
