import { format, parseISO } from 'date-fns'
import { useMonitor } from '@/hooks/useMonitor'
import StatCard from '@/components/ui/StatCard'
import TrendBadge from '@/components/ui/TrendBadge'
import RankedTable from '@/components/ui/RankedTable'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import RequestsLineChart from '@/components/charts/RequestsLineChart'
import StatusBarChart from '@/components/charts/StatusBarChart'
import DonutChart from '@/components/charts/DonutChart'
import HorizontalBarChart from '@/components/charts/HorizontalBarChart'
import GeoMap from '@/components/charts/GeoMap'

const PRESETS = ['24h', '7d', '30d']

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function Card({ title, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900 p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>}
      {children}
    </div>
  )
}

function DistributionSelector() {
  const { distributions, selectedDistId, setDist } = useMonitor()
  return (
    <select
      value={selectedDistId}
      onChange={e => setDist(e.target.value)}
      className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
    >
      <option value="all">All Distributions</option>
      {distributions.map(d => (
        <option key={d.id} value={d.id}>{d.label}</option>
      ))}
    </select>
  )
}

function PresetSelector() {
  const { preset, setPreset } = useMonitor()
  return (
    <div className="flex rounded-xl overflow-hidden border border-slate-700">
      {PRESETS.map(p => (
        <button
          key={p}
          onClick={() => setPreset(p)}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            preset === p
              ? 'bg-indigo-500 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { metrics, geo, loading, error } = useMonitor()

  if (loading && !metrics) return <LoadingSpinner message="Loading traffic data…" />
  if (error) return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-400 text-sm">
      Failed to load data: {error}
    </div>
  )

  const m        = metrics || {}
  const countries = geo?.countries || []
  const total    = m.totalRequests || 0

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <DistributionSelector />
        <PresetSelector />
        {loading && <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />}
      </div>

      {/* ── Top stat cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Total Requests</p>
          <p className="text-3xl font-bold text-white">{total.toLocaleString()}</p>
          <div className="mt-2">
            <TrendBadge current={total} previous={m.previousPeriodRequests} />
          </div>
        </Card>
        <StatCard label="Unique IPs"        value={(m.uniqueIps || 0).toLocaleString()} />
        <StatCard label="Cache Hit Ratio"   value={`${m.cacheHitRatio ?? 0}%`}
          sub={`${(m.cacheHits||0).toLocaleString()} hits / ${(m.cacheMisses||0).toLocaleString()} misses`} accent />
        <StatCard label="Bandwidth Served"  value={formatBytes(m.bandwidth)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Avg Response Time" value={`${m.avgResponseTimeMs ?? 0} ms`} />
        <StatCard label="Error Rate"
          value={total ? `${(((m.statusGroups?.['4xx']||0)+(m.statusGroups?.['5xx']||0))/total*100).toFixed(1)}%` : '0%'}
          sub={`${((m.statusGroups?.['4xx']||0)+(m.statusGroups?.['5xx']||0)).toLocaleString()} errors`} />
        <Card>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Bot Traffic</p>
          <p className="text-3xl font-bold text-amber-400">
            {total ? `${((m.botVsHuman?.bot||0)/total*100).toFixed(1)}%` : '0%'}
          </p>
          <p className="text-xs text-slate-500 mt-1">{(m.botVsHuman?.bot||0).toLocaleString()} bot requests</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Peak Hour</p>
          <p className="text-3xl font-bold text-white">
            {m.peakHour?.hour ? format(parseISO(m.peakHour.hour), 'HH:mm') : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">{(m.peakHour?.count||0).toLocaleString()} requests</p>
        </Card>
      </div>

      {/* ── Requests over time ───────────────────────────────────────────── */}
      <Card title="Requests Over Time">
        <RequestsLineChart data={m.requestsOverTime || []} />
      </Card>

      {/* ── Status codes + Protocol split ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Status Codes" className="lg:col-span-1">
          <StatusBarChart data={m.statusGroups || {}} />
        </Card>
        <Card title="Protocol Split" className="lg:col-span-1">
          <DonutChart data={m.protocolSplit || {}} />
        </Card>
        <Card title="HTTP Version" className="lg:col-span-1">
          <DonutChart data={m.httpVersions || {}} />
        </Card>
      </div>

      {/* ── Bot vs Human ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Bot vs Human Traffic">
          <DonutChart data={m.botVsHuman || {}} />
        </Card>
        <Card title="Top Edge Locations">
          <HorizontalBarChart
            data={(m.topEdgeLocations||[]).map(e => ({ label: e.location, count: e.count }))}
            labelKey="label" valueKey="count" color="#6366f1"
          />
        </Card>
      </div>

      {/* ── Top URLs + Top IPs ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top URLs">
          <RankedTable rows={m.topUrls||[]} labelKey="url" valueKey="count" total={total} />
        </Card>
        <Card title="Top IPs by Request Count">
          <RankedTable rows={m.topIps||[]} labelKey="ip" valueKey="count" total={total} truncate={20} />
        </Card>
      </div>

      {/* ── Top Referrers + Top User Agents ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top Referrers">
          <RankedTable rows={m.topReferrers||[]} labelKey="referrer" valueKey="count" total={total} />
        </Card>
        <Card title="Top User Agents">
          <RankedTable rows={m.topUserAgents||[]} labelKey="userAgent" valueKey="count" total={total} />
        </Card>
      </div>

      {/* ── Geographic map ───────────────────────────────────────────────── */}
      <Card title="Traffic by Location">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">{countries.length} countries • circle size = request volume</span>
        </div>
        <GeoMap countries={countries} />
        {countries.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {countries.slice(0, 12).map(c => (
              <div key={c.country} className="flex items-center justify-between bg-slate-800/50 rounded-xl px-3 py-2">
                <span className="text-xs text-slate-300">{c.countryName}</span>
                <span className="text-xs font-semibold text-indigo-400 ml-2 tabular-nums">{c.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  )
}
