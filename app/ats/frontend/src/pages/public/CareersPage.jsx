import { useState, useMemo, useEffect } from 'react'
import JobCard from '@/components/jobs/JobCard'
import BaseInput from '@/components/ui/BaseInput'
import EmptyState from '@/components/ui/EmptyState'
import { useUI } from '@/hooks/useUI'
import { EMPLOYMENT_TYPES } from '@/data/mockData'
import { publicApi } from '@/services/api'

export default function CareersPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const { toggleTheme, theme } = useUI()

  useEffect(() => {
    publicApi.get('/jobs/public')
      .then(setJobs)
      .catch(err => {
        console.error('Failed to load jobs:', err)
        setJobs([])
      })
      .finally(() => setLoading(false))
  }, [])

  const openJobs = useMemo(() => {
    return jobs.filter(j => {
      const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.department?.toLowerCase().includes(search.toLowerCase())
      const matchType = !typeFilter || j.employmentType === typeFilter
      return matchSearch && matchType
    })
  }, [jobs, search, typeFilter])

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="hero-bg bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-950 px-6 py-20 text-center relative">
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
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

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : openJobs.length === 0 ? (
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
