import { useState, useEffect } from 'react'
import BaseDrawer from '@/components/ui/BaseDrawer'
import BaseSelect from '@/components/ui/BaseSelect'
import BaseButton from '@/components/ui/BaseButton'
import StageBadge from './StageBadge'
import CandidateTagList from './CandidateTagList'
import { useCandidates } from '@/hooks/useCandidates'
import { useInterviews } from '@/hooks/useInterviews'
import { PIPELINE_STAGES } from '@/data/mockData'
import { USE_API, api } from '@/services/api'

const ACTION_LABELS = {
  FIT_SCORE_UPDATED:     'Fit score updated',
  STAGE_MOVED:           'Stage moved',
  INTERVIEW_CANCELLED:   'Interview cancelled',
  INTERVIEW_SCHEDULED:   'Interview scheduled',
  FEEDBACK_SUBMITTED:    'Feedback submitted',
}

function AuditTimeline({ appId }) {
  const [entries, setEntries] = useState(null)
  const [error, setError]     = useState(false)

  useEffect(() => {
    if (!appId) return
    setEntries(null)
    setError(false)
    if (!USE_API) { setEntries([]); return }
    api.get(`/audit/${appId}`)
      .then(data => setEntries(data ?? []))
      .catch(() => setError(true))
  }, [appId])

  if (error) return <p className="text-xs text-red-400">Could not load activity.</p>
  if (entries === null) return <p className="text-xs text-slate-500 animate-pulse">Loading…</p>
  if (entries.length === 0) return <p className="text-xs text-slate-600">No activity recorded yet.</p>

  return (
    <ol className="space-y-3">
      {entries.map((e, i) => (
        <li key={i} className="flex gap-3">
          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
          <div>
            <p className="text-xs text-slate-300">{ACTION_LABELS[e.action] ?? e.action}</p>
            {e.detail && <p className="text-xs text-slate-500 mt-0.5">{e.detail}</p>}
            <p className="text-xs text-slate-600 mt-0.5">
              {e.actorName || 'System'} · {e.timestamp ? new Date(e.timestamp).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function CandidateDrawer() {
  const { isDrawerOpen, activeApplication, activeCandidate, closeDrawer, moveStage, updateApplication, addNote, _updateCandidate } = useCandidates()
  const { openScheduleModal } = useInterviews()
  const [noteInput, setNoteInput] = useState('')
  const [newStage, setNewStage] = useState('')
  const [commScore, setCommScore] = useState(null)
  const [commSaved, setCommSaved] = useState(false)
  const [fitScore, setFitScore] = useState(null)
  const [fitSaved, setFitSaved] = useState(false)

  useEffect(() => {
    setCommScore(null)
    setCommSaved(false)
    setFitScore(null)
    setFitSaved(false)
  }, [activeCandidate?.id])

  if (!activeApplication || !activeCandidate) return null

  const handleMoveStage = () => {
    if (newStage && newStage !== activeApplication.stage) {
      moveStage(activeApplication.id, newStage)
      setNewStage('')
    }
  }

  const handleAddNote = (e) => {
    e.preventDefault()
    if (noteInput.trim()) {
      addNote(activeCandidate.id, noteInput.trim())
      setNoteInput('')
    }
  }

  return (
    <BaseDrawer
      open={isDrawerOpen}
      title={`${activeCandidate.firstName} ${activeCandidate.lastName}`}
      onClose={closeDrawer}
      width="w-[520px]"
    >
      <div className="space-y-6">
        {/* Meta */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <StageBadge stage={activeApplication.stage} />
            <span className="text-xs text-slate-500">· {activeApplication.jobTitle ?? '—'}</span>
          </div>
          <p className="text-sm text-slate-400">{activeCandidate.email}</p>
          <p className="text-sm text-slate-400">{activeCandidate.phone}</p>
          <p className="text-xs text-slate-500">{activeCandidate.location} · via {activeCandidate.source}</p>
        </div>

        {/* Fit score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Fit Score</p>
            {fitSaved && <span className="text-xs text-emerald-400 animate-fade-in">Saved ✓</span>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const current = fitScore !== null ? fitScore : activeApplication?.fitScore
              const selected = current === n
              return (
                <button
                  key={n}
                  onClick={async () => {
                    setFitScore(n)
                    setFitSaved(false)
                    await updateApplication(activeApplication.id, { fitScore: n })
                    setFitSaved(true)
                    setTimeout(() => setFitSaved(false), 2000)
                  }}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors
                    ${selected
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-500/50 hover:text-white'
                    }`}
                >
                  {n}
                </button>
              )
            })}
            {(fitScore !== null || activeApplication?.fitScore) && (
              <span className="text-xs text-slate-500 ml-1">
                {(fitScore ?? activeApplication?.fitScore)}/10
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1.5">Tap a score to save — auto-saved immediately</p>
        </div>

        {/* Communication Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Communication Score</p>
            {commSaved && (
              <span className="text-xs text-emerald-400 animate-fade-in">Saved ✓</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const currentScore = commScore !== null ? commScore : activeCandidate.communicationScore
              const selected = currentScore === n
              return (
                <button
                  key={n}
                  onClick={async () => {
                    setCommScore(n)
                    setCommSaved(false)
                    if (_updateCandidate) {
                      await _updateCandidate(activeCandidate.id, { communicationScore: n })
                      setCommSaved(true)
                      setTimeout(() => setCommSaved(false), 2000)
                    }
                  }}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors
                    ${selected
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-500/50 hover:text-white'
                    }`}
                >
                  {n}
                </button>
              )
            })}
            {(commScore !== null || activeCandidate.communicationScore) && (
              <span className="text-xs text-slate-500 ml-1">
                {(commScore ?? activeCandidate.communicationScore)}/10
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1.5">Tap a score to save — auto-saved immediately</p>
        </div>

        {/* Tags */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Tags</p>
          <CandidateTagList candidateId={activeCandidate.id} tags={activeCandidate.tags} editable />
        </div>

        {/* Move stage */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Move Stage</p>
          <div className="flex gap-2">
            <BaseSelect
              options={PIPELINE_STAGES.filter(s => s !== activeApplication.stage).map(s => ({ value: s, label: s }))}
              placeholder="Select new stage..."
              value={newStage}
              onChange={e => setNewStage(e.target.value)}
              className="flex-1"
            />
            <BaseButton variant="secondary" size="sm" onClick={handleMoveStage} disabled={!newStage}>
              Move
            </BaseButton>
          </div>
        </div>

        {/* Schedule Interview */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Interview</p>
          <BaseButton
            variant="secondary"
            size="sm"
            onClick={() => openScheduleModal({
              applicationId: activeApplication.id,
              candidateId:   activeCandidate.id,
              jobId:         activeApplication.jobId,
              candidateName: `${activeCandidate.firstName} ${activeCandidate.lastName}`,
              jobTitle:      activeApplication.jobTitle ?? '—',
            })}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Schedule Interview
          </BaseButton>
        </div>

        {/* Stage history */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">History</p>
          <ol className="space-y-3">
            {[...activeApplication.stageHistory].reverse().map((h, i) => (
              <li key={i} className="flex gap-3">
                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <StageBadge stage={h.stage} />
                    <span className="text-xs text-slate-500">{h.movedAt}</span>
                  </div>
                  {h.note && <p className="text-xs text-slate-400 mt-0.5">{h.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Resume & cover letter */}
        {activeCandidate.resumeUrl && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Documents</p>
            <a
              href={activeCandidate.resumeUrl}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View Resume →
            </a>
            {activeCandidate.coverLetterText && (
              <p className="mt-3 text-sm text-slate-400 bg-slate-800/50 rounded-xl p-3 border border-slate-800">
                {activeCandidate.coverLetterText}
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Notes</p>
          {activeCandidate.notes && (
            <p className="text-sm text-slate-300 bg-slate-800/50 rounded-xl p-3 border border-slate-800 mb-3 whitespace-pre-wrap">
              {activeCandidate.notes}
            </p>
          )}
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
            <BaseButton type="submit" size="sm" disabled={!noteInput.trim()}>Add</BaseButton>
          </form>
        </div>

        {/* Activity / Audit trail */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Activity</p>
          <AuditTimeline appId={activeApplication.id} />
        </div>

        {/* LinkedIn */}
        {activeCandidate.linkedinUrl && (
          <a
            href={activeCandidate.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-400 transition-colors"
          >
            LinkedIn Profile →
          </a>
        )}
      </div>
    </BaseDrawer>
  )
}
