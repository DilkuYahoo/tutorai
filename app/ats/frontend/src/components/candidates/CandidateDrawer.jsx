import { useState } from 'react'
import BaseDrawer from '@/components/ui/BaseDrawer'
import BaseSelect from '@/components/ui/BaseSelect'
import BaseButton from '@/components/ui/BaseButton'
import StageBadge from './StageBadge'
import CandidateTagList from './CandidateTagList'
import { useCandidates } from '@/hooks/useCandidates'
import { useInterviews } from '@/hooks/useInterviews'
import { PIPELINE_STAGES } from '@/data/mockData'

export default function CandidateDrawer() {
  const { isDrawerOpen, activeApplication, activeCandidate, closeDrawer, moveStage, addNote } = useCandidates()
  const { openScheduleModal } = useInterviews()
  const [noteInput, setNoteInput] = useState('')
  const [newStage, setNewStage] = useState('')

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
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Fit Score</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${activeApplication.fitScore}%` }} />
            </div>
            <span className="text-sm font-semibold text-white">{activeApplication.fitScore}%</span>
          </div>
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
