import { useState } from 'react'
import BaseModal from '@/components/ui/BaseModal'
import BaseButton from '@/components/ui/BaseButton'
import { cognitoChangePassword } from '@/services/cognito'
import { USE_API } from '@/services/api'

export default function ChangePasswordModal({ open, onClose }) {
  const [current, setCurrent]   = useState('')
  const [next, setNext]         = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); setSuccess(false) }
  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return }
    if (next !== confirm) { setError('New passwords do not match.'); return }

    if (!USE_API) {
      setSuccess(true)
      setTimeout(handleClose, 1500)
      return
    }

    setSaving(true)
    try {
      await cognitoChangePassword(current, next)
      setSuccess(true)
      setTimeout(handleClose, 1500)
    } catch (err) {
      setError(err.message || 'Failed to change password. Check your current password and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BaseModal open={open} onClose={handleClose} title="Change Password">
      {success ? (
        <div className="py-6 text-center">
          <p className="text-emerald-400 font-medium">Password changed successfully.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Current password</label>
            <input
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">New password</label>
            <input
              type="password"
              value={next}
              onChange={e => setNext(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <BaseButton type="button" variant="secondary" size="sm" onClick={handleClose}>Cancel</BaseButton>
            <BaseButton type="submit" size="sm" disabled={saving || !current || !next || !confirm}>
              {saving ? 'Saving…' : 'Change Password'}
            </BaseButton>
          </div>
        </form>
      )}
    </BaseModal>
  )
}
