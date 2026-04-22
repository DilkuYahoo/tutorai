import { useState, useEffect } from 'react'
import StatCard from '@/components/ui/StatCard'
import FunnelChart from '@/components/charts/FunnelChart'
import LineChart from '@/components/charts/LineChart'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useJobs } from '@/hooks/useJobs'
import { USE_API, api } from '@/services/api'
import { MOCK_METRICS } from '@/data/mockData'

export default function DashboardPage() {
  const { openJobs } = useJobs()
  const [m, setM] = useState(USE_API ? null : MOCK_METRICS)

  useEffect(() => {
    if (!USE_API) return
    api.get('/reports/metrics')
      .then(data => { if (data) setM(data) })
      .catch(console.error)
  }, [])

  if (!m) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">As of {m.asOf}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Roles"        value={m.openRoles}           highlight />
        <StatCard label="Total Candidates"  value={m.totalCandidates} />
        <StatCard label="In Pipeline"       value={m.inPipeline}          subtext="active applications" />
        <StatCard label="Avg. Time to Hire" value={m.avgTimeToHireDays}   unit="days" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Candidate Funnel</p>
          <FunnelChart data={m.stageFunnel} />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Time to Hire (days)</p>
          <LineChart data={m.timeToHireTrend} xKey="week" yKey="days" unit=" days" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Open Roles</p>
        {openJobs.length === 0 ? (
          <p className="text-sm text-slate-500">No open roles.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {openJobs.map(job => (
              <li key={job.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-white">{job.title}</p>
                  <p className="text-xs text-slate-500">{job.department} · {job.location}</p>
                </div>
                <span className="text-sm font-semibold text-indigo-400">{job.applicantCount ?? 0}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
