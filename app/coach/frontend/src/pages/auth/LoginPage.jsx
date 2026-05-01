import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const ROLES = [
  { key: 'super_coach', label: 'Super Coach (Head Coach)', desc: 'Full admin + coaching access', icon: '👑' },
  { key: 'coach',       label: 'Coach — Rahul Sharma',    desc: 'Own sessions and calendar',   icon: '🎯' },
  { key: 'player',      label: 'Player — Sam Wilson',     desc: 'Book sessions, view history',  icon: '🏏' },
  { key: 'parent',      label: 'Parent — Sandra Chen',    desc: 'Manage child Lily Chen',       icon: '👨‍👩‍👧' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState('player')

  function handleLogin() {
    login(selected)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-4xl">🏏</span>
          <h1 className="text-2xl font-bold text-slate-100 mt-2">Playgenie</h1>
          <p className="text-slate-500 text-sm mt-1">Cricket coaching, beautifully managed</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs text-amber-400 bg-amber-950/50 border border-amber-800 rounded-lg px-3 py-2 mb-5">
            🔧 <strong>Mock mode</strong> — select a role below to explore the platform
          </p>

          <div className="space-y-2 mb-6">
            {ROLES.map(role => (
              <button
                key={role.key}
                onClick={() => setSelected(role.key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  selected === role.key
                    ? 'border-indigo-500 bg-indigo-950/50'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <span className="text-2xl">{role.icon}</span>
                <div>
                  <p className="text-sm font-medium text-slate-100">{role.label}</p>
                  <p className="text-xs text-slate-500">{role.desc}</p>
                </div>
                {selected === role.key && (
                  <span className="ml-auto text-indigo-400">✓</span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-colors"
          >
            Enter as {ROLES.find(r => r.key === selected)?.label.split(' — ')[0]}
          </button>
        </div>
      </div>
    </div>
  )
}
