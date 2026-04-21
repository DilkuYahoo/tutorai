import { useUI } from '@/hooks/useUI'
import { useAuth } from '@/hooks/useAuth'
import RoleSwitcher from './RoleSwitcher'

export default function AppTopbar({ title }) {
  const { toggleSidebar } = useUI()
  const { currentUser } = useAuth()

  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-4 sm:px-6 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors md:hidden"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white hidden sm:block">{title}</span>
      </div>

      {/* Right: role switcher + avatar */}
      <div className="flex items-center gap-3">
        <RoleSwitcher />
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-400">
          {currentUser.avatarInitials}
        </div>
      </div>
    </header>
  )
}
