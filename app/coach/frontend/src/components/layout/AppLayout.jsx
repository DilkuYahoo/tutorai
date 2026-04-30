import { Outlet } from 'react-router-dom'
import AppSidebar from './AppSidebar'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 dark">
      <AppSidebar />
      <main className="md:pl-60 min-h-screen">
        <div className="p-6 max-w-screen-2xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
