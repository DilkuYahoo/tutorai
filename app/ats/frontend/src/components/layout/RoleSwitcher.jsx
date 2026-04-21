import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { MOCK_USERS } from '@/data/mockData'

const ROLE_LABELS = {
  admin:          'Admin (HR)',
  hiring_manager: 'Hiring Manager',
  candidate:      'Candidate',
}

export default function RoleSwitcher() {
  const { currentUser, setRole } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const roles = [...new Set(MOCK_USERS.map(u => u.role))]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-indigo-400 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-indigo-400" />
        {ROLE_LABELS[currentUser.role]}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Switch Role</p>
          {roles.map(role => (
            <button
              key={role}
              onClick={() => { setRole(role); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                currentUser.role === role
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
