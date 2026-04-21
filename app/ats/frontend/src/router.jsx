import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import PublicLayout from '@/components/layout/PublicLayout'
import RequireRole from '@/components/layout/RequireRole'

const DashboardPage   = lazy(() => import('@/pages/admin/DashboardPage'))
const JobsPage        = lazy(() => import('@/pages/admin/JobsPage'))
const CandidatesPage  = lazy(() => import('@/pages/admin/CandidatesPage'))
const PipelinePage    = lazy(() => import('@/pages/admin/PipelinePage'))
const InterviewsPage  = lazy(() => import('@/pages/admin/InterviewsPage'))
const ReportsPage     = lazy(() => import('@/pages/admin/ReportsPage'))
const CareersPage     = lazy(() => import('@/pages/public/CareersPage'))
const ApplicationPage = lazy(() => import('@/pages/public/ApplicationPage'))
const NotFoundPage    = lazy(() => import('@/pages/shared/NotFoundPage'))

const Loader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
  </div>
)

const wrap = (el) => <Suspense fallback={<Loader />}>{el}</Suspense>

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/careers" replace />,
  },
  {
    element: <PublicLayout />,
    children: [
      { path: 'careers',             element: wrap(<CareersPage />) },
      { path: 'careers/:jobId/apply', element: wrap(<ApplicationPage />) },
    ],
  },
  {
    element: (
      <RequireRole allowed={['admin', 'hiring_manager']}>
        <AppLayout />
      </RequireRole>
    ),
    children: [
      { path: 'dashboard',  element: wrap(<DashboardPage />) },
      { path: 'jobs',       element: wrap(<JobsPage />) },
      { path: 'candidates', element: wrap(<CandidatesPage />) },
      { path: 'pipeline',   element: wrap(<PipelinePage />) },
      { path: 'interviews', element: wrap(<InterviewsPage />) },
      {
        path: 'reports',
        element: (
          <RequireRole allowed={['admin']}>
            {wrap(<ReportsPage />)}
          </RequireRole>
        ),
      },
    ],
  },
  {
    path: '*',
    element: wrap(<NotFoundPage />),
  },
])
