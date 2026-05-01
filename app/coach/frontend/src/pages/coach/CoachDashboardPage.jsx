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

  const myPlayerIds = [...new Set(mySessions.map(s => s.playerId))]
  const myPlayers = players.filter(p => myPlayerIds.includes(p.id))

  const [commentModal, setCommentModal] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  function simulateUpload() {
    setUploading(true)
    setUploadProgress(0)
    let pct = 0
    const interval = setInterval(() => {
      pct += Math.floor(Math.random() * 25) + 10
      if (pct >= 100) {
        clearInterval(interval)
        setUploading(false)
        setUploadProgress(100)
      } else {
        setUploadProgress(pct)
      }
    }, 400)
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Coach Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Welcome back, {user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Today's sessions" value={todaySessions.length} accent />
        <StatCard label="Upcoming (7d)" value={upcoming.filter(s => {
          const d = new Date(); d.setDate(d.getDate() + 7); return s.start <= d
        }).length} />
        <StatCard label="Completed (month)" value={completed.length} />
        <StatCard label="Revenue (month)" value={`$${revenue}`} sub="Paid invoices" />
        <StatCard label="Outstanding" value={outstanding.length} sub={`$${outstanding.reduce((s, i) => s + i.amount, 0)} total`} badge={outstanding.length > 0 ? outstanding.length : null} />
      </div>

      {/* Today's sessions */}
      <div>
        <SectionHeader title="Today's Sessions" sub={format(new Date(), 'EEEE d MMMM yyyy')} />
        {todaySessions.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-slate-500 text-sm">
            No sessions today.
          </div>
        ) : (
          <div className="space-y-2">
            {todaySessions.map(s => {
              const player = getPlayerById(s.playerId)
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-100">{player?.name}</p>
                        <Badge label={s.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} colour={s.type === 'recurring' ? 'indigo' : 'slate'} />
                        <Badge label={s.status} colour={s.status === 'completed' ? 'green' : 'blue'} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{format(s.start, 'h:mm a')} – {format(s.end, 'h:mm a')}</p>
                      {s.venue && <p className="text-xs text-slate-500 mt-0.5">📍 {s.venue}</p>}
                    </div>
                    {s.status === 'booked' && (
                      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                        <button
                          onClick={() => setCommentModal(s)}
                          className="flex-1 sm:flex-none text-sm px-3 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors min-h-[44px]"
                        >
                          Comment
                        </button>
                        <button
                          onClick={() => { setCompleteModal(s); setUploadProgress(0); setUploading(false) }}
                          className="flex-1 sm:flex-none text-sm px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white transition-colors min-h-[44px] font-medium"
                        >
                          Complete ✓
                        </button>
                      </div>
                    )}
                  </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">Player</th>
                  <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden sm:table-cell">Next session</th>
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
                      <td className="px-4 py-3 text-slate-400 hidden sm:table-cell text-xs">
                        {nextS ? (
                          <div>
                            <p>{format(nextS.start, 'd MMM, h:mm a')}</p>
                            {nextS.venue && <p className="text-slate-600 mt-0.5">📍 {nextS.venue}</p>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 hidden md:table-cell text-xs">
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

      {/* Upcoming sessions */}
      <div>
        <SectionHeader title="Upcoming Sessions" />
        {upcoming.length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-900 border border-slate-800 rounded-xl p-4">No upcoming sessions.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(s => {
              const player = getPlayerById(s.playerId)
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-200">{player?.name}</p>
                        <Badge label={s.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} colour={s.type === 'recurring' ? 'indigo' : 'slate'} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{format(s.start, 'EEEE d MMM, h:mm a')} · 45 min</p>
                      {s.venue && <p className="text-xs text-slate-500 mt-0.5">📍 {s.venue}</p>}
                    </div>
                    <button
                      onClick={() => setCommentModal(s)}
                      className="flex-shrink-0 text-sm px-3 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors min-h-[44px]"
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

      {/* Add comment modal */}
      {commentModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Add Session Comment</h3>
            <p className="text-xs text-slate-500 mb-4">
              {getPlayerById(commentModal.playerId)?.name} · {format(commentModal.start, 'd MMM yyyy h:mm a')}
            </p>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a note for the player…"
              rows={4}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1.5">Player will receive an email notification.</p>
            <div className="flex gap-3 mt-3">
              <button onClick={() => { setCommentModal(null); setCommentText('') }} className="flex-1 text-sm border border-slate-700 text-slate-400 py-3 rounded-xl min-h-[52px]">Cancel</button>
              <button onClick={() => { setCommentModal(null); setCommentText('') }} className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl transition-colors min-h-[52px]">Send Comment</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete session modal — mobile-optimised */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md animate-fade-up max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Complete Session</h3>
            <p className="text-xs text-slate-500 mb-4">
              {getPlayerById(completeModal.playerId)?.name} · {format(completeModal.start, 'd MMM yyyy h:mm a')}
              {completeModal.venue && <span className="block mt-0.5">📍 {completeModal.venue}</span>}
            </p>

            <div className="space-y-4">
              {/* Session summary with voice-to-text hint */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400 font-medium">Session summary</label>
                  <button className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    🎤 Voice to text
                  </button>
                </div>
                <textarea
                  placeholder="What did you cover today?"
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Training video upload */}
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">Training videos</label>
                {uploadProgress === 100 ? (
                  <div className="bg-emerald-950/50 border border-emerald-700 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-emerald-400">✓</span>
                    <p className="text-sm text-emerald-400">Video uploaded</p>
                  </div>
                ) : uploading ? (
                  <div className="border border-slate-700 rounded-xl p-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Uploading…</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">Upload continues if you background the app.</p>
                  </div>
                ) : (
                  <label
                    className="flex items-center justify-center gap-3 border-2 border-dashed border-slate-700 hover:border-indigo-600 active:scale-[0.98] rounded-xl cursor-pointer transition-colors min-h-[72px]"
                    onClick={simulateUpload}
                  >
                    <span className="text-3xl">🎥</span>
                    <div>
                      <p className="text-sm font-medium text-slate-300">Tap to upload video</p>
                      <p className="text-xs text-slate-500">Any format · No size limit · Starts immediately</p>
                    </div>
                    <input type="file" className="hidden" accept="video/*" />
                  </label>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4 bg-slate-800 rounded-xl px-3 py-2">
              Completing this session deducts 1 credit from {getPlayerById(completeModal.playerId)?.name}'s balance and sends them a summary email.
            </p>

            {/* Quick action buttons — large for thumb use */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setCompleteModal(null)}
                className="flex-1 text-sm border border-slate-700 text-slate-400 py-3.5 rounded-xl min-h-[56px]"
              >
                Cancel
              </button>
              <button
                onClick={() => setCompleteModal(null)}
                className="flex-1 text-sm bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl transition-colors min-h-[56px] font-semibold"
              >
                Mark Complete ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
