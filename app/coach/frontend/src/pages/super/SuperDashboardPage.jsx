import { useState } from 'react'
import { format, isToday, isFuture } from 'date-fns'
import { sessions, coaches, superCoach, players, invoices, getPlayerById, getCoachById, COACH_COLORS } from '@/data/mock'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import SectionHeader from '@/components/ui/SectionHeader'

const allCoaches = [superCoach, ...coaches]

export default function SuperDashboardPage() {
  const [coachFilter, setCoachFilter] = useState('all')

  const filteredSessions = coachFilter === 'all'
    ? sessions
    : sessions.filter(s => s.coachId === coachFilter)

  const todaySessions = filteredSessions.filter(s => isToday(s.start))
  const upcoming = filteredSessions.filter(s => isFuture(s.start) && s.status === 'booked').sort((a, b) => a.start - b.start)
  const completed = filteredSessions.filter(s => s.status === 'completed')
  const outstanding = invoices.filter(i => i.status === 'pending')
  const revenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0)

  // Videos awaiting review (mock: 1 flagged)
  const videosAwaiting = 1

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Super Coach Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Business-wide overview · {format(new Date(), 'd MMMM yyyy')}</p>
        </div>
        {/* Coach filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCoachFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${coachFilter === 'all' ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300' : 'border-slate-700 text-slate-400'}`}
          >
            All coaches
          </button>
          {allCoaches.map(c => (
            <button
              key={c.id}
              onClick={() => setCoachFilter(c.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${coachFilter === c.id ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300' : 'border-slate-700 text-slate-400'}`}
            >
              {c.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Today's sessions" value={todaySessions.length} accent />
        <StatCard label="Upcoming (week)" value={upcoming.filter(s => {
          const d = new Date(); d.setDate(d.getDate() + 7); return s.start <= d
        }).length} />
        <StatCard label="Completed (month)" value={completed.length} />
        <StatCard label="Revenue (month)" value={`$${revenue}`} sub="Paid invoices" />
        <StatCard label="Outstanding" value={outstanding.length} sub={`$${outstanding.reduce((s, i) => s + i.amount, 0)}`} badge={outstanding.length > 0 ? outstanding.length : null} />
        <StatCard label="Videos to review" value={videosAwaiting} badge={videosAwaiting > 0 ? '!' : null} sub="3+ days old" />
      </div>

      {/* All coaches overview */}
      <div>
        <SectionHeader title="Coaches" sub={`${allCoaches.length} active coaches`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {allCoaches.map(coach => {
            const coachSessions = sessions.filter(s => s.coachId === coach.id)
            const coachUpcoming = coachSessions.filter(s => isFuture(s.start) && s.status === 'booked').length
            const coachRevenue = invoices.filter(i => i.coachId === coach.id && i.status === 'paid').reduce((s, i) => s + i.amount, 0)
            const color = COACH_COLORS[coach.id]
            return (
              <div key={coach.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <img src={coach.photo} alt={coach.name} className="w-10 h-10 rounded-full object-cover" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900" style={{ backgroundColor: color }}></span>
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

      {/* Upcoming sessions */}
      <div>
        <SectionHeader title="All Upcoming Sessions" sub={`${upcoming.length} scheduled`} />
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Player</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden sm:table-cell">Coach</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Date & Time</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Type</th>
                <th className="text-xs text-slate-500 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.slice(0, 10).map(s => {
                const player = getPlayerById(s.playerId)
                const coach = getCoachById(s.coachId)
                const color = COACH_COLORS[s.coachId]
                return (
                  <tr key={s.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-200">{player?.name}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                        <span className="text-slate-400">{coach?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{format(s.start, 'E d MMM, h:mm a')}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge label={s.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} colour={s.type === 'recurring' ? 'indigo' : 'slate'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded">Edit</button>
                        <button className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded">Cancel</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {upcoming.length > 10 && (
            <div className="px-4 py-3 border-t border-slate-800">
              <p className="text-xs text-slate-500">Showing 10 of {upcoming.length} sessions</p>
            </div>
          )}
        </div>
      </div>

      {/* Outstanding invoices */}
      {outstanding.length > 0 && (
        <div>
          <SectionHeader title="Outstanding Invoices" sub={`${outstanding.length} unpaid · $${outstanding.reduce((s, i) => s + i.amount, 0)} total`} />
          <div className="space-y-2">
            {outstanding.map(inv => {
              const player = getPlayerById(inv.playerId)
              const coach = getCoachById(inv.coachId)
              return (
                <div key={inv.id} className="bg-slate-900 border border-amber-800/40 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{player?.name}</p>
                    <p className="text-xs text-slate-500">{coach?.name} · {format(inv.date, 'd MMM yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-amber-400">${inv.amount}.00</p>
                    <Badge label="Pending" colour="amber" />
                    <button className="text-xs text-slate-400 hover:text-slate-200">Resend invoice</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
