import { useCandidates } from '@/hooks/useCandidates'
import CandidateRow from '@/components/candidates/CandidateRow'
import CandidateDrawer from '@/components/candidates/CandidateDrawer'
import BaseInput from '@/components/ui/BaseInput'
import BaseSelect from '@/components/ui/BaseSelect'
import EmptyState from '@/components/ui/EmptyState'
import { PIPELINE_STAGES, MOCK_JOBS } from '@/data/mockData'

export default function CandidatesPage() {
  const { filteredApplications, applications, searchQuery, stageFilter, jobFilter, setFilter } = useCandidates()

  const jobOptions = [{ value: '', label: 'All Jobs' }, ...MOCK_JOBS.map(j => ({ value: j.id, label: j.title }))]
  const stageOptions = [{ value: '', label: 'All Stages' }, ...PIPELINE_STAGES.map(s => ({ value: s, label: s }))]

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Candidates</h1>
          <p className="text-sm text-slate-400 mt-0.5">{applications.length} total applications</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <BaseInput
          placeholder="Search by name..."
          value={searchQuery}
          onChange={e => setFilter('searchQuery', e.target.value)}
          className="sm:w-64"
        />
        <BaseSelect
          options={stageOptions}
          value={stageFilter}
          onChange={e => setFilter('stageFilter', e.target.value)}
          className="sm:w-48"
        />
        <BaseSelect
          options={jobOptions}
          value={jobFilter}
          onChange={e => setFilter('jobFilter', e.target.value)}
          className="sm:w-56"
        />
      </div>

      {/* Table */}
      {filteredApplications.length === 0 ? (
        <EmptyState
          heading="No candidates match your filters"
          subtext="Try adjusting your search or filters."
        />
      ) : (
        <div className="rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Candidate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden md:table-cell">Job</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden sm:table-cell">Stage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden lg:table-cell">Fit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden md:table-cell">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Applied</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map(app => (
                <CandidateRow key={app.id} application={app} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CandidateDrawer />
    </div>
  )
}
