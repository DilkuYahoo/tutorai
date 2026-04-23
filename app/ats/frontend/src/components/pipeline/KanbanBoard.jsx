import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import { useCandidates } from '@/hooks/useCandidates'
import { PIPELINE_STAGES } from '@/data/mockData'

export default function KanbanBoard({ jobFilter }) {
  const { applications, candidates, moveStage } = useCandidates()
  const [activeApp, setActiveApp] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const filtered = useMemo(() => {
    if (!jobFilter) return applications
    return applications.filter(a => a.jobId === jobFilter)
  }, [applications, jobFilter])

  const byStage = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = filtered.filter(a => a.stage === stage)
      return acc
    }, {})
  }, [filtered])

  function handleDragStart({ active }) {
    setActiveApp(filtered.find(a => a.id === active.id) ?? null)
  }

  function handleDragEnd({ active, over }) {
    setActiveApp(null)
    if (!over) return
    const newStage = over.id
    const app = filtered.find(a => a.id === active.id)
    if (app && app.stage !== newStage) moveStage(app.id, newStage)
  }

  const activeCandidate = activeApp
    ? candidates.find(c => c.id === activeApp.candidateId)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(stage => (
          <KanbanColumn
            key={stage}
            stage={stage}
            applications={byStage[stage]}
            candidates={candidates}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeApp && activeCandidate ? (
          <KanbanCard application={activeApp} candidate={activeCandidate} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
