import { useState } from 'react'
import { format, isToday, isFuture } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import {
  sessions, players, invoices, getSessionsByCoach, getPlayerById,
} from '@/data/mock'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import SectionHeader from '@/components/ui/SectionHeader'

export default function CoachDashboardPage() {
  const { user } = useAuth()
  const coachId = user?.id || 'coach-1'
  const mySessions = getSessionsByCoach(coachId)

  const todaySessions = mySessions.filter(s => isToday(s.start))
  const upcoming = mySessions.filter(s => isFuture(s.start) && s.status === 'booked').sort((a, b) => a.start - b.start)
  const completed = mySessions.filter(s => s.status === 'completed')
  const myInvoices = invoices.filter(i => i.coachId === coachId)
  const outstanding = myInvoices.filter(i => i.status === 'pending')
  const revenue = myInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)

  // Players with active relationship
  const myPlayerIds = [...new Set(mySessions.map(s => s.playerId))]
  const myPlayers = players.filter(p => myPlayerIds.includes(p.id))

  const [commentModal, setCommentModal] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [commentText, setCommentText] = useState('')

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Coach Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Welcome back, {user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Today's sessions" value={todaySessions.length} accent />
        <StatCard label="Upcoming (week)" value={upcoming.filter(s => {
          const d = new Date(); d.setDate(d.getDate() + 7)
          return s.start <= d
        }).length} />
        <StatCard label="Completed (month)" value={completed.length} />
        <StatCard label="Revenue (month)" value={`$${revenue}`} sub="Paid invoices only" />
        <StatCard label="Outstanding invoices" value={outstanding.length} sub={`$${outstanding.reduce((s, i) => s + i.amount, 0)} total`} badge={outstanding.length > 0 ? outstanding.length : null} />
      </div>

      {/* Today's sessions */}
      <div>
        <SectionHeader title="Today's Sessions" sub={format(new Date(), 'EEEE d MMMM yyyy')} />
        {todaySessions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-slate-500 text-sm">
            No sessions scheduled today.
          </div>
        ) : (
          <div className="space-y-2">
            {todaySessions.map(s => {
              const player = getPlayerById(s.playerId)
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-100">{player?.name}</p>
                      <Badge label={s.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} colour={s.type === 'recurring' ? 'indigo' : 'slate'} />
                      <Badge label={s.status} colour={s.status === 'completed' ? 'green' : 'blue'} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{format(s.start, 'h:mm a')} – {format(s.end, 'h:mm a')}</p>
                  </div>
                  {s.status === 'booked' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCommentModal(s)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Add comment
                      </button>
                      <button
                        onClick={() => setCompleteModal(s)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
                      >
                        Mark Complete
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* My Players */}
      <div>
        <SectionHeader title="My Players" sub={`${myPlayers.length} active`} />
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Player</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden sm:table-cell">Credits</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Next session</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Last session</th>
              </tr>
            </thead>
            <tbody>
              {myPlayers.map(player => {
                const playerSessions = mySessions.filter(s => s.playerId === player.id)
                const nextS = playerSessions.filter(s => isFuture(s.start) && s.status === 'booked').sort((a, b) => a.start - b.start)[0]
                const lastS = playerSessions.filter(s => s.status === 'completed').sort((a, b) => b.start - a.start)[0]
                return (
                  <tr key={player.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-200">{player.name}</p>
                      <p className="text-xs text-slate-500">{player.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-emerald-400 font-medium">Available</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                      {nextS ? format(nextS.start, 'd MMM, h:mm a') : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                      {lastS ? format(lastS.start, 'd MMM yyyy') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming sessions */}
      <div>
        <SectionHeader title="Upcoming Sessions" />
        {upcoming.length === 0 ? (
          <p className="text-slate-500 text-sm">No upcoming sessions.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(s => {
              const player = getPlayerById(s.playerId)
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-200">{player?.name}</p>
                      <Badge label={s.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} colour={s.type === 'recurring' ? 'indigo' : 'slate'} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{format(s.start, 'EEEE d MMM, h:mm a')} · 45 min</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCommentModal(s)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Comment
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Homework outstanding */}
      <div>
        <SectionHeader title="Homework Outstanding" />
        {completed.flatMap(s =>
          (s.homework || []).filter(h => !h.completed).map(hw => ({
            ...hw,
            player: getPlayerById(s.playerId),
            sessionDate: s.start,
          }))
        ).length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-900 border border-slate-800 rounded-xl p-4">All homework is up to date. 🎉</p>
        ) : (
          <div className="space-y-2">
            {completed.flatMap(s =>
              (s.homework || []).filter(h => !h.completed).map(hw => ({
                ...hw,
                player: getPlayerById(s.playerId),
                sessionDate: s.start,
              }))
            ).map(hw => (
              <div key={hw.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
                <span className="text-amber-400 mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-medium text-slate-200">{hw.player?.name}</p>
                  <p className="text-sm text-slate-400">{hw.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{format(hw.sessionDate, 'd MMM yyyy')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add comment modal */}
      {commentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Add Session Comment</h3>
            <p className="text-xs text-slate-500 mb-4">
              {getPlayerById(commentModal.playerId)?.name} · {format(commentModal.start, 'd MMM yyyy h:mm a')}
            </p>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a note for the player..."
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <div className="flex gap-3 mt-3">
              <button onClick={() => { setCommentModal(null); setCommentText('') }} className="flex-1 text-sm border border-slate-700 text-slate-400 py-2 rounded-lg">Cancel</button>
              <button onClick={() => { setCommentModal(null); setCommentText('') }} className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition-colors">Send Comment</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Complete Session</h3>
            <p className="text-xs text-slate-500 mb-4">
              {getPlayerById(completeModal.playerId)?.name} · {format(completeModal.start, 'd MMM yyyy h:mm a')}
            </p>
            <textarea
              placeholder="Add session summary notes..."
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-2">
              This will deduct 1 credit from the player's balance and send them a session summary email.
            </p>
            <div className="flex gap-3 mt-3">
              <button onClick={() => setCompleteModal(null)} className="flex-1 text-sm border border-slate-700 text-slate-400 py-2 rounded-lg">Cancel</button>
              <button onClick={() => setCompleteModal(null)} className="flex-1 text-sm bg-emerald-700 hover:bg-emerald-600 text-white py-2 rounded-lg transition-colors">Mark Complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
