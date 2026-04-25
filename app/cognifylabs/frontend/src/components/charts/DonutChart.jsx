import ReactECharts from 'echarts-for-react'

const PALETTE = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#f97316','#64748b']

export default function DonutChart({ data = {}, title = '' }) {
  const entries = Object.entries(data)
  const total   = entries.reduce((s, [, v]) => s + v, 0)

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: p => `${p.name}<br/><b>${p.value.toLocaleString()}</b> (${p.percent}%)`,
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#94a3b8', fontSize: 11 },
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#fff' } },
      data: entries.map(([name, value], i) => ({
        name, value,
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
    }],
    graphic: [{
      type: 'text',
      left: '34%',
      top: '45%',
      style: { text: total.toLocaleString(), fill: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
    }, {
      type: 'text',
      left: '34%',
      top: '57%',
      style: { text: 'total', fill: '#64748b', fontSize: 11, textAlign: 'center' },
    }],
  }

  return <ReactECharts option={option} style={{ height: 200 }} />
}
