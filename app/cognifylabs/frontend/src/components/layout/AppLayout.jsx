import { Outlet } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import AppTopbar from './AppTopbar'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950">
      <AppSidebar />
      <AppTopbar />
      <main className="md:pl-60 pt-14 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <footer className="md:pl-60 border-t border-slate-800/60 px-6 py-4">
        <p className="text-xs text-slate-600 text-center">
          © {new Date().getFullYear()} CognifyLabs.ai — Platform Monitor
        </p>
      </footer>
    </div>
  )
}
