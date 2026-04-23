import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { publicApi } from '@/services/api'
import { useUI } from '@/hooks/useUI'

export default function JobDetailPage() {
  const { jobId } = useParams()
  const navigate  = useNavigate()
  const { toggleTheme, theme } = useUI()

  const [job, setJob]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    publicApi.get(`/jobs/public/${jobId}`)
      .then(data => {
        if (!data) { setNotFound(true); return }
        setJob(data)
      })
      .catch(err => {
        if (err.status === 404) setNotFound(true)
        else console.error(err)
      })
      .finally(() => setLoading(false))
  }, [jobId])

  const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : null
  const salary = job && fmt(job.salaryMin) && fmt(job.salaryMax)
    ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)} ${job.salaryCurrency ?? ''}`
    : null

  const postedDate = job?.createdAt
    ? new Date(job.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
        <p className="text-lg font-semibold text-white">Role not found</p>
        <p className="text-sm text-slate-400">This role may have been filled or removed.</p>
        <button
          onClick={() => navigate('/careers')}
          className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
        >
          ← Back to all roles
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="hero-bg bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-950 px-6 py-16 relative">
        {/* Theme toggle */}
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

        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => navigate('/careers')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to all roles
          </button>

          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{job.title}</h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-slate-400">
            {job.department && <span>{job.department}</span>}
            {job.location && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {job.location}
              </span>
            )}
            {job.employmentType && <span>{job.employmentType}</span>}
            {salary && <span>{salary}</span>}
          </div>

          <div className="mt-6">
            <button
              onClick={() => navigate(`/careers/${job.id}/apply`)}
              disabled={job.status !== 'Open'}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply Now
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Description */}
        {job.description && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">About the role</h2>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{job.description}</p>
          </section>
        )}

        {/* Metadata strip */}
        <div className="border-t border-slate-800 pt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {postedDate && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Posted</p>
              <p className="text-slate-300">{postedDate}</p>
            </div>
          )}
          {job.applicantCount > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Applicants</p>
              <p className="text-slate-300">{job.applicantCount}</p>
            </div>
          )}
          {job.employmentType && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Type</p>
              <p className="text-slate-300">{job.employmentType}</p>
            </div>
          )}
        </div>

        {/* Bottom Apply CTA */}
        <div className="border-t border-slate-800 pt-6">
          <button
            onClick={() => navigate(`/careers/${job.id}/apply`)}
            disabled={job.status !== 'Open'}
            className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply for this role
          </button>
        </div>
      </div>
    </div>
  )
}
