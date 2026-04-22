import { useReducer, useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import BaseInput from '@/components/ui/BaseInput'
import BaseTextarea from '@/components/ui/BaseTextarea'
import BaseButton from '@/components/ui/BaseButton'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { publicApi } from '@/services/api'

const STEPS = ['Personal Details', 'Resume Upload', 'Cover Letter']

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '', location: '',
  linkedinUrl: '', resumeFile: null, coverLetter: '',
}

function formReducer(state, action) {
  switch (action.type) {
    case 'NEXT':   return { ...state, step: Math.min(state.step + 1, STEPS.length - 1) }
    case 'BACK':   return { ...state, step: Math.max(state.step - 1, 0) }
    case 'SET':    return { ...state, form: { ...state.form, [action.key]: action.value } }
    case 'SUBMIT': return { ...state, submitted: true }
    default:       return state
  }
}

export default function ApplicationPage() {
  const { jobId } = useParams()
  const navigate  = useNavigate()

  const [job, setJob]           = useState(null)
  const [jobLoading, setJobLoading] = useState(true)
  const [jobError, setJobError] = useState('')

  const [state, dispatch] = useReducer(formReducer, { step: 0, form: EMPTY_FORM, submitted: false })
  const [resumeName, setResumeName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!jobId) return
    publicApi.get(`/jobs/public/${jobId}`)
      .then(data => {
        if (!data) { setJobError('Job not found.'); return }
        setJob(data)
      })
      .catch(() => setJobError('Job not found.'))
      .finally(() => setJobLoading(false))
  }, [jobId])

  if (jobLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (jobError || !job) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-slate-400 mb-4">{jobError || 'Job not found.'}</p>
        <Link to="/careers" className="text-indigo-400 hover:text-indigo-300 text-sm">← Back to Careers</Link>
      </div>
    )
  }

  if (state.submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-6 animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6">
          <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Application submitted!</h2>
        <p className="text-slate-400 mb-6 max-w-sm">
          Thanks for applying to <strong className="text-white">{job.title}</strong>. We'll be in touch soon.
        </p>
        <BaseButton variant="secondary" onClick={() => navigate('/careers')}>← Back to Careers</BaseButton>
      </div>
    )
  }

  const set = (key, value) => dispatch({ type: 'SET', key, value })
  const { step, form } = state

  const canProceed = () => {
    if (step === 0) return form.firstName && form.lastName && form.email && form.phone
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      let resumeUrl = ''

      // Upload resume if provided
      if (form.resumeFile) {
        const { uploadUrl, s3Key } = await publicApi.post('/resumes/upload-url', {
          candidateId: 'pending',
          fileName: form.resumeFile.name,
          contentType: form.resumeFile.type || 'application/octet-stream',
        })
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': form.resumeFile.type || 'application/octet-stream' },
          body: form.resumeFile,
        })
        resumeUrl = `https://advicelab.s3.ap-southeast-2.amazonaws.com/${s3Key}`
      }

      // Create candidate
      const { id: candidateId } = await publicApi.post('/candidates', {
        firstName:      form.firstName,
        lastName:       form.lastName,
        email:          form.email,
        phone:          form.phone,
        location:       form.location,
        linkedinUrl:    form.linkedinUrl,
        resumeUrl,
        coverLetterText: form.coverLetter,
        source:         'Careers Page',
      })

      // Create application
      await publicApi.post('/applications', {
        candidateId,
        jobId,
        coverLetterText: form.coverLetter,
      })

      dispatch({ type: 'SUBMIT' })
    } catch (err) {
      // Duplicate candidate (already applied) is a conflict — handle gracefully
      if (err.status === 409) {
        setSubmitError('An application with this email already exists for this job.')
      } else {
        setSubmitError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12 animate-fade-in">
      <Link to="/careers" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors mb-6 inline-block">
        ← Back to Careers
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{job.title}</h1>
        <p className="text-sm text-slate-400 mt-1">{job.department} · {job.location}</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((label, i) => (
            <span key={label} className={`text-xs font-medium ${i === step ? 'text-indigo-400' : i < step ? 'text-emerald-400' : 'text-slate-600'}`}>
              {label}
            </span>
          ))}
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      {/* Step 0: Personal Details */}
      {step === 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <BaseInput label="First Name" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Alex" required />
            <BaseInput label="Last Name"  value={form.lastName}  onChange={e => set('lastName',  e.target.value)} placeholder="Smith" required />
          </div>
          <BaseInput label="Email"    type="email" value={form.email}      onChange={e => set('email',      e.target.value)} placeholder="alex@email.com" required />
          <BaseInput label="Phone"    type="tel"   value={form.phone}      onChange={e => set('phone',      e.target.value)} placeholder="+61 412 000 000" required />
          <BaseInput label="Location"              value={form.location}   onChange={e => set('location',   e.target.value)} placeholder="Sydney, NSW" />
          <BaseInput label="LinkedIn URL (optional)" value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>
      )}

      {/* Step 1: Resume Upload */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <div
            className="border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center hover:border-indigo-500/60 transition-colors cursor-pointer"
            onClick={() => document.getElementById('resume-input').click()}
          >
            <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {resumeName
              ? <p className="text-sm text-emerald-400">{resumeName}</p>
              : <>
                  <p className="text-sm text-slate-400">Click to upload your resume</p>
                  <p className="text-xs text-slate-600 mt-1">PDF, DOCX up to 10MB</p>
                </>
            }
            <input id="resume-input" type="file" accept=".pdf,.doc,.docx" className="hidden"
              onChange={e => {
                const file = e.target.files[0]
                if (file) { set('resumeFile', file); setResumeName(file.name) }
              }}
            />
          </div>
          <p className="text-xs text-slate-500 text-center">You can skip this step and email your resume later.</p>
        </div>
      )}

      {/* Step 2: Cover Letter */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <BaseTextarea
            label="Cover Letter (optional)"
            rows={8}
            value={form.coverLetter}
            onChange={e => set('coverLetter', e.target.value)}
            placeholder={`Tell us why you're excited about the ${job.title} role...`}
          />
          <p className="text-xs text-slate-500">This is optional. You can skip this step.</p>
          {submitError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {submitError}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <BaseButton variant="secondary" disabled={submitting}
          onClick={() => step === 0 ? navigate('/careers') : dispatch({ type: 'BACK' })}
        >
          {step === 0 ? 'Cancel' : '← Back'}
        </BaseButton>
        {step < STEPS.length - 1 ? (
          <BaseButton onClick={() => dispatch({ type: 'NEXT' })} disabled={!canProceed()}>
            Continue →
          </BaseButton>
        ) : (
          <BaseButton onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </BaseButton>
        )}
      </div>
    </div>
  )
}
