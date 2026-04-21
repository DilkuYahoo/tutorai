import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AuthProvider } from '@/context/AuthContext'
import { UIProvider } from '@/context/UIContext'
import { JobsProvider } from '@/context/JobsContext'
import { CandidatesProvider } from '@/context/CandidatesContext'
import { InterviewsProvider } from '@/context/InterviewsContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <UIProvider>
        <JobsProvider>
          <CandidatesProvider>
            <InterviewsProvider>
              <RouterProvider router={router} />
            </InterviewsProvider>
          </CandidatesProvider>
        </JobsProvider>
      </UIProvider>
    </AuthProvider>
  </React.StrictMode>
)
