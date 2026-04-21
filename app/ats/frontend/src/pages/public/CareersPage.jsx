import { useState, useMemo } from 'react'
import JobCard from '@/components/jobs/JobCard'
import BaseInput from '@/components/ui/BaseInput'
import EmptyState from '@/components/ui/EmptyState'
import { MOCK_JOBS, EMPLOYMENT_TYPES } from '@/data/mockData'

export default function CareersPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const openJobs = useMemo(() => {
    return MOCK_JOBS.filter(j => {
      const matchStatus = j.status === 'Open'
      const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase())
      const matchType   = !typeFilter || j.employmentType === typeFilter
      return matchStatus && matchSearch && matchType
    })
  }, [search, typeFilter])

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-950 px-6 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">Join our team</h1>
        <p className="mt-4 text-lg text-slate-400 max-w-xl mx-auto">
          We're building something great. Find your place and grow with us.
        </p>
      </div>

      {/* Filters */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <BaseInput
            placeholder="Search by title or team..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="sm:flex-1"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setTypeFilter('')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${!typeFilter ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              All
            </button>
            {EMPLOYMENT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${typeFilter === t ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {openJobs.length === 0 ? (
          <EmptyState heading="No open roles match your search" subtext="Try a different keyword or filter." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {openJobs.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </div>
    </div>
  )
}
