import { useState, useRef, useEffect } from 'react'
import {
  format, isToday, isFuture, differenceInDays, addDays,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from 'date-fns'
import ReactECharts from 'echarts-for-react'
import {
  sessions, coaches, superCoach, players, invoices, lateCancellations,
  getPlayerById, getCoachById, COACH_COLORS, coachAvailability,
} from '@/data/mock'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import SectionHeader from '@/components/ui/SectionHeader'

const allCoaches = [superCoach, ...coaches]

// ─── Coach Typeahead Selector ──────────────────────────────────────────────────
function CoachSelector({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selectedCoach = value === 'all' ? null : allCoaches.find(c => c.id === value)

  const results = query.trim() === ''
    ? allCoaches
    : allCoaches.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(id) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 sm:min-w-[240px] focus-within:border-indigo-500 transition-colors min-h-[44px]">
        {selectedCoach ? (
          <>
            <img src={selectedCoach.photo} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            <span className="text-sm text-slate-200 flex-1 truncate">{selectedCoach.name}</span>
            <button
              onClick={() => { onChange('all'); setQuery('') }}
              className="text-slate-500 hover:text-slate-300 text-xs ml-1 p-1"
              title="Clear — show all coaches"
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <span className="text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="All coaches"
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onKeyDown={e => e.key === 'Escape' && setOpen(false)}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
          </>
        )}
      </div>

      {open && !selectedCoach && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-30 overflow-hidden">
          <button
            onClick={() => select('all')}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors border-b border-slate-800 min-h-[44px]"
          >
            <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs flex-shrink-0">★</span>
            All coaches
          </button>
          {results.slice(0, 10).map(c => {
            const todayCount = sessions.filter(s => s.coachId === c.id && isToday(s.start)).length
            return (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800 transition-colors text-left min-h-[44px]"
              >
                <img src={c.photo} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">{todayCount} session{todayCount !== 1 ? 's' : ''} today</p>
                </div>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COACH_COLORS[c.id] }} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Utilisation Pie Chart ─────────────────────────────────────────────────────
function UtilisationChart({ coachId }) {
  const [period, setPeriod] = useState(30)

  const avail = coachAvailability[coachId] || []
  const now = new Date()
  const end = addDays(now, period)

  const totalSlots = avail.filter(s => s.start >= now && s.start <= end).length
  const bookedSlots = sessions.filter(s =>
    s.coachId === coachId &&
    (s.status === 'booked' || s.status === 'completed') &&
    s.start >= now && s.start <= end
  ).length
  const freeSlots = Math.max(totalSlots - bookedSlots, 0)
  const utilPct = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0
  const coach = getCoachById(coachId)
  const color = COACH_COLORS[coachId]

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      formatter: '{b}: {c} slots ({d}%)',
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['55%', '78%'],
      center: ['50%', '50%'],
      data: [
        { value: bookedSlots, name: 'Booked',    itemStyle: { color } },
        { value: freeSlots,   name: 'Available', itemStyle: { color: '#1e293b' } },
      ],
      label: {
        show: true,
        position: 'center',
        rich: {
          pct:   { fontSize: 20, fontWeight: 'bold', color: '#f1f5f9', lineHeight: 26 },
          count: { fontSize: 11, color: '#94a3b8',   lineHeight: 18 },
        },
        formatter: `{pct|${utilPct}%}\n{count|${bookedSlots} / ${totalSlots} slots}`,
      },
      labelLine: { show: false },
      emphasis: { scale: false },
    }],
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Slot Utilisation</p>
          <p className="text-xs text-slate-500">{coach?.name}</p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`text-xs px-2 py-1.5 rounded-lg transition-colors min-h-[32px] ${
                period === d ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ReactECharts option={option} style={{ height: 150, width: 150, flexShrink: 0 }} />
        <div className="space-y-2 text-xs flex-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-slate-400">Booked</span>
            <span className="text-slate-200 font-medium ml-auto">{bookedSlots} slots</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-700 flex-shrink-0" />
            <span className="text-slate-400">Available</span>
            <span className="text-slate-200 font-medium ml-auto">{freeSlots} slots</span>
          </div>
          <div className="border-t border-slate-800 pt-2 flex justify-between text-slate-500">
            <span>Total</span>
            <span className="text-slate-300 font-medium">{totalSlots} slots</span>
          </div>
          <div className="border-t border-slate-800 pt-2 flex justify-between text-slate-500">
            <span>Utilisation</span>
            <span className="font-semibold" style={{ color }}>{utilPct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function SuperDashboardPage() {
  const [coachFilter, setCoachFilter] = useState('all')
  const [upcomingFilter, setUpcomingFilter] = useState('week') // 'week' | 'month' | 'all'

  const isFiltered = coachFilter !== 'all'
  const filteredSessions  = isFiltered ? sessions.filter(s => s.coachId === coachFilter)  : sessions
  const filteredInvoices  = isFiltered ? invoices.filter(i => i.coachId === coachFilter)  : invoices
  const filteredCancels   = isFiltered ? lateCancellations.filter(c => c.coachId === coachFilter) : lateCancellations
  const filteredPlayers   = isFiltered
    ? players.filter(p => filteredSessions.some(s => s.playerId === p.id))
    : players

  // Date windows
  const now = new Date()
  const weekEnd   = endOfWeek(now, { weekStartsOn: 1 })
  const monthEnd  = endOfMonth(now)

  const todaySessions = filteredSessions.filter(s => isToday(s.start))
  const allUpcoming   = filteredSessions.filter(s => isFuture(s.start) && s.status === 'booked').sort((a, b) => a.start - b.start)
  const upcomingThisWeek = allUpcoming.filter(s => s.start <= weekEnd)

  const upcomingFiltered =
    upcomingFilter === 'week'  ? allUpcoming.filter(s => s.start <= weekEnd) :
    upcomingFilter === 'month' ? allUpcoming.filter(s => s.start <= monthEnd) :
    allUpcoming

  const completed   = filteredSessions.filter(s => s.status === 'completed')
  const outstanding = filteredInvoices.filter(i => i.status === 'pending')
  const revenue     = filteredInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
  const videosAwaiting = 1 // mock

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Header + Coach selector ─────────────────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Super Coach Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isFiltered
              ? `Showing ${getCoachById(coachFilter)?.name}'s data`
              : `Business-wide · ${format(now, 'd MMMM yyyy')}`}
          </p>
        </div>
        <CoachSelector value={coachFilter} onChange={setCoachFilter} />
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Today's sessions"
          value={todaySessions.length}
          accent
          sub={todaySessions.length > 0 ? todaySessions.map(s => getPlayerById(s.playerId)?.name).join(', ') : 'None today'}
        />
        <StatCard
          label="Upcoming this week"
          value={upcomingThisWeek.length}
          sub={`ends ${format(weekEnd, 'EEE d MMM')}`}
        />
        <StatCard
          label="Completed (month)"
          value={completed.length}
          sub={format(now, 'MMMM yyyy')}
        />
        <StatCard
          label="Revenue (month)"
          value={`$${revenue}`}
          sub={isFiltered ? 'This coach' : 'All coaches'}
        />
        <StatCard
          label="Outstanding invoices"
          value={outstanding.length}
          sub={`$${outstanding.reduce((s, i) => s + i.amount, 0)} total`}
          badge={outstanding.length > 0 ? outstanding.length : null}
        />
        <StatCard
          label="Videos to review"
          value={videosAwaiting}
          badge={videosAwaiting > 0 ? '!' : null}
          sub="3+ days, no response"
        />
      </div>

      {/* ── Utilisation chart (per-coach only, between stats and outstanding) ── */}
      {isFiltered && <UtilisationChart coachId={coachFilter} />}

      {/* ── All coaches overview (all-coaches view only) ─────────────────────── */}
      {!isFiltered && (
        <div>
          <SectionHeader title="Coaches" sub={`${allCoaches.length} active`} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {allCoaches.map(coach => {
              const cs = sessions.filter(s => s.coachId === coach.id)
              const coachUpcoming = cs.filter(s => isFuture(s.start) && s.status === 'booked').length
              const coachRevenue  = invoices.filter(i => i.coachId === coach.id && i.status === 'paid').reduce((s, i) => s + i.amount, 0)
              const color = COACH_COLORS[coach.id]
              return (
                <div
                  key={coach.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-slate-600 transition-colors"
                  onClick={() => setCoachFilter(coach.id)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <img src={coach.photo} alt={coach.name} className="w-10 h-10 rounded-full object-cover" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900" style={{ backgroundColor: color }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{coach.name}</p>
                      <p className="text-xs text-slate-500">${coach.rate}/session</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-800 rounded-lg p-2 text-center">
                      <p className="text-slate-500">Upcoming</p>
                      <p className="text-slate-200 font-semibold">{coachUpcoming}</p>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-2 text-center">
                      <p className="text-slate-500">Revenue</p>
                      <p className="text-slate-200 font-semibold">${coachRevenue}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Today's sessions list ────────────────────────────────────────────── */}
      <div>
        <SectionHeader
          title="Today's Sessions"
          sub={`${todaySessions.length} scheduled · ${format(now, 'EEEE d MMMM')}`}
        />
        {todaySessions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-slate-500 text-sm">
            No sessions today{isFiltered ? ` for ${getCoachById(coachFilter)?.name}` : ''}.
          </div>
        ) : (
          <div className="space-y-2">
            {todaySessions.map(s => {
              const player = getPlayerById(s.playerId)
              const coach  = getCoachById(s.coachId)
              const color  = COACH_COLORS[s.coachId]
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-100">{player?.name}</p>
                      <Badge label={s.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} colour={s.type === 'recurring' ? 'indigo' : 'slate'} />
                      <Badge label={s.status} colour={s.status === 'completed' ? 'green' : 'blue'} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <p className="text-xs text-slate-500">{format(s.start, 'h:mm a')} – {format(s.end, 'h:mm a')}</p>
                      {!isFiltered && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          {coach?.name}
                        </span>
                      )}
                      {s.venue && <p className="text-xs text-slate-500">📍 {s.venue}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button className="text-xs px-3 py-2 rounded-xl border border-amber-800 text-amber-400 hover:bg-amber-950/50 transition-colors min-h-[36px]">
                      Reschedule
                    </button>
                    <button className="text-xs px-3 py-2 rounded-xl border border-indigo-700 text-indigo-400 hover:bg-indigo-950/50 transition-colors min-h-[36px]">
                      Reassign
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Upcoming sessions ───────────────────────────────────────────────── */}
      <div>
        <SectionHeader
          title="Upcoming Sessions"
          sub={`${upcomingFiltered.length} session${upcomingFiltered.length !== 1 ? 's' : ''}${isFiltered ? ` · ${getCoachById(coachFilter)?.name}` : ''}`}
          action={
            <div className="flex gap-1">
              {[
                { key: 'week',  label: 'This week' },
                { key: 'month', label: 'This month' },
                { key: 'all',   label: 'All upcoming' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setUpcomingFilter(f.key)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors min-h-[32px] ${
                    upcomingFilter === f.key
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-300 border border-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        />
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Player</th>
                  {!isFiltered && (
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden sm:table-cell">Coach</th>
                  )}
                  <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Date & Time</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Type</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Status</th>
                  <th className="text-xs text-slate-500 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {upcomingFiltered.slice(0, 15).map(s => {
                  const player = getPlayerById(s.playerId)
                  const coach  = getCoachById(s.coachId)
                  const color  = COACH_COLORS[s.coachId]
                  return (
                    <tr key={s.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-200">{player?.name}</p>
                        {s.venue && <p className="text-xs text-slate-600 mt-0.5">📍 {s.venue}</p>}
                      </td>
                      {!isFiltered && (
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-slate-400 text-xs">{coach?.name}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-400 text-xs">{format(s.start, 'E d MMM, h:mm a')}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge label={s.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} colour={s.type === 'recurring' ? 'indigo' : 'slate'} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge label="Booked" colour="blue" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button className="text-xs text-amber-500 hover:text-amber-400 px-2 py-1 rounded transition-colors">Reschedule</button>
                          <button className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded transition-colors">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {upcomingFiltered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500 text-sm">
                      No sessions in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {upcomingFiltered.length > 15 && (
            <div className="px-4 py-3 border-t border-slate-800">
              <p className="text-xs text-slate-500">Showing 15 of {upcomingFiltered.length} sessions</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Players panel ───────────────────────────────────────────────────── */}
      <div>
        <SectionHeader
          title="Players"
          sub={`${filteredPlayers.length} player${filteredPlayers.length !== 1 ? 's' : ''}${isFiltered ? ` · ${getCoachById(coachFilter)?.name}` : ' across all coaches'}`}
        />
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Player</th>
                  {!isFiltered && (
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden sm:table-cell">Coach</th>
                  )}
                  <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Next session</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Last session</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map(player => {
                  const ps      = filteredSessions.filter(s => s.playerId === player.id)
                  const nextS   = ps.filter(s => isFuture(s.start) && s.status === 'booked').sort((a, b) => a.start - b.start)[0]
                  const lastS   = ps.filter(s => s.status === 'completed').sort((a, b) => b.start - a.start)[0]
                  const coachId = player.coachId
                  const coach   = getCoachById(coachId)
                  const color   = COACH_COLORS[coachId]
                  return (
                    <tr key={player.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-200">{player.name}</p>
                        <p className="text-xs text-slate-500">{player.email}</p>
                      </td>
                      {!isFiltered && (
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-slate-400 text-xs">{coach?.name}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                        {nextS ? format(nextS.start, 'd MMM, h:mm a') : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                        {lastS ? format(lastS.start, 'd MMM yyyy') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Late cancellations ───────────────────────────────────────────────── */}
      {filteredCancels.length > 0 && (
        <div>
          <SectionHeader
            title="Late Cancellations"
            sub={`${filteredCancels.length} in the last 30 days${isFiltered ? ` · ${getCoachById(coachFilter)?.name}` : ''}`}
          />
          <div className="space-y-2">
            {filteredCancels.map(lc => {
              const player = getPlayerById(lc.playerId)
              const coach  = getCoachById(lc.coachId)
              const color  = COACH_COLORS[lc.coachId]
              return (
                <div key={lc.id} className="bg-slate-900 border border-red-900/40 rounded-xl p-4 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <span className="text-red-400 text-lg flex-shrink-0">⚠</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-200">{player?.name}</p>
                      <Badge label="Late cancel" colour="red" />
                      <Badge label={`${lc.hoursNotice}h notice`} colour="amber" />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <p className="text-xs text-slate-500">Session: {format(lc.sessionStart, 'E d MMM, h:mm a')}</p>
                      {!isFiltered && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          {coach?.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-red-400 flex-shrink-0">1 credit forfeited</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Outstanding invoices ─────────────────────────────────────────────── */}
      {outstanding.length > 0 && (
        <div>
          <SectionHeader
            title="Outstanding Invoices"
            sub={`${outstanding.length} unpaid · $${outstanding.reduce((s, i) => s + i.amount, 0)} total${isFiltered ? ` · ${getCoachById(coachFilter)?.name} only` : ''}`}
          />
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Player</th>
                    {!isFiltered && (
                      <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden sm:table-cell">Coach</th>
                    )}
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Amount</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Invoice date</th>
                    <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Days outstanding</th>
                    <th className="text-xs text-slate-500 font-medium px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map(inv => {
                    const player  = getPlayerById(inv.playerId)
                    const coach   = getCoachById(inv.coachId)
                    const daysOut = differenceInDays(now, inv.date)
                    return (
                      <tr key={inv.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium text-slate-200">{player?.name}</td>
                        {!isFiltered && (
                          <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{coach?.name}</td>
                        )}
                        <td className="px-4 py-3 font-semibold text-amber-400">${inv.amount}.00</td>
                        <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{format(inv.date, 'd MMM yyyy')}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`text-xs font-semibold ${daysOut > 14 ? 'text-red-400' : 'text-amber-400'}`}>
                            {daysOut}d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Resend →</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
