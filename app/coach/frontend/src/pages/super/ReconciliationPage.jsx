import { useState } from 'react'
import { format } from 'date-fns'
import { reconciliationEntries } from '@/data/mock'
import Badge from '@/components/ui/Badge'
import SectionHeader from '@/components/ui/SectionHeader'

const TYPE_LABELS = {
  purchase:             { label: 'Package purchase',        colour: 'green' },
  booking_reserve:      { label: 'Booking reserved',        colour: 'blue' },
  session_complete:     { label: 'Session completed',       colour: 'green' },
  cancellation_return:  { label: 'Cancellation return',     colour: 'amber' },
  late_cancel_forfeit:  { label: 'Late cancel (forfeited)', colour: 'red' },
  manual_adjustment:    { label: 'Manual adjustment',       colour: 'indigo' },
}

export default function ReconciliationPage() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [playerFilter, setPlayerFilter] = useState('')
  const [coachFilter, setCoachFilter] = useState('')

  const filtered = reconciliationEntries.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false
    if (playerFilter && !e.player.toLowerCase().includes(playerFilter.toLowerCase())) return false
    if (coachFilter && !e.coach?.toLowerCase().includes(coachFilter.toLowerCase())) return false
    return true
  })

  const totalPurchased = filtered.filter(e => e.type === 'purchase').reduce((s, e) => s + e.credits, 0)
  const totalConsumed = filtered.filter(e => e.type === 'session_complete').reduce((s, e) => s + Math.abs(e.credits), 0)
  const totalReturned = filtered.filter(e => e.type === 'cancellation_return').reduce((s, e) => s + e.credits, 0)
  const totalManual = filtered.filter(e => e.type === 'manual_adjustment').reduce((s, e) => s + e.credits, 0)

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Credit Reconciliation Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Full ledger of all credit movements across the platform</p>
        </div>
        <button className="text-sm border border-slate-700 text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg transition-colors">
          Export CSV ↓
        </button>
      </div>

      {/* Summary totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Credits purchased</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">+{totalPurchased}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Credits consumed</p>
          <p className="text-2xl font-bold text-red-400 mt-1">-{totalConsumed}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Credits returned</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">+{totalReturned}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Manual adjustments</p>
          <p className={`text-2xl font-bold mt-1 ${totalManual >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
            {totalManual >= 0 ? '+' : ''}{totalManual}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 block mb-1">Player</label>
          <input
            type="text"
            placeholder="Search player..."
            value={playerFilter}
            onChange={e => setPlayerFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 w-40"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Coach</label>
          <input
            type="text"
            placeholder="Search coach..."
            value={coachFilter}
            onChange={e => setCoachFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 w-40"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Entry type</label>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setTypeFilter('all'); setPlayerFilter(''); setCoachFilter('') }}
          className="text-xs text-slate-500 hover:text-slate-300 py-1.5"
        >
          Clear filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-800">
              {['Date', 'Player', 'Parent', 'Coach', 'Type', 'Credits', 'Balance after', 'Reference'].map(h => (
                <th key={h} className="text-left text-xs text-slate-500 font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry => {
              const typeInfo = TYPE_LABELS[entry.type] || { label: entry.type, colour: 'slate' }
              return (
                <tr key={entry.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{format(entry.date, 'd MMM yyyy HH:mm')}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{entry.player}</td>
                  <td className="px-4 py-3 text-slate-400">{entry.parent || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{entry.coach || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge label={typeInfo.label} colour={typeInfo.colour} />
                    {entry.adjustedBy && (
                      <p className="text-xs text-slate-500 mt-0.5">by {entry.adjustedBy}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <span className={entry.credits > 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {entry.credits > 0 ? '+' : ''}{entry.credits}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-medium">{entry.balance}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{entry.reference}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">No entries match the current filters.</div>
        )}
      </div>

      <p className="text-xs text-slate-600">Showing {filtered.length} of {reconciliationEntries.length} entries. In production, data is sourced from Athena via DynamoDB Streams → S3 Parquet pipeline with 10–60s lag.</p>
    </div>
  )
}
