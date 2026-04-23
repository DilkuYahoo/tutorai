import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"

function Logo() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 mb-4">
        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-white">ATS</h1>
    </div>
  )
}

function NewPasswordForm() {
  const { setNewPassword } = useAuth()
  const [name, setName]                 = useState('')
  const [newPassword, setNewPasswordVal] = useState('')
  const [confirm, setConfirm]           = useState('')
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim())             return setError('Please enter your full name')
    if (newPassword !== confirm)  return setError('Passwords do not match')
    if (newPassword.length < 12)  return setError('Password must be at least 12 characters')
    setError('')
    setLoading(true)
    try {
      await setNewPassword(newPassword, name.trim())
      // navigation handled by LoginPage useEffect watching authState
    } catch (err) {
      setError(err.message || 'Failed to set password')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">Set a new password</p>
            <p className="text-xs text-slate-400 mt-1">This is your first login. Please set a permanent password to continue.</p>
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Full Name</label>
              <input type="text" required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Chen" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">New Password</label>
              <input type="password" required value={newPassword} onChange={e => setNewPasswordVal(e.target.value)} placeholder="Min. 12 characters" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Confirm Password</label>
              <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter password" className={inputClass} />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors">
              {loading ? 'Saving...' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { login, authState } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    if (authState === 'authenticated') navigate('/dashboard', { replace: true })
  }, [authState, navigate])

  if (authState === 'password_change') return <NewPasswordForm />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      // navigation handled by useEffect above
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Logo />
        <p className="text-center text-sm text-slate-400 -mt-4 mb-8">Sign in to your account</p>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Email</label>
              <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••••" className={inputClass} />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
