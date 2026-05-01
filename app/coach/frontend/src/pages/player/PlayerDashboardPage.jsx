import { useState } from 'react'
import { format, differenceInHours } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  creditLedger, sessions, players,
  getSessionsByPlayer, getCoachById,
} from '@/data/mock'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import SectionHeader from '@/components/ui/SectionHeader'

function UploadProgress({ progress }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Uploading…</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export default function PlayerDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

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
  // Mock upload state: { [sessionId]: progress 0-100 | 'done' }
  const [uploads, setUploads] = useState({})

  function handleFileSelect(sessionId, e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploads(u => ({ ...u, [sessionId]: 0 }))
    // Simulate upload progress
    let pct = 0
    const interval = setInterval(() => {
      pct += Math.floor(Math.random() * 20) + 5
      if (pct >= 100) {
        clearInterval(interval)
        setUploads(u => ({ ...u, [sessionId]: 'done' }))
      } else {
        setUploads(u => ({ ...u, [sessionId]: pct }))
      }
    }, 400)
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
          <div className="flex gap-2 flex-wrap">
            {childPlayers.map(child => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child.id)}
                className={`text-sm px-4 py-2 rounded-xl border transition-colors min-h-[44px] ${
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
            className="text-sm bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl transition-colors flex-shrink-0 min-h-[44px]"
          >
            Top up
          </button>
        </div>
      )}

      {/* Credit cards */}
      <div>
        <SectionHeader title="Credit Balance" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Available" value={ledger.available} accent sub="Ready to book" />
          <StatCard label="Committed" value={ledger.committed} sub="Booked sessions" />
          <StatCard label="Total Purchased" value={ledger.totalPurchased} sub="All time" />
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Buy credits</p>
            <button
              onClick={() => navigate('/coaches')}
              className="mt-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl transition-colors min-h-[44px]"
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
            <button onClick={() => navigate('/coaches')} className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 py-1">
              Find a coach and book now →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map(s => {
              const coach = getCoachById(s.coachId)
              const late = differenceInHours(s.start, new Date()) < 24
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-100">{format(s.start, 'EEEE d MMM, h:mm a')}</p>
                        <Badge label={s.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} colour={s.type === 'recurring' ? 'indigo' : 'slate'} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">with {coach?.name} · 45 min</p>
                      {s.venue && (
                        <p className="text-xs text-slate-500 mt-0.5">📍 {s.venue}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                      <button
                        disabled={late}
                        title={late ? 'Less than 24 hrs — credit forfeited if cancelled' : 'Cancel session'}
                        onClick={() => setCancelModal(s)}
                        className={`flex-1 sm:flex-none text-sm px-4 py-2.5 rounded-xl border transition-colors min-h-[44px] ${
                          late
                            ? 'border-slate-700 text-slate-600 cursor-not-allowed'
                            : 'border-red-800 text-red-400 hover:bg-red-950/50'
                        }`}
                      >
                        Cancel
                      </button>
                      <button className="flex-1 sm:flex-none text-sm px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors min-h-[44px]">
                        Reschedule
                      </button>
                    </div>
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
              const uploadState = uploads[s.id]
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  {/* Session row */}
                  <button
                    onClick={() => setExpandedSession(isOpen ? null : s.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-800/50 transition-colors min-h-[60px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-100">{format(s.start, 'EEEE d MMM, h:mm a')}</p>
                        <Badge label="Completed" colour="green" />
                        {s.invoice?.status === 'pending' && <Badge label="Invoice pending" colour="amber" />}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">with {coach?.name} · 45 min</p>
                    </div>
                    <span className="text-slate-500 text-sm flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-4 border-t border-slate-800 pt-4">
                      {/* Session details */}
                      <div className="bg-slate-800 rounded-xl p-3 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Date</span>
                          <span className="text-slate-200">{format(s.start, 'EEEE d MMMM yyyy')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Time</span>
                          <span className="text-slate-200">{format(s.start, 'h:mm a')} – {format(s.end, 'h:mm a')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Coach</span>
                          <span className="text-slate-200">{coach?.name}</span>
                        </div>
                        {s.venue && (
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500 flex-shrink-0">Venue</span>
                            <span className="text-slate-200 text-right">{s.venue}</span>
                          </div>
                        )}
                      </div>

                      {/* Coach summary */}
                      {s.summary && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1.5">Session Summary</p>
                          <p className="text-sm text-slate-300 bg-slate-800 rounded-xl p-3 leading-relaxed">{s.summary}</p>
                        </div>
                      )}

                      {/* Coach training videos */}
                      {s.videos?.filter(v => v.uploadedBy === 'coach').length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1.5">Training Videos</p>
                          <div className="space-y-2">
                            {s.videos.filter(v => v.uploadedBy === 'coach').map(v => (
                              <div key={v.id} className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                                <span className="text-2xl flex-shrink-0">🎥</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-300 truncate">{v.title || 'Training video'}</p>
                                  <a href={v.url} className="text-xs text-indigo-400 hover:underline">Watch →</a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Player video upload */}
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1.5">Upload a video for coach review</p>
                        {uploadState === 'done' ? (
                          <div className="bg-emerald-950/50 border border-emerald-700 rounded-xl p-3 flex items-center gap-3">
                            <span className="text-emerald-400 text-lg">✓</span>
                            <div>
                              <p className="text-sm text-emerald-400 font-medium">Video uploaded</p>
                              <p className="text-xs text-slate-500">Your coach will be notified to review it.</p>
                            </div>
                          </div>
                        ) : uploadState !== undefined ? (
                          <div className="border border-slate-700 rounded-xl p-4">
                            <p className="text-sm text-slate-300">Uploading video…</p>
                            <UploadProgress progress={uploadState} />
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-3 border-2 border-dashed border-slate-700 hover:border-indigo-600 rounded-xl p-5 cursor-pointer transition-colors active:scale-[0.98] min-h-[80px]">
                            <span className="text-3xl">📹</span>
                            <div>
                              <p className="text-sm font-medium text-slate-300">Tap to upload video</p>
                              <p className="text-xs text-slate-500 mt-0.5">Any format · No size limit</p>
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept="video/*"
                              onChange={e => handleFileSelect(s.id, e)}
                            />
                          </label>
                        )}

                        {/* Player-uploaded videos awaiting response */}
                        {s.videos?.filter(v => v.uploadedBy === 'player').map(v => (
                          <div key={v.id} className="mt-2 bg-slate-800 rounded-xl p-3">
                            <p className="text-xs text-slate-500 mb-1">Your uploaded video</p>
                            {v.reviewText ? (
                              <div>
                                <p className="text-xs text-indigo-400 mb-1">Coach response</p>
                                <p className="text-sm text-slate-300">{v.reviewText}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-amber-400">⏳ Awaiting coach review</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Coach comments */}
                      {s.comments?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-400 mb-1.5">Coach Comments</p>
                          <div className="space-y-2">
                            {s.comments.map(c => (
                              <div key={c.id} className="bg-slate-800 rounded-xl p-3 text-sm text-slate-300">
                                <p className="leading-relaxed">{c.body}</p>
                                <p className="text-xs text-slate-500 mt-1.5">{format(c.date, 'd MMM yyyy')}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Invoice */}
                      {s.invoice && (
                        <div className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
                          <div>
                            <p className="text-xs text-slate-500">Invoice</p>
                            <p className="text-sm font-semibold text-slate-200">${s.invoice.amount}.00 incl. GST</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              label={s.invoice.status === 'paid' ? 'Paid' : 'Pending'}
                              colour={s.invoice.status === 'paid' ? 'green' : 'amber'}
                            />
                            {s.invoice.status === 'pending' && (
                              <button className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-colors min-h-[44px]">
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

      {/* Cancel modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm animate-fade-up">
            <h3 className="text-base font-semibold text-slate-100 mb-2">Cancel Session</h3>
            <p className="text-sm text-slate-400 mb-1">
              <strong className="text-slate-200">{format(cancelModal.start, 'EEEE d MMM, h:mm a')}</strong>
            </p>
            {cancelModal.venue && (
              <p className="text-xs text-slate-500 mb-3">📍 {cancelModal.venue}</p>
            )}
            <p className="text-sm text-slate-400 mb-5">
              Your credit will be returned to your available balance.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal(null)}
                className="flex-1 text-sm border border-slate-700 text-slate-400 py-3 rounded-xl min-h-[52px]"
              >
                Keep it
              </button>
              <button
                onClick={() => setCancelModal(null)}
                className="flex-1 text-sm bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl transition-colors min-h-[52px]"
              >
                Cancel session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
