import React, { useState } from 'react'

function relativeDate(dateStr) {
  const diff = Math.floor((new Date('2026-04-13') - new Date(dateStr)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}

function Delta({ value }) {
  const delta = +(value).toFixed(2)
  const down  = delta < 0
  const up    = delta > 0
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${
      down ? 'text-emerald-500 dark:text-emerald-400'
           : up ? 'text-red-500 dark:text-red-400'
                : 'text-slate-400'
    }`}>
      {down ? '↓' : up ? '↑' : ''}
      {Math.abs(delta).toFixed(2)}%
    </span>
  )
}

function Initials({ text }) {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-xs font-bold shrink-0 tracking-tight">
      {text}
    </span>
  )
}

export default function RecentChangesTable({ data }) {
  const [expanded, setExpanded] = useState(new Set())

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const thCls = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500'
  const tdCls = 'px-4 py-3.5 text-sm'

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
            <th className={`${thCls} w-8`} />
            <th className={thCls}>Lender</th>
            <th className={`${thCls} hidden sm:table-cell`}>Changed</th>
            <th className={thCls}>Products</th>
            <th className={`${thCls} text-right`}>Avg Change</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((row) => {
            const isOpen      = expanded.has(row.id)
            const multi       = row.products.length > 1
            const hasPrevRate = row.products[0]?.prevRate != null
            const avgChange   = hasPrevRate
              ? row.products.reduce((s, p) => s + (p.rate - p.prevRate), 0) / row.products.length
              : null

            return (
              <React.Fragment key={row.id}>
                {/* Lender row */}
                <tr
                  onClick={() => toggle(row.id)}
                  className="cursor-pointer transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  {/* Expand chevron */}
                  <td className={`${tdCls} pl-4 pr-0`}>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </td>

                  {/* Lender name */}
                  <td className={tdCls}>
                    <div className="flex items-center gap-3">
                      <Initials text={row.initials} />
                      <span className="font-medium text-slate-900 dark:text-white">{row.lender}</span>
                    </div>
                  </td>

                  {/* Changed date */}
                  <td className={`${tdCls} hidden sm:table-cell text-slate-500 dark:text-slate-400`}>
                    {relativeDate(row.changedAt)}
                  </td>

                  {/* Product count badge */}
                  <td className={tdCls}>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                      {row.products.length} {row.products.length === 1 ? 'product' : 'products'}
                    </span>
                  </td>

                  {/* Avg change */}
                  <td className={`${tdCls} text-right`}>
                    {avgChange != null ? <Delta value={avgChange} /> : <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>}
                  </td>
                </tr>

                {/* Expanded product rows */}
                {isOpen && (
                  <tr key={`${row.id}-detail`}>
                    <td colSpan={5} className="p-0">
                      <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                              <th className={`${thCls} pl-14`}>Product</th>
                              <th className={`${thCls} hidden sm:table-cell`}>Type</th>
                              {row.products[0]?.prevRate != null && (
                                <>
                                  <th className={`${thCls} text-right`}>Previous</th>
                                  <th className={`${thCls} text-right`}>Change</th>
                                </>
                              )}
                              <th className={`${thCls} text-right`}>Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {row.products.map((p, i) => (
                              <tr key={i} className="transition-colors">
                                <td className={`${tdCls} pl-14 text-slate-700 dark:text-slate-300`}>{p.name}</td>
                                <td className={`${tdCls} hidden sm:table-cell`}>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                    {p.type}
                                  </span>
                                </td>
                                {p.prevRate != null && (
                                  <>
                                    <td className={`${tdCls} text-right text-slate-400 dark:text-slate-500 tabular-nums`}>
                                      {p.prevRate.toFixed(2)}%
                                    </td>
                                    <td className={`${tdCls} text-right`}>
                                      <Delta value={p.rate - p.prevRate} />
                                    </td>
                                  </>
                                )}
                                <td className={`${tdCls} text-right font-medium text-slate-900 dark:text-white tabular-nums`}>
                                  {p.rate.toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
