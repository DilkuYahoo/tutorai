import { useState } from 'react'
import { format, isPast, differenceInHours } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  creditLedger, sessions, players, parents,
  getSessionsByPlayer, getCoachById,
} from '@/data/mock'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import SectionHeader from '@/components/ui/SectionHeader'

export default function PlayerDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // For parent, show child switcher
  const isParent = user?.role === 'parent'
  const childIds = isParent ? (user?.childIds || []) : []
  const childPlayers = isParent ? players.filter(p => childIds.includes(p.id)) : []
  const [selectedChild, setSelectedChild] = useState(isParent ? childPlayers[0]?.id : null)

  const playerId = isParent ? selectedChild : user?.id || 'player-1'
  const ledger = creditLedger[playerId] || { available: 0, committed: 0, totalPurchased: 0 }
  const mySessions = getSessionsByPlayer(playerId)
  const upcoming = mySessions.filter(s => s.status === 'booked').sort((a, b) => a.start - b.start)
  const completed = mySessions.filter(s => s.status === 'completed').sort((a, b) => b.start - a.start)

  const [expandedSession, setExpandedSession] = useState(null)
  const [cancelModal, setCancelModal] = useState(null)

  function canCancel(session) {
    return differenceInHours(session.start, new Date()) >= 24
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            {isParent ? `${user.name}'s Dashboard` : `Welcome back, ${user?.name?.split(' ')[0]}`}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Your coaching journey at a glance</p>
        </div>
        {isParent && childPlayers.length > 0 && (
          <div className="flex gap-2">
            {childPlayers.map(child => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  selectedChild === child.id
                    ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                {child.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Low credit alert */}
      {ledger.available <= 2 && (
        <div className="bg-amber-950/50 border border-amber-700 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-amber-400 text-sm">
            ⚠️ Only <strong>{ledger.available} credit{ledger.available !== 1 ? 's' : ''}</strong> remaining — book more sessions soon.
          </p>
          <button
            onClick={() => navigate('/coaches')}
            className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            Top up credits
          </button>
        </div>
      )}

      {/* Credit cards */}
      <div>
        <SectionHeader title="Credit Balance" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Available" value={ledger.available} accent sub="Ready to book" />
          <StatCard label="Committed" value={ledger.committed} sub="Upcoming sessions" />
          <StatCard label="Total Purchased" value={ledger.totalPurchased} sub="All time" />
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Purchase</p>
            <button
              onClick={() => navigate('/coaches')}
              className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition-colors"
            >
              Buy a package →
            </button>
          </div>
        </div>
      </div>

      {/* Upcoming sessions */}
      <div>
        <SectionHeader
          title="Upcoming Sessions"
          sub={`${upcoming.length} session${upcoming.length !== 1 ? 's' : ''} booked`}
        />
        {upcoming.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
            <p className="text-slate-500 text-sm">No upcoming sessions.</p>
            <button onClick={() => navigate('/coaches')} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">
              Find a coach and book now →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(s => {
              const coach = getCoachById(s.coachId)
              const late = differenceInHours(s.start, new Date()) < 24
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-100">{format(s.start, 'EEEE d MMM, h:mm a')}</p>
                      <Badge label={s.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} colour={s.type === 'recurring' ? 'indigo' : 'slate'} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">with {coach?.name} · 45 min</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={late}
                      title={late ? 'Less than 24 hrs — credit forfeited if cancelled' : 'Cancel session'}
                      onClick={() => setCancelModal(s)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        late
                          ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                          : 'border-red-800 text-red-400 hover:bg-red-950/50'
                      }`}
                    >
                      Cancel
                    </button>
                    <button className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
                      Reschedule
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Session history */}
      <div>
        <SectionHeader title="Session History" sub={`${completed.length} completed`} />
        {completed.length === 0 ? (
          <p className="text-slate-500 text-sm">No completed sessions yet.</p>
        ) : (
          <div className="space-y-2">
            {completed.map(s => {
              const coach = getCoachById(s.coachId)
              const isOpen = expandedSession === s.id
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSession(isOpen ? null : s.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-100">{format(s.start, 'EEEE d MMM, h:mm a')}</p>
                        <Badge label="Completed" colour="green" />
                        {s.invoice?.status === 'pending' && <Badge label="Invoice pending" colour="amber" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">with {coach?.name} · 45 min</p>
                    </div>
                    <span className="text-slate-500 text-sm">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-4 border-t border-slate-800 pt-4">
                      {/* Coach summary */}
                      {s.summary && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1">Session Summary</p>
                          <p className="text-sm text-slate-300 bg-slate-800 rounded-lg p-3">{s.summary}</p>
                        </div>
                      )}

                      {/* Videos */}
                      {s.videos?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1">Videos</p>
                          {s.videos.map(v => (
                            <div key={v.id} className="bg-slate-800 rounded-lg p-3 text-sm">
                              {v.uploadedBy === 'player' && v.reviewText && (
                                <div>
                                  <p className="text-xs text-indigo-400 mb-1">Coach response to your video</p>
                                  <p className="text-slate-300">{v.reviewText}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upload video */}
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1">Upload a video for coach review</p>
                        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-700 hover:border-indigo-600 rounded-xl p-6 cursor-pointer transition-colors">
                          <span className="text-2xl">📹</span>
                          <div className="text-center">
                            <p className="text-sm font-medium text-slate-300">Tap to upload video</p>
                            <p className="text-xs text-slate-500 mt-0.5">Any format, any size</p>
                          </div>
                          <input type="file" className="hidden" accept="video/*" />
                        </label>
                      </div>

                      {/* Homework */}
                      {s.homework?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1">Homework</p>
                          <div className="space-y-2">
                            {s.homework.map(hw => (
                              <div key={hw.id} className="flex items-start gap-3 bg-slate-800 rounded-lg p-3">
                                <input
                                  type="checkbox"
                                  defaultChecked={hw.completed}
                                  className="mt-0.5 accent-indigo-500"
                                />
                                <div className="flex-1">
                                  {hw.type === 'drill' ? (
                                    <p className="text-sm text-slate-300">{hw.description}</p>
                                  ) : (
                                    <div>
                                      <p className="text-sm text-slate-300">{hw.description}</p>
                                      <a href={hw.url} className="text-xs text-indigo-400 hover:underline mt-0.5 block">Watch on YouTube →</a>
                                    </div>
                                  )}
                                </div>
                                {hw.completed && <Badge label="Done" colour="green" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Coach comments */}
                      {s.comments?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1">Coach Comments</p>
                          {s.comments.map(c => (
                            <div key={c.id} className="bg-slate-800 rounded-lg p-3 text-sm text-slate-300">
                              <p>{c.body}</p>
                              <p className="text-xs text-slate-500 mt-1">{format(c.date, 'd MMM yyyy')}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Invoice */}
                      {s.invoice && (
                        <div className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                          <div>
                            <p className="text-xs text-slate-500">Invoice</p>
                            <p className="text-sm font-medium text-slate-200">${s.invoice.amount}.00</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge label={s.invoice.status === 'paid' ? 'Paid' : 'Pending'} colour={s.invoice.status === 'paid' ? 'green' : 'amber'} />
                            {s.invoice.status === 'pending' && (
                              <button className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                                Pay now
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Homework tracker */}
      <div>
        <SectionHeader title="Outstanding Homework" />
        {completed.flatMap(s => s.homework?.filter(h => !h.completed) || []).length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-900 border border-slate-800 rounded-xl p-4">
            All homework completed! 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {completed.flatMap(s =>
              (s.homework || []).filter(h => !h.completed).map(hw => ({
                ...hw,
                sessionDate: s.start,
                coachName: getCoachById(s.coachId)?.name,
              }))
            ).map(hw => (
              <div key={hw.id} className="flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <input type="checkbox" className="mt-0.5 accent-indigo-500" />
                <div className="flex-1">
                  <p className="text-sm text-slate-300">{hw.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {hw.coachName} · {format(hw.sessionDate, 'd MMM yyyy')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-2">Cancel Session</h3>
            <p className="text-sm text-slate-400 mb-4">
              Cancel your session on <strong className="text-slate-200">{format(cancelModal.start, 'EEEE d MMM, h:mm a')}</strong>?
              Your credit will be returned to your available balance.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(null)} className="flex-1 text-sm border border-slate-700 text-slate-400 py-2 rounded-lg">Keep it</button>
              <button onClick={() => setCancelModal(null)} className="flex-1 text-sm bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg transition-colors">Cancel session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
