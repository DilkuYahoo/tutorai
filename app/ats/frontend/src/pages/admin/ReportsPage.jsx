import BarChart from '@/components/charts/BarChart'
import LineChart from '@/components/charts/LineChart'
import { MOCK_METRICS } from '@/data/mockData'

export default function ReportsPage() {
  const m = MOCK_METRICS

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Reports</h1>
        <p className="text-sm text-slate-400 mt-0.5">Hiring analytics as of {m.asOf}</p>
      </div>

      {/* Time-in-stage + time-to-hire */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Avg. Time in Stage (days)</p>
          <BarChart data={m.timeInStage} xKey="stage" yKey="avgDays" unit=" days" color="#6366f1" />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Time to Hire Trend</p>
          <LineChart data={m.timeToHireTrend} xKey="week" yKey="days" unit=" days" color="#10b981" />
        </div>
      </div>

      {/* Source breakdown */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Candidate Source Breakdown</p>
        <div className="space-y-3">
          {m.sourceBreakdown.map(s => {
            const total = m.sourceBreakdown.reduce((acc, x) => acc + x.count, 0)
            const pct = Math.round((s.count / total) * 100)
            return (
              <div key={s.source} className="flex items-center gap-4">
                <span className="text-sm text-slate-300 w-20 shrink-0">{s.source}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-12 text-right">{s.count} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Offer acceptance */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Offer Acceptance Rate</p>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold text-white">{Math.round(m.offerAcceptanceRate * 100)}%</span>
          <span className="text-sm text-slate-500 mb-1">of offers accepted</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden w-64">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${m.offerAcceptanceRate * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
