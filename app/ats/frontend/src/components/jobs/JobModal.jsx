import { useState, useEffect } from 'react'
import BaseModal from '@/components/ui/BaseModal'
import BaseButton from '@/components/ui/BaseButton'
import BaseInput from '@/components/ui/BaseInput'
import BaseSelect from '@/components/ui/BaseSelect'
import BaseTextarea from '@/components/ui/BaseTextarea'
import { useJobs } from '@/hooks/useJobs'
import { EMPLOYMENT_TYPES, JOB_STATUSES } from '@/data/mockData'

const EMPTY = {
  title: '', department: '', location: '', employmentType: 'Full-time',
  salaryMin: '', salaryMax: '', salaryCurrency: 'AUD', status: 'Draft', description: '',
}

export default function JobModal() {
  const { isModalOpen, activeJob, closeModal, saveJob } = useJobs()
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    setForm(activeJob ? { ...activeJob } : EMPTY)
    setError('')
  }, [activeJob, isModalOpen])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await saveJob(form)
      closeModal()
    } catch (err) {
      setError(err.message || 'Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BaseModal
      open={isModalOpen}
      title={activeJob ? 'Edit Job' : 'New Job Requisition'}
      size="lg"
      onClose={closeModal}
      footer={
        <>
          <BaseButton variant="secondary" onClick={closeModal} disabled={saving}>Cancel</BaseButton>
          <BaseButton variant="primary" type="submit" form="job-form" disabled={saving}>
            {saving ? 'Saving...' : activeJob ? 'Save Changes' : 'Create Job'}
          </BaseButton>
        </>
      }
    >
      <form id="job-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <BaseInput
          label="Job Title"
          id="title"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Senior Frontend Engineer"
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <BaseInput
            label="Department"
            id="department"
            value={form.department}
            onChange={e => set('department', e.target.value)}
            placeholder="e.g. Engineering"
          />
          <BaseInput
            label="Location"
            id="location"
            value={form.location}
            onChange={e => set('location', e.target.value)}
            placeholder="e.g. Sydney, NSW"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <BaseSelect
            label="Employment Type"
            id="employmentType"
            options={EMPLOYMENT_TYPES}
            value={form.employmentType}
            onChange={e => set('employmentType', e.target.value)}
          />
          <BaseSelect
            label="Status"
            id="status"
            options={JOB_STATUSES}
            value={form.status}
            onChange={e => set('status', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <BaseInput
            label="Salary Min (AUD)"
            id="salaryMin"
            type="number"
            value={form.salaryMin}
            onChange={e => set('salaryMin', e.target.value)}
            placeholder="120000"
          />
          <BaseInput
            label="Salary Max (AUD)"
            id="salaryMax"
            type="number"
            value={form.salaryMax}
            onChange={e => set('salaryMax', e.target.value)}
            placeholder="150000"
          />
          <BaseInput
            label="Currency"
            id="salaryCurrency"
            value={form.salaryCurrency}
            onChange={e => set('salaryCurrency', e.target.value)}
          />
        </div>
        <BaseTextarea
          label="Job Description"
          id="description"
          rows={6}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Describe the role, responsibilities, and requirements..."
        />
      </form>
    </BaseModal>
  )
}
