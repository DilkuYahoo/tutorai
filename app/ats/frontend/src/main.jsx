import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from '@/context/AuthContext'
import { UIProvider } from '@/context/UIContext'
import { JobsProvider } from '@/context/JobsContext'
import { CandidatesProvider } from '@/context/CandidatesContext'
import { InterviewsProvider } from '@/context/InterviewsContext'
import { UsersProvider } from '@/context/UsersContext'
import { useAuth } from '@/hooks/useAuth'
import './index.css'

// Providers always mount in the same tree position — each context gates its own fetch on authState
function DataProviders({ children }) {
  const { authState } = useAuth()
  if (authState === 'loading') return null
  return (
    <JobsProvider>
      <CandidatesProvider>
        <InterviewsProvider>
          <UsersProvider>
            {children}
          </UsersProvider>
        </InterviewsProvider>
      </CandidatesProvider>
    </JobsProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <UIProvider>
        <DataProviders>
          <RouterProvider router={router} />
        </DataProviders>
      </UIProvider>
    </AuthProvider>
  </React.StrictMode>
)
