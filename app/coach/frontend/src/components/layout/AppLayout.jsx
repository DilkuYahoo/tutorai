import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import { useAuth } from '@/context/AuthContext'

const PAGE_TITLES = {
  '/dashboard':            'Dashboard',
  '/calendar':             'Calendar',
  '/coaches':              'Find a Coach',
  '/super/coaches':        'Coaches',
  '/super/packages':       'Packages',
  '/super/reconciliation': 'Reconciliation',
  '/coach/players':        'My Players',
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const title = PAGE_TITLES[location.pathname] ?? 'Playgenie'

  return (
    <div className="min-h-screen bg-slate-950 dark">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile topbar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 z-10 flex items-center justify-between px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Open menu"
        >
          ☰
        </button>
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        <img
          src={user?.photo || `https://i.pravatar.cc/40?u=${user?.id}`}
          alt=""
          className="w-8 h-8 rounded-full object-cover"
        />
      </header>

      {/* Content */}
      <main className="md:pl-60 pt-14 md:pt-0 min-h-screen">
        <div className="p-4 md:p-6 max-w-screen-2xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
