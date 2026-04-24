import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useCandidates } from '@/hooks/useCandidates'
import { PIPELINE_STAGES } from '@/data/mockData'

export default function KanbanCard({ application, candidate, isDragOverlay = false }) {
  const { moveStage, openDrawer } = useCandidates()
  const [showMove, setShowMove] = useState(false)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
    disabled: isDragOverlay,
  })

  const style = isDragOverlay
    ? { boxShadow: '0 8px 32px rgba(0,0,0,0.4)', cursor: 'grabbing' }
    : { transform: CSS.Translate.toString(transform) }

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      {...(isDragOverlay ? {} : listeners)}
      {...(isDragOverlay ? {} : attributes)}
      className={`rounded-xl border bg-slate-900 p-3 space-y-2.5 transition-colors group
        ${isDragging ? 'opacity-40 border-slate-800' : 'border-slate-800 hover:border-indigo-500/40'}
        ${isDragOverlay ? 'rotate-1 scale-105' : 'cursor-grab active:cursor-grabbing'}
      `}
    >
      {/* Header: avatar + name */}
      <div
        className="flex items-center gap-2"
        onClick={() => !isDragOverlay && openDrawer(application.id)}
      >
        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
          {candidate.firstName[0]}{candidate.lastName[0]}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{candidate.firstName} {candidate.lastName}</p>
          <p className="text-xs text-slate-500 truncate">{application.jobTitle ?? '—'}</p>
        </div>
      </div>

      {/* Fit score bar */}
      {application.fitScore != null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${application.fitScore * 10}%` }} />
          </div>
          <span className="text-xs text-slate-500">{application.fitScore}/10</span>
        </div>
      )}

      {/* Move select — hidden during drag overlay */}
      {!isDragOverlay && (
        <div className="flex items-center gap-2">
          {showMove ? (
            <select
              autoFocus
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white outline-none"
              defaultValue=""
              onChange={e => {
                if (e.target.value) { moveStage(application.id, e.target.value); setShowMove(false) }
              }}
              onBlur={() => setShowMove(false)}
            >
              <option value="" disabled>Move to...</option>
              {PIPELINE_STAGES.filter(s => s !== application.stage).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setShowMove(true)}
              className="text-xs text-slate-600 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              Move stage →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
