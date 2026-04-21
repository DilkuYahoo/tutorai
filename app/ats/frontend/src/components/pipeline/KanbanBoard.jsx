import { useMemo } from 'react'
import KanbanColumn from './KanbanColumn'
import { useCandidates } from '@/hooks/useCandidates'
import { PIPELINE_STAGES } from '@/data/mockData'

export default function KanbanBoard({ jobFilter }) {
  const { applications, candidates } = useCandidates()

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

  return (
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
  )
}
