export default function StatCard({ label, value, unit = '', trend, change, subtext, highlight = false }) {
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'
  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'

  return (
    <div className={`rounded-2xl border p-5 ${
      highlight
        ? 'bg-indigo-500/10 border-indigo-500/30'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
    }`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold tabular-nums text-white">{value}</span>
        {unit && <span className="text-sm text-slate-400 mb-1">{unit}</span>}
      </div>
      {(trend || change) && (
        <div className={`mt-2 text-xs font-medium ${trendColor}`}>
          {trendArrow} {change}
        </div>
      )}
      {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
    </div>
  )
}
