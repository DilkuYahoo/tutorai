import { useState } from 'react'
import BaseModal from '@/components/ui/BaseModal'
import BaseButton from '@/components/ui/BaseButton'
import BaseTextarea from '@/components/ui/BaseTextarea'
import BaseSelect from '@/components/ui/BaseSelect'
import { useInterviews } from '@/hooks/useInterviews'
import { useCandidates } from '@/hooks/useCandidates'
import { useJobs } from '@/hooks/useJobs'

const STARS = [1, 2, 3, 4, 5]

export default function FeedbackModal() {
  const { isFeedbackModalOpen, activeFeedbackInterview, closeFeedbackModal, submitFeedback } = useInterviews()
  const [rating, setRating]           = useState(0)
  const [strengths, setStrengths]     = useState('')
  const [concerns, setConcerns]       = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await submitFeedback(activeFeedbackInterview.id, { rating, strengths, concerns, recommendation })
      setRating(0); setStrengths(''); setConcerns(''); setRecommendation('')
    } catch (err) {
      setError(err.message || 'Failed to submit feedback')
    } finally {
      setSaving(false)
    }
  }

  const { candidates } = useCandidates()
  const { jobs } = useJobs()

  if (!activeFeedbackInterview) return null

  const candidate = candidates.find(c => c.id === activeFeedbackInterview.candidateId)
  const job = jobs.find(j => j.id === activeFeedbackInterview.jobId)

  return (
    <BaseModal
      open={isFeedbackModalOpen}
      title="Submit Interview Feedback"
      onClose={closeFeedbackModal}
      footer={
        <>
          <BaseButton variant="secondary" onClick={closeFeedbackModal} disabled={saving}>Cancel</BaseButton>
          <BaseButton type="submit" form="feedback-form" disabled={!rating || !recommendation || saving}>
            {saving ? 'Submitting...' : 'Submit Feedback'}
          </BaseButton>
        </>
      }
    >
      <form id="feedback-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <div className="rounded-xl bg-slate-800/50 border border-slate-800 px-4 py-3 text-sm">
          <p className="font-medium text-white">{candidate?.firstName} {candidate?.lastName}</p>
          <p className="text-slate-400 text-xs mt-0.5">{job?.title} · {activeFeedbackInterview.type}</p>
        </div>

        {/* Star rating */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Overall Rating</p>
          <div className="flex gap-2">
            {STARS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                className={`text-2xl transition-colors ${s <= rating ? 'text-amber-400' : 'text-slate-700 hover:text-amber-300'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <BaseTextarea
          label="Strengths"
          id="strengths"
          rows={3}
          value={strengths}
          onChange={e => setStrengths(e.target.value)}
          placeholder="What stood out positively about this candidate?"
        />
        <BaseTextarea
          label="Areas of Concern"
          id="concerns"
          rows={3}
          value={concerns}
          onChange={e => setConcerns(e.target.value)}
          placeholder="Any gaps or concerns worth noting?"
        />
        <BaseSelect
          label="Recommendation"
          id="recommendation"
          options={['Advance', 'Hold', 'Reject']}
          placeholder="Select a recommendation..."
          value={recommendation}
          onChange={e => setRecommendation(e.target.value)}
        />
      </form>
    </BaseModal>
  )
}
