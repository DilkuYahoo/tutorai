export default function RankedTable({ rows = [], labelKey, valueKey, total, truncate = 55 }) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const label = row[labelKey]
        const count = row[valueKey]
        const pct   = total ? (count / total * 100).toFixed(1) : 0
        const short = label.length > truncate ? label.slice(0, truncate) + '…' : label
        return (
          <div key={i}>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span className="truncate" title={label}>{short}</span>
              <span className="ml-2 shrink-0 text-slate-300 tabular-nums">
                {count.toLocaleString()} <span className="text-slate-600">({pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
