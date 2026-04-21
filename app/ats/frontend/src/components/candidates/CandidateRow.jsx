import StageBadge from './StageBadge'
import { useCandidates } from '@/hooks/useCandidates'
import { MOCK_JOBS } from '@/data/mockData'

export default function CandidateRow({ application }) {
  const { candidates, openDrawer } = useCandidates()
  const candidate = candidates.find(c => c.id === application.candidateId)
  const job = MOCK_JOBS.find(j => j.id === application.jobId)

  if (!candidate) return null

  return (
    <tr
      className="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors cursor-pointer"
      onClick={() => openDrawer(application.id)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
            {candidate.firstName[0]}{candidate.lastName[0]}
          </div>
          <div>
            <div className="font-medium text-white">{candidate.firstName} {candidate.lastName}</div>
            <div className="text-xs text-slate-500">{candidate.location}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-400 text-sm hidden md:table-cell">{job?.title ?? '—'}</td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <StageBadge stage={application.stage} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 rounded-full bg-slate-700 w-16 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${application.fitScore}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{application.fitScore}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{candidate.source}</td>
      <td className="px-4 py-3 text-xs text-slate-500">{application.appliedAt}</td>
    </tr>
  )
}
