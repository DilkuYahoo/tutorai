import { useState } from 'react'
import KanbanBoard from '@/components/pipeline/KanbanBoard'
import CandidateDrawer from '@/components/candidates/CandidateDrawer'
import BaseSelect from '@/components/ui/BaseSelect'
import { useJobs } from '@/hooks/useJobs'

export default function PipelinePage() {
  const [jobFilter, setJobFilter] = useState('')
  const { openJobs } = useJobs()

  const jobOptions = [
    { value: '', label: 'All Jobs' },
    ...openJobs.map(j => ({ value: j.id, label: j.title })),
  ]

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Pipeline</h1>
          <p className="text-sm text-slate-400 mt-0.5">Drag candidates across stages to advance them</p>
        </div>
        <BaseSelect
          options={jobOptions}
          value={jobFilter}
          onChange={e => setJobFilter(e.target.value)}
          className="w-56"
        />
      </div>

      <KanbanBoard jobFilter={jobFilter} />
      <CandidateDrawer />
    </div>
  )
}
