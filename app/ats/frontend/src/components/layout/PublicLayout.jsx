import { Outlet, Link } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Minimal public header */}
      <header className="fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-6 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <Link to="/careers" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l-4-4 1.5-1.5L9 9l4.5-4.5L15 6z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Recruit</span>
        </Link>
        <Link
          to="/dashboard"
          className="text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors"
        >
          Sign in →
        </Link>
      </header>
      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  )
}
