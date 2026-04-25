export default function TrendBadge({ current, previous }) {
  if (!previous || previous === 0) return null
  const pct   = ((current - previous) / previous * 100).toFixed(1)
  const up    = current >= previous
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-lg ${
      up ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
    }`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% vs prev
    </span>
  )
}
