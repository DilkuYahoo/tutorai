import { useState } from 'react'
import BaseBadge from '@/components/ui/BaseBadge'
import BaseButton from '@/components/ui/BaseButton'
import { useInterviews } from '@/hooks/useInterviews'
import { useCandidates } from '@/hooks/useCandidates'
import { useJobs } from '@/hooks/useJobs'
import { useUsers } from '@/hooks/useUsers'

const STATUS_VARIANT = {
  Scheduled: 'indigo',
  Completed: 'emerald',
  Cancelled: 'red',
  'No-show': 'amber',
}

export default function InterviewRow({ interview, onExpand, expanded }) {
  const { openFeedbackModal, openScheduleModal, updateInterview } = useInterviews()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)
  const { candidates } = useCandidates()
  const { jobs } = useJobs()
  const { userById } = useUsers()

  const candidate = candidates.find(c => c.id === interview.candidateId)
  const job = jobs.find(j => j.id === interview.jobId)
  const panel = (interview.panelIds ?? []).map(id => userById(id)?.name ?? id).join(', ')

  const dt = new Date(interview.scheduledAt)
  const endDt = new Date(dt.getTime() + interview.durationMinutes * 60000)
  const now = new Date()
  const isOngoing = now >= dt && now <= endDt && interview.status === 'Scheduled'
  const dateStr = dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = dt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  const rowCls = isOngoing
    ? 'border-b border-slate-800/60 bg-emerald-950/30 hover:bg-emerald-950/50 transition-colors'
    : 'border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors'

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) return
    setCancelSaving(true)
    try {
      await updateInterview(interview.id, { status: 'Cancelled', cancellationReason: cancelReason.trim() })
      setCancelOpen(false)
    } finally {
      setCancelSaving(false)
    }
  }

  return (
    <>
      <tr className={rowCls}>
        <td className="px-4 py-3">
          <div className="font-medium text-white flex items-center gap-2">
            {candidate?.firstName} {candidate?.lastName}
            {isOngoing && <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">Ongoing</span>}
          </div>
          <div className="text-xs text-slate-500">{job?.title}</div>
        </td>
        <td className="px-4 py-3 text-slate-400 text-sm hidden sm:table-cell">{interview.type}</td>
        <td className="px-4 py-3 hidden md:table-cell">
          <div className="text-sm text-slate-300">{dateStr}</div>
          <div className="text-xs text-slate-500">{timeStr} · {interview.durationMinutes} min</div>
        </td>
        <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">{panel}</td>
        <td className="px-4 py-3">
          <BaseBadge label={interview.status} variant={STATUS_VARIANT[interview.status] ?? 'slate'} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {interview.status === 'Scheduled' && (
              <>
                <BaseButton size="sm" variant="secondary" onClick={() => openScheduleModal(
                  { applicationId: interview.applicationId, candidateId: interview.candidateId,
                    jobId: interview.jobId,
                    candidateName: `${candidate?.firstName ?? ''} ${candidate?.lastName ?? ''}`.trim(),
                    jobTitle: job?.title ?? '' },
                  interview.id
                )}>
                  Reschedule
                </BaseButton>
                <BaseButton size="sm" variant="secondary" onClick={() => openFeedbackModal(interview.id)}>
                  Feedback
                </BaseButton>
                <button
                  onClick={() => { setCancelOpen(true); setCancelReason('') }}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
            {interview.status === 'Completed' && (
              <button
                onClick={() => onExpand && onExpand(interview.id)}
                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
              >
                {expanded ? 'Hide feedback ↑' : 'View feedback ↓'}
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Feedback expand row */}
      {expanded && interview.status === 'Completed' && (
        <tr className="bg-slate-900/60 border-b border-slate-800/40">
          <td colSpan={6} className="px-6 py-4">
            {interview.feedback ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-medium">{'★'.repeat(interview.feedback.rating)}{'☆'.repeat(5 - interview.feedback.rating)}</span>
                  <span className="text-slate-300 font-medium">{interview.feedback.recommendation}</span>
                  <span className="text-xs text-slate-500">{interview.feedback.submittedAt ? new Date(interview.feedback.submittedAt).toLocaleDateString('en-AU') : ''}</span>
                </div>
                {interview.feedback.strengths && <p className="text-slate-400"><span className="text-slate-500">Strengths:</span> {interview.feedback.strengths}</p>}
                {interview.feedback.concerns && <p className="text-slate-400"><span className="text-slate-500">Concerns:</span> {interview.feedback.concerns}</p>}
                {interview.feedback.notes && <p className="text-slate-400"><span className="text-slate-500">Notes:</span> {interview.feedback.notes}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No feedback recorded yet.</p>
            )}
          </td>
        </tr>
      )}

      {/* Cancel reason modal */}
      {cancelOpen && (
        <tr><td colSpan={6} className="p-0">
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCancelOpen(false)}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-white">Cancel Interview</h3>
              <p className="text-sm text-slate-400">
                Cancelling interview for <span className="text-white font-medium">{`${candidate?.firstName ?? ''} ${candidate?.lastName ?? ''}`.trim()}</span>.
                Please provide a reason — this will be recorded in the audit trail.
              </p>
              <textarea
                autoFocus
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-red-500/50 resize-none"
                rows={3}
                placeholder="e.g. Candidate requested reschedule, panel member unavailable..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setCancelOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                  Keep interview
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={!cancelReason.trim() || cancelSaving}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {cancelSaving ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        </td></tr>
      )}
    </>
  )
}
