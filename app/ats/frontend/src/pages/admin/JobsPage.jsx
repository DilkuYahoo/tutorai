import { useState, useMemo } from 'react'
import { useJobs } from '@/hooks/useJobs'
import JobStatusBadge from '@/components/jobs/JobStatusBadge'
import JobModal from '@/components/jobs/JobModal'
import BaseButton from '@/components/ui/BaseButton'
import BaseInput from '@/components/ui/BaseInput'
import EmptyState from '@/components/ui/EmptyState'
import { JOB_STATUSES } from '@/data/mockData'
import { useUsers } from '@/hooks/useUsers'

const STATUS_TABS = ['All', ...JOB_STATUSES]

export default function JobsPage() {
  const { jobs, openCreateModal, openEditModal, setStatus } = useJobs()
  const { userById } = useUsers()
  const [tab, setTab] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      const matchTab    = tab === 'All' || j.status === tab
      const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase())
      return matchTab && matchSearch
    })
  }, [jobs, tab, search])

  const hiringManager = (hmId) => userById(hmId)?.name ?? '—'

  const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—'

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Jobs</h1>
          <p className="text-sm text-slate-400 mt-0.5">{jobs.length} requisitions total</p>
        </div>
        <BaseButton onClick={openCreateModal}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Job
        </BaseButton>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <BaseInput
          placeholder="Search by title or department..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sm:w-72"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === t
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          heading="No jobs found"
          subtext="Try adjusting your filters or create a new requisition."
          action={<BaseButton onClick={openCreateModal}>New Job</BaseButton>}
        />
      ) : (
        <div className="rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden md:table-cell">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden lg:table-cell">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden lg:table-cell">Salary</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden md:table-cell">Applicants</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((job, i) => (
                <tr
                  key={job.id}
                  className={`border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{job.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{job.employmentType}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{job.department}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{job.location}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                    {fmt(job.salaryMin)} – {fmt(job.salaryMax)}
                  </td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{job.applicantCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEditModal(job.id)}
                        className="text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                      >
                        Edit
                      </button>
                      {job.status !== 'Archived' && (
                        <button
                          onClick={() => setStatus(job.id, job.status === 'Open' ? 'Closed' : 'Open')}
                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {job.status === 'Open' ? 'Close' : 'Open'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <JobModal />
    </div>
  )
}
