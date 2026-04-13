import { useState } from 'react'

/**
 * StatCard — displays a single rate metric (avg, min, max, lender count).
 * `highlight` variant uses an indigo accent border for the variable rate card.
 * `tooltip` text appears on hover over the ⓘ icon.
 */
export default function StatCard({ label, avg, min, max, count, highlight = false, tooltip }) {
  const [tipVisible, setTipVisible] = useState(false)

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-3 transition-colors duration-200 ${
        highlight
          ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
      }`}
    >
      {/* Label + info icon */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
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
              className="w-4 h-4 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" clipRule="evenodd"
                  d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-2.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 5.5Zm0-2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
                />
              </svg>
            </button>
            {tipVisible && (
              <div className="absolute bottom-full right-0 mb-2 z-20 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg px-3.5 py-3">
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {tooltip}
                </p>
                {/* Arrow */}
                <div className="absolute -bottom-1.5 right-2 w-3 h-3 rotate-45 border-r border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Average rate — hero number */}
      <p
        className={`text-4xl font-semibold tabular-nums tracking-tight ${
          highlight ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-900 dark:text-white'
        }`}
      >
        {avg.toFixed(2)}
        <span className="text-xl font-normal ml-0.5 text-slate-400 dark:text-slate-500">%</span>
      </p>

      {/* Min / max range */}
      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          {min.toFixed(2)}%
        </span>
        <span className="text-slate-300 dark:text-slate-700">—</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
          {max.toFixed(2)}%
        </span>
      </div>

      {/* Lender count */}
      <p className="text-xs text-slate-400 dark:text-slate-600">
        {count} products
      </p>
    </div>
  )
}
