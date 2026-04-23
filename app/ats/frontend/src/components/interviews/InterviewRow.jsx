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

export default function InterviewRow({ interview }) {
  const { openFeedbackModal, openScheduleModal, updateInterview } = useInterviews()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const { candidates } = useCandidates()
  const { jobs } = useJobs()
  const { userById } = useUsers()
  const candidate = candidates.find(c => c.id === interview.candidateId)
  const job = jobs.find(j => j.id === interview.jobId)
  const panel = (interview.panelIds ?? [])
    .map(id => userById(id)?.name ?? id)
    .join(', ')

  const dt = new Date(interview.scheduledAt)
  const dateStr = dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = dt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  return (
    <tr className="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-white">{candidate?.firstName} {candidate?.lastName}</div>
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
        <div className="flex items-center gap-2">
          {interview.status === 'Scheduled' && (
            <>
              <BaseButton size="sm" variant="secondary" onClick={() => openScheduleModal(
                { applicationId: interview.applicationId, candidateId: interview.candidateId,
                  jobId: interview.jobId, candidateName: `${candidate?.firstName ?? ''} ${candidate?.lastName ?? ''}`.trim(), jobTitle: job?.title ?? '' },
                interview.id
              )}>
                Reschedule
              </BaseButton>
              <BaseButton size="sm" variant="secondary" onClick={() => openFeedbackModal(interview.id)}>
                Feedback
              </BaseButton>
              {confirmCancel ? (
                <span className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => { updateInterview(interview.id, { status: 'Cancelled' }); setConfirmCancel(false) }}
                    className="text-red-400 hover:text-red-300 font-medium"
                  >
                    Confirm
                  </button>
                  <span className="text-slate-600">·</span>
                  <button onClick={() => setConfirmCancel(false)} className="text-slate-500 hover:text-slate-300">
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  Cancel
                </button>
              )}
            </>
          )}
          {interview.status === 'Completed' && interview.feedback && (
            <span className="text-xs text-emerald-400">{'★'.repeat(interview.feedback.rating)} {interview.feedback.recommendation}</span>
          )}
        </div>
      </td>
    </tr>
  )
}
