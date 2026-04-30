import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/context/AuthContext'

const LoginPage           = lazy(() => import('@/pages/auth/LoginPage'))
const CoachDirectoryPage  = lazy(() => import('@/pages/shared/CoachDirectoryPage'))
const CoachProfilePage    = lazy(() => import('@/pages/shared/CoachProfilePage'))
const PlayerDashboard     = lazy(() => import('@/pages/player/PlayerDashboardPage'))
const CoachDashboard      = lazy(() => import('@/pages/coach/CoachDashboardPage'))
const CoachCalendar       = lazy(() => import('@/pages/coach/CoachCalendarPage'))
const SuperDashboard      = lazy(() => import('@/pages/super/SuperDashboardPage'))
const SuperCalendar       = lazy(() => import('@/pages/super/SuperCalendarPage'))
const CoachManagement     = lazy(() => import('@/pages/super/CoachManagementPage'))
const PackageManagement   = lazy(() => import('@/pages/super/PackageManagementPage'))
const ReconciliationPage  = lazy(() => import('@/pages/super/ReconciliationPage'))

const Loader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
  </div>
)

const wrap = (el) => <Suspense fallback={<Loader />}>{el}</Suspense>

function DashboardRouter() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'super_coach') return wrap(<SuperDashboard />)
  if (user.role === 'coach') return wrap(<CoachDashboard />)
  return wrap(<PlayerDashboard />)
}

function CalendarRouter() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'super_coach') return wrap(<SuperCalendar />)
  return wrap(<CoachCalendar />)
}

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: wrap(<LoginPage />) },
  {
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { path: '/dashboard',              element: <DashboardRouter /> },
      { path: '/calendar',               element: <CalendarRouter /> },
      { path: '/coaches',                element: wrap(<CoachDirectoryPage />) },
      { path: '/coaches/:coachId',       element: wrap(<CoachProfilePage />) },
      { path: '/super/coaches',          element: wrap(<CoachManagement />) },
      { path: '/super/packages',         element: wrap(<PackageManagement />) },
      { path: '/super/reconciliation',   element: wrap(<ReconciliationPage />) },
      { path: '/coach/players',          element: wrap(<CoachDashboard />) },
    ],
  },
])
