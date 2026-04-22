import { useState, useEffect } from 'react'
import BaseModal from '@/components/ui/BaseModal'
import BaseButton from '@/components/ui/BaseButton'
import BaseInput from '@/components/ui/BaseInput'
import BaseSelect from '@/components/ui/BaseSelect'
import { useInterviews } from '@/hooks/useInterviews'
import { useUsers } from '@/hooks/useUsers'
import { INTERVIEW_TYPES } from '@/data/mockData'

const DURATIONS = [
  { value: '15',  label: '15 minutes' },
  { value: '30',  label: '30 minutes' },
  { value: '45',  label: '45 minutes' },
  { value: '60',  label: '1 hour' },
  { value: '90',  label: '1.5 hours' },
  { value: '120', label: '2 hours' },
]

const EMPTY = {
  type: 'Video',
  scheduledAt: '',
  durationMinutes: '60',
  meetingLink: '',
  panelIds: [],
}

export default function ScheduleInterviewModal() {
  const { isScheduleModalOpen, scheduleContext, closeScheduleModal, scheduleInterview } = useInterviews()
  const { users } = useUsers()

  const [form, setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (isScheduleModalOpen) { setForm(EMPTY); setError('') }
  }, [isScheduleModalOpen])

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const togglePanel = (userId) => {
    setForm(f => ({
      ...f,
      panelIds: f.panelIds.includes(userId)
        ? f.panelIds.filter(id => id !== userId)
        : [...f.panelIds, userId],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.scheduledAt) { setError('Please select a date and time.'); return }
    if (form.panelIds.length === 0) { setError('Please assign at least one panel member.'); return }
    setSaving(true)
    setError('')
    try {
      await scheduleInterview({
        applicationId:   scheduleContext.applicationId,
        type:            form.type,
        scheduledAt:     new Date(form.scheduledAt).toISOString(),
        durationMinutes: parseInt(form.durationMinutes, 10),
        panelIds:        form.panelIds,
        ...(form.meetingLink ? { meetingLink: form.meetingLink } : {}),
      })
      closeScheduleModal()
    } catch (err) {
      setError(err.message || 'Failed to schedule interview.')
    } finally {
      setSaving(false)
    }
  }

  if (!scheduleContext) return null

  return (
    <BaseModal
      open={isScheduleModalOpen}
      title="Schedule Interview"
      onClose={closeScheduleModal}
      footer={
        <>
          <BaseButton variant="secondary" onClick={closeScheduleModal} disabled={saving}>Cancel</BaseButton>
          <BaseButton type="submit" form="schedule-interview-form" disabled={saving}>
            {saving ? 'Scheduling...' : 'Schedule Interview'}
          </BaseButton>
        </>
      }
    >
      <form id="schedule-interview-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-slate-800/50 border border-slate-800 px-4 py-3 text-sm">
          <p className="font-medium text-white">{scheduleContext.candidateName}</p>
          <p className="text-slate-400 text-xs mt-0.5">{scheduleContext.jobTitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <BaseSelect
            label="Interview Type"
            id="type"
            options={INTERVIEW_TYPES}
            value={form.type}
            onChange={e => set('type', e.target.value)}
          />
          <BaseSelect
            label="Duration"
            id="durationMinutes"
            options={DURATIONS}
            value={form.durationMinutes}
            onChange={e => set('durationMinutes', e.target.value)}
          />
        </div>

        <BaseInput
          label="Date & Time"
          id="scheduledAt"
          type="datetime-local"
          value={form.scheduledAt}
          onChange={e => set('scheduledAt', e.target.value)}
          required
        />

        {form.type === 'Video' && (
          <BaseInput
            label="Meeting Link (optional)"
            id="meetingLink"
            type="url"
            value={form.meetingLink}
            onChange={e => set('meetingLink', e.target.value)}
            placeholder="https://meet.google.com/..."
          />
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Interview Panel</p>
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">No users available.</p>
          ) : (
            <div className="space-y-2">
              {users.map(user => (
                <label key={user.id} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={form.panelIds.includes(user.id)}
                    onChange={() => togglePanel(user.id)}
                    className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    {user.name}
                    <span className="text-xs text-slate-500 ml-2">{user.role}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </form>
    </BaseModal>
  )
}
