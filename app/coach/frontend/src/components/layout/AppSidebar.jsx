import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const NAV = {
  super_coach: [
    { label: 'Dashboard',       path: '/dashboard',              icon: '📊' },
    { label: 'Calendar',        path: '/calendar',               icon: '📅' },
    { label: 'Coaches',         path: '/super/coaches',          icon: '👥' },
    { label: 'Packages',        path: '/super/packages',         icon: '📦' },
    { label: 'Reconciliation',  path: '/super/reconciliation',   icon: '🔍' },
    { label: 'Find a Coach',    path: '/coaches',                icon: '🏏' },
  ],
  coach: [
    { label: 'Dashboard', path: '/dashboard',    icon: '📊' },
    { label: 'Calendar',  path: '/calendar',     icon: '📅' },
    { label: 'Players',   path: '/coach/players', icon: '👤' },
  ],
  player: [
    { label: 'My Dashboard', path: '/dashboard', icon: '🏠' },
    { label: 'Find a Coach', path: '/coaches',   icon: '🏏' },
  ],
  parent: [
    { label: 'My Dashboard', path: '/dashboard', icon: '🏠' },
    { label: 'Find a Coach', path: '/coaches',   icon: '🏏' },
  ],
}

export default function AppSidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const navItems = NAV[user?.role] || []

  function handleLogout() {
    logout()
    navigate('/login')
    onClose?.()
  }

  function handleNav() {
    onClose?.()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-30
        transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:w-60
      `}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-slate-800 flex-shrink-0">
          <span className="text-indigo-400 font-bold text-lg tracking-tight">🏏 Playgenie</span>
          <button
            onClick={onClose}
            className="md:hidden text-slate-500 hover:text-slate-300 p-1 rounded"
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleNav}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-800 cursor-pointer group min-h-[44px]">
            <img
              src={user?.photo || `https://i.pravatar.cc/40?u=${user?.id}`}
              alt=""
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-slate-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity p-1"
              title="Sign out"
            >
              ⏏
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
