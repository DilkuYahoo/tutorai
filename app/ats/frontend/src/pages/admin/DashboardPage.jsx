import StatCard from '@/components/ui/StatCard'
import FunnelChart from '@/components/charts/FunnelChart'
import LineChart from '@/components/charts/LineChart'
import { MOCK_METRICS, MOCK_JOBS } from '@/data/mockData'

export default function DashboardPage() {
  const m = MOCK_METRICS
  const openJobs = MOCK_JOBS.filter(j => j.status === 'Open')

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">As of {m.asOf}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Roles"
          value={m.openRoles}
          trend="up"
          change="+1 this week"
          highlight
        />
        <StatCard
          label="Total Candidates"
          value={m.totalCandidates}
          trend="up"
          change="+8 this week"
        />
        <StatCard
          label="In Pipeline"
          value={m.inPipeline}
          subtext="active applications"
        />
        <StatCard
          label="Avg. Time to Hire"
          value={m.avgTimeToHireDays}
          unit="days"
          trend="down"
          change="−2 days vs last month"
        />
      </div>

      {/* Charts row */}
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

      {/* Open roles list */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Open Roles</p>
        <ul className="divide-y divide-slate-800">
          {openJobs.map(job => (
            <li key={job.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-white">{job.title}</p>
                <p className="text-xs text-slate-500">{job.department} · {job.location}</p>
              </div>
              <span className="text-sm font-semibold text-indigo-400">{job.applicantCount}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
