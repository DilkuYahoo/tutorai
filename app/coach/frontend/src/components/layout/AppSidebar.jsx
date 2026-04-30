import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const NAV = {
  super_coach: [
    { label: 'Dashboard',       path: '/dashboard',        icon: '📊' },
    { label: 'Calendar',        path: '/calendar',         icon: '📅' },
    { label: 'Coaches',         path: '/super/coaches',    icon: '👥' },
    { label: 'Packages',        path: '/super/packages',   icon: '📦' },
    { label: 'Reconciliation',  path: '/super/reconciliation', icon: '🔍' },
    { label: 'Coach Directory', path: '/coaches',          icon: '🏏' },
  ],
  coach: [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Calendar',  path: '/calendar',  icon: '📅' },
    { label: 'Players',   path: '/coach/players', icon: '👤' },
  ],
  player: [
    { label: 'My Dashboard',  path: '/dashboard', icon: '🏠' },
    { label: 'Find a Coach',  path: '/coaches',   icon: '🏏' },
  ],
  parent: [
    { label: 'My Dashboard',  path: '/dashboard', icon: '🏠' },
    { label: 'Find a Coach',  path: '/coaches',   icon: '🏏' },
  ],
}

export default function AppSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const navItems = NAV[user?.role] || []

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-slate-900 border-r border-slate-800 flex flex-col z-30 hidden md:flex">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-slate-800">
        <span className="text-indigo-400 font-bold text-lg tracking-tight">🏏 CricketCoach</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-800 cursor-pointer group">
          <img src={user?.photo || `https://i.pravatar.cc/40?u=${user?.id}`} alt="" className="w-8 h-8 rounded-full object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            title="Sign out"
          >
            ⏏
          </button>
        </div>
      </div>
    </aside>
  )
}
