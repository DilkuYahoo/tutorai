import { useState } from 'react'

function RangeBar({ p25, median, p75 }) {
  const range = p75 - p25
  if (!range) return null
  const pct = Math.min(100, Math.max(0, ((median - p25) / range) * 100))
  return (
    <div className="relative h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3">
      <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-indigo-100 dark:bg-indigo-500/20" />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-500 dark:bg-indigo-400 border-2 border-white dark:border-slate-900 shadow-sm"
        style={{ left: `calc(${pct}% - 6px)` }}
      />
    </div>
  )
}

function TrendIndicator({ trend, change }) {
  if (!trend || trend === 'stable') {
    return (
      <span className="text-slate-400 dark:text-slate-400 text-sm font-medium ml-1.5" aria-label="Rate stable">
        →
      </span>
    )
  }
  const isDown = trend === 'down'
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-sm font-medium ml-1.5 tabular-nums
        ${isDown ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}
      aria-label={`Rate ${trend} ${Math.abs(change).toFixed(2)}%`}
    >
      {isDown ? '↓' : '↑'}
      <span className="text-xs">{Math.abs(change).toFixed(2)}%</span>
    </span>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-2.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 5.5Zm0-2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
      />
    </svg>
  )
}

/**
 * StatCard — displays a single rate metric (avg, min, max, product count).
 * `highlight` variant uses an indigo accent for the hero variable rate card.
 * `tooltip` text appears on hover/focus of the ⓘ icon.
 */
export default function StatCard({ label, median, p25, p75, count, highlight = false, tooltip, trend = null, change = null, dataStale = false, tipSide = 'right' }) {
  const [tipVisible, setTipVisible] = useState(false)

  const fmt = (v) => (v != null ? Number(v).toFixed(2) : '—')
  const hasData = median != null

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-4 transition-colors duration-200 ${
        highlight
          ? 'border-indigo-400/60 dark:border-indigo-500/50 bg-indigo-500/5 dark:bg-indigo-500/10'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
      }`}
    >
      {/* Label row */}
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold uppercase tracking-widest leading-tight ${
          highlight ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'
        }`}>
          {label}
        </p>
        {tooltip && (
          <div className="relative shrink-0">
            <button
              type="button"
              onMouseEnter={() => setTipVisible(true)}
              onMouseLeave={() => setTipVisible(false)}
              onFocus={() => setTipVisible(true)}
              onBlur={() => setTipVisible(false)}
              aria-label="More information"
              className={`flex items-center justify-center transition-colors ${
                highlight
                  ? 'text-indigo-300 dark:text-indigo-500 hover:text-indigo-500 dark:hover:text-indigo-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
              }`}
            >
              <InfoIcon />
            </button>
            {tipVisible && (
              <div className={`absolute bottom-full mb-2 z-20 w-56 max-w-[min(15rem,calc(100vw-2rem))] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl px-3.5 py-3 ${
                tipSide === 'left' ? 'left-0' : 'right-0'
              }`}>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {tooltip}
                </p>
                <div className={`absolute -bottom-1.5 w-3 h-3 rotate-45 border-r border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${
                  tipSide === 'left' ? 'left-2' : 'right-2'
                }`} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Median rate — hero number */}
      {hasData ? (
        <div>
          <div className="flex items-baseline">
            <p className={`text-4xl font-semibold tabular-nums tracking-tight leading-none ${
              highlight ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-900 dark:text-white'
            }`}>
              {fmt(median)}
              <span className="text-xl font-normal ml-0.5 text-slate-500 dark:text-slate-400">%</span>
            </p>
            {!dataStale && trend && <TrendIndicator trend={trend} change={change} />}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            median rate
            {dataStale && (
              <span className="ml-1 text-amber-500 dark:text-amber-400">(as of yesterday)</span>
            )}
          </p>
        </div>
      ) : (
        <p className="text-2xl font-semibold text-slate-300 dark:text-slate-700">—</p>
      )}

      {/* P25 / P75 spread band */}
      {hasData && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400">P25</span>
            <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300 truncate">{fmt(p25)}%</span>
          </span>
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400">P75</span>
            <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300 truncate">{fmt(p75)}%</span>
          </span>
        </div>
      )}

      {/* P25/P75 range bar */}
      {hasData && <RangeBar p25={p25} median={median} p75={p75} />}

      {/* Product count */}
      {hasData && (
        <p className="text-xs text-slate-500 dark:text-slate-500 -mt-1">
          {count} products
        </p>
      )}
    </div>
  )
}
