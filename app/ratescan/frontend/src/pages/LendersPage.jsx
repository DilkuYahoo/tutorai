import { useState, useEffect, useMemo } from 'react'
import { MOCK_INSTITUTIONS } from '../data/mockRates'

const API = import.meta.env.VITE_API_URL || ''

const ALL_CATEGORIES = [
  'All',
  'Big 4',
  'Regional/Challenger',
  'Mortgage Specialist',
  'Credit Union/Mutual',
  'Neobank/Fintech',
  'Foreign Bank',
  'Credit Card',
  'Other',
]

const STATUS_CFG = {
  healthy: {
    label:     'Healthy',
    badgeCls:  'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    dotCls:    'bg-emerald-500',
    pillCls:   'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  partial: {
    label:     'Partial',
    badgeCls:  'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
    dotCls:    'bg-amber-500',
    pillCls:   'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  down: {
    label:     'Down',
    badgeCls:  'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
    dotCls:    'bg-red-500',
    pillCls:   'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400',
  },
  unknown: {
    label:     'Unknown',
    badgeCls:  'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
    dotCls:    'bg-slate-400',
    pillCls:   'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.unknown
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badgeCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotCls}`} />
      {cfg.label}
    </span>
  )
}

function Initials({ name }) {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  const text = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0
      bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400
      text-xs font-bold tracking-tight select-none">
      {text}
    </span>
  )
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 border-t border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
          <div className="flex-1 h-4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="hidden sm:block w-32 h-4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="w-10 h-4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="w-10 h-4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="w-10 h-4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="w-16 h-5 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  )
}

export default function LendersPage({ onBack }) {
  const [data, setData]                   = useState(null)
  const [loading, setLoading]             = useState(true)
  const [usingMock, setUsingMock]         = useState(false)
  const [search, setSearch]               = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter]   = useState('All')

  useEffect(() => {
    fetch(`${API}/institutions`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setData(MOCK_INSTITUTIONS); setUsingMock(!!API); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.institutions.filter(inst => {
      const q = search.toLowerCase()
      const matchSearch   = !q || inst.name.toLowerCase().includes(q) || inst.category.toLowerCase().includes(q)
      const matchCategory = categoryFilter === 'All' || inst.category === categoryFilter
      const matchStatus   = statusFilter === 'All'   || inst.status === statusFilter
      return matchSearch && matchCategory && matchStatus
    })
  }, [data, search, categoryFilter, statusFilter])

  const counts = useMemo(() => {
    if (!data) return {}
    return data.institutions.reduce((acc, i) => {
      acc[i.status] = (acc[i.status] || 0) + 1
      return acc
    }, {})
  }, [data])

  const thCls = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400'
  const tdCls = 'px-4 py-3.5 text-sm'

  return (
    <div className="pt-20 pb-14 px-4 max-w-6xl mx-auto">

      {/* Back nav + header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400
            hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Rates
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Lenders</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {data
            ? `${data.count} financial institutions tracked · Last pipeline run: ${data.runDate}`
            : 'Loading institution data…'}
        </p>
      </div>

      {/* Status summary pills */}
      {data && (
        <div className="flex flex-wrap gap-2 mb-5">
          {(['healthy', 'partial', 'down']).map(s => {
            const n = counts[s] || 0
            const cfg = STATUS_CFG[s]
            const active = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? 'All' : s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  border transition-colors duration-150 cursor-pointer
                  ${active ? cfg.pillCls + ' ring-1 ring-current' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotCls}`} />
                {n} {cfg.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search lenders…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800 text-slate-900 dark:text-white
              placeholder-slate-400 dark:placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg
            border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800 text-slate-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
          {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                <th className={thCls}>Institution</th>
                <th className={`${thCls} hidden sm:table-cell`}>Category</th>
                <th className={`${thCls} text-right`}>Total</th>
                <th className={`${thCls} text-right`}>Fetched</th>
                <th className={`${thCls} text-right`}>Failed</th>
                <th className={`${thCls} text-center`}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <TableSkeleton />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No lenders match your filters.
                  </td>
                </tr>
              )}
              {!loading && filtered.map(inst => (
                <tr
                  key={inst.key}
                  className="transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className={tdCls}>
                    <div className="flex items-center gap-3">
                      <Initials name={inst.name} />
                      <span className="font-medium text-slate-900 dark:text-white leading-tight">
                        {inst.name}
                      </span>
                    </div>
                  </td>
                  <td className={`${tdCls} hidden sm:table-cell`}>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs
                      bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400">
                      {inst.category}
                    </span>
                  </td>
                  <td className={`${tdCls} text-right tabular-nums text-slate-600 dark:text-slate-300`}>
                    {inst.totalProducts}
                  </td>
                  <td className={`${tdCls} text-right tabular-nums ${inst.succeeded > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {inst.succeeded}
                  </td>
                  <td className={`${tdCls} text-right tabular-nums ${inst.failed > 0 ? 'text-red-500 dark:text-red-400 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                    {inst.failed}
                  </td>
                  <td className={`${tdCls} text-center`}>
                    <StatusBadge status={inst.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && data && (
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800
            text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Showing {filtered.length} of {data.count} institutions</span>
            {(search || categoryFilter !== 'All' || statusFilter !== 'All') && (
              <button
                onClick={() => { setSearch(''); setCategoryFilter('All'); setStatusFilter('All') }}
                className="text-indigo-500 dark:text-indigo-400 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stale / mock data notice */}
      {usingMock && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          Live data unavailable — showing sample data. The pipeline may not have completed its first run yet.
        </p>
      )}
    </div>
  )
}
