import { useNavigate } from 'react-router-dom'
import JobStatusBadge from './JobStatusBadge'

export default function JobCard({ job }) {
  const navigate = useNavigate()

  const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : null
  const salary = fmt(job.salaryMin) && fmt(job.salaryMax)
    ? `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)} ${job.salaryCurrency}`
    : null

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-indigo-500/40 transition-colors flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{job.title}</h3>
          <p className="text-sm text-slate-400 mt-0.5">{job.department}</p>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {job.location}
        </span>
        <span>{job.employmentType}</span>
        {salary && <span>{salary}</span>}
      </div>

      <p className="text-sm text-slate-400 line-clamp-2">{job.description}</p>

      <div className="mt-auto flex gap-2">
        <button
          onClick={() => navigate(`/careers/${job.id}`)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          View Details
        </button>
        <button
          onClick={() => navigate(`/careers/${job.id}/apply`)}
          disabled={job.status !== 'Open'}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply Now
        </button>
      </div>
    </div>
  )
}
