import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppLayout from '@/components/layout/AppLayout'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))

const Loader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
  </div>
)

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  {
    element: <AppLayout />,
    children: [
      { path: 'dashboard', element: <Suspense fallback={<Loader />}><DashboardPage /></Suspense> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
