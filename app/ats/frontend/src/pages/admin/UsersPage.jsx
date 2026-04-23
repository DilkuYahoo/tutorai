import { useState, useMemo } from 'react'
import BaseModal from '@/components/ui/BaseModal'
import BaseDrawer from '@/components/ui/BaseDrawer'
import BaseButton from '@/components/ui/BaseButton'
import BaseInput from '@/components/ui/BaseInput'
import BaseSelect from '@/components/ui/BaseSelect'
import BaseBadge from '@/components/ui/BaseBadge'
import EmptyState from '@/components/ui/EmptyState'
import { useUsers } from '@/hooks/useUsers'
import { useAuth } from '@/hooks/useAuth'

const ROLE_OPTIONS = [
  { value: 'admin',           label: 'Admin (HR)' },
  { value: 'hiring_manager',  label: 'Hiring Manager' },
]

const ROLE_LABELS = {
  admin:          'Admin',
  hiring_manager: 'Hiring Manager',
}

const ROLE_VARIANTS = {
  admin:          'indigo',
  hiring_manager: 'slate',
}

const EMPTY_INVITE = { name: '', email: '', role: 'hiring_manager', department: '' }
const EMPTY_EDIT   = { name: '', department: '', role: 'hiring_manager' }

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ open, onClose }) {
  const { inviteUser } = useUsers()
  const [form, setForm]     = useState(EMPTY_INVITE)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleClose = () => { setForm(EMPTY_INVITE); setError(''); onClose() }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim())  { setError('Name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    setSaving(true)
    setError('')
    try {
      await inviteUser({ name: form.name.trim(), email: form.email.trim(), role: form.role, department: form.department.trim() || null })
      handleClose()
    } catch (err) {
      setError(err.message || 'Failed to send invite.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BaseModal
      open={open}
      title="Invite Team Member"
      onClose={handleClose}
      footer={
        <>
          <BaseButton variant="secondary" onClick={handleClose} disabled={saving}>Cancel</BaseButton>
          <BaseButton type="submit" form="invite-user-form" disabled={saving}>
            {saving ? 'Sending...' : 'Send Invite'}
          </BaseButton>
        </>
      }
    >
      <form id="invite-user-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        <BaseInput
          label="Full Name"
          id="invite-name"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Sarah Chen"
          required
        />
        <BaseInput
          label="Email Address"
          id="invite-email"
          type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          placeholder="sarah@advicelab.com.au"
          required
        />
        <BaseSelect
          label="Role"
          id="invite-role"
          options={ROLE_OPTIONS}
          value={form.role}
          onChange={e => set('role', e.target.value)}
        />
        <BaseInput
          label="Department (optional)"
          id="invite-department"
          value={form.department}
          onChange={e => set('department', e.target.value)}
          placeholder="e.g. Human Resources"
        />
      </form>
    </BaseModal>
  )
}

// ── Edit Drawer ───────────────────────────────────────────────────────────────

function EditDrawer({ open, userId, onClose }) {
  const { users, updateUser } = useUsers()
  const user = users.find(u => u.id === userId) ?? null

  const [form, setForm]     = useState(EMPTY_EDIT)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Sync form when user changes
  useMemo(() => {
    if (user) setForm({ name: user.name, department: user.department ?? '', role: user.role })
  }, [userId])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleClose = () => { setError(''); onClose() }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await updateUser(userId, { name: form.name.trim(), department: form.department.trim() || null, role: form.role })
      handleClose()
    } catch (err) {
      setError(err.message || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BaseDrawer open={open} title="Edit Team Member" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex-1 space-y-4 p-5">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <BaseInput
            label="Full Name"
            id="edit-name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
          />
          <BaseSelect
            label="Role"
            id="edit-role"
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={e => set('role', e.target.value)}
          />
          <BaseInput
            label="Department (optional)"
            id="edit-department"
            value={form.department}
            onChange={e => set('department', e.target.value)}
            placeholder="e.g. Engineering"
          />
        </div>
        <div className="border-t border-slate-800 px-5 py-4 flex justify-end gap-3 shrink-0">
          <BaseButton variant="secondary" type="button" onClick={handleClose} disabled={saving}>Cancel</BaseButton>
          <BaseButton type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</BaseButton>
        </div>
      </form>
    </BaseDrawer>
  )
}

// ── User Row ──────────────────────────────────────────────────────────────────

function UserRow({ user, isSelf }) {
  const { enableUser, disableUser, deleteUser, openEditDrawer } = useUsers()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [working, setWorking] = useState(false)

  const isDisabled = user.status === 'disabled'

  const toggle = async () => {
    setWorking(true)
    try {
      if (isDisabled) await enableUser(user.id)
      else await disableUser(user.id)
    } finally {
      setWorking(false)
    }
  }

  const handleDelete = async () => {
    setWorking(true)
    try {
      await deleteUser(user.id)
    } finally {
      setWorking(false)
      setConfirmDelete(false)
    }
  }

  return (
    <tr className={`border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors ${isDisabled ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
            {user.avatarInitials}
          </div>
          <div>
            <div className="font-medium text-white text-sm">{user.name}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <BaseBadge label={ROLE_LABELS[user.role] ?? user.role} variant={ROLE_VARIANTS[user.role] ?? 'slate'} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-400 hidden md:table-cell">{user.department || '—'}</td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <BaseBadge
          label={isDisabled ? 'Disabled' : 'Active'}
          variant={isDisabled ? 'amber' : 'emerald'}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <BaseButton size="sm" variant="secondary" onClick={() => openEditDrawer(user.id)}>
            Edit
          </BaseButton>
          {!isSelf && (
            <BaseButton size="sm" variant="secondary" onClick={toggle} disabled={working}>
              {isDisabled ? 'Enable' : 'Disable'}
            </BaseButton>
          )}
          {!isSelf && !confirmDelete && (
            <BaseButton size="sm" variant="secondary" onClick={() => setConfirmDelete(true)} disabled={working}>
              Delete
            </BaseButton>
          )}
          {!isSelf && confirmDelete && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-400">Sure?</span>
              <BaseButton size="sm" variant="danger" onClick={handleDelete} disabled={working}>Yes, delete</BaseButton>
              <BaseButton size="sm" variant="secondary" onClick={() => setConfirmDelete(false)} disabled={working}>Cancel</BaseButton>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { users, loading, isInviteModalOpen, isEditDrawerOpen, editUserId,
          openInviteModal, closeInviteModal, closeEditDrawer } = useUsers()
  const { currentUser } = useAuth()

  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchSearch = !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      const matchRole = !roleFilter || u.role === roleFilter
      return matchSearch && matchRole
    })
  }, [users, search, roleFilter])

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Team Members</h1>
          <span className="text-xs font-semibold bg-slate-800 text-slate-400 rounded-full px-2.5 py-0.5">{users.length}</span>
        </div>
        <BaseButton onClick={openInviteModal}>Invite User</BaseButton>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        <div className="flex gap-2">
          {[{ label: 'All', value: '' }, { label: 'Admin', value: 'admin' }, { label: 'Hiring Manager', value: 'hiring_manager' }].map(opt => (
            <button
              key={opt.value}
              onClick={() => setRoleFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${roleFilter === opt.value ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState heading="No team members found" subtext="Try a different search or invite someone new." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden md:table-cell">Department</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500 hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <UserRow key={user.id} user={user} isSelf={user.id === currentUser?.id} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InviteModal open={isInviteModalOpen} onClose={closeInviteModal} />
      <EditDrawer open={isEditDrawerOpen} userId={editUserId} onClose={closeEditDrawer} />
    </div>
  )
}
