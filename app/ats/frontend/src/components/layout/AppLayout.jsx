import { Outlet, useLocation } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import AppTopbar from './AppTopbar'
import FeedbackModal from '@/components/interviews/FeedbackModal'
import ScheduleInterviewModal from '@/components/interviews/ScheduleInterviewModal'

const PAGE_TITLES = {
  '/dashboard':  'Dashboard',
  '/jobs':       'Jobs',
  '/candidates': 'Candidates',
  '/pipeline':   'Pipeline',
  '/interviews': 'Interviews',
  '/reports':    'Reports',
}

export default function AppLayout() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Recruit'

  return (
    <div className="min-h-screen bg-slate-950">
      <AppSidebar />
      <AppTopbar title={title} />
      {/* Content area — offset for fixed sidebar (md+) and fixed topbar */}
      <main className="md:pl-60 pt-14 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <FeedbackModal />
      <ScheduleInterviewModal />
    </div>
  )
}
