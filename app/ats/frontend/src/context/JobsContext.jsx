import { createContext, useReducer } from 'react'
import { MOCK_JOBS } from '@/data/mockData'

export const JobsContext = createContext(null)

const initialState = {
  jobs: MOCK_JOBS,
  activeJobId: null,
  isModalOpen: false,
}

function jobsReducer(state, action) {
  switch (action.type) {
    case 'OPEN_CREATE_MODAL':
      return { ...state, activeJobId: null, isModalOpen: true }
    case 'OPEN_EDIT_MODAL':
      return { ...state, activeJobId: action.jobId, isModalOpen: true }
    case 'CLOSE_MODAL':
      return { ...state, activeJobId: null, isModalOpen: false }
    case 'SAVE_JOB': {
      const exists = state.jobs.find(j => j.id === action.job.id)
      if (exists) {
        return {
          ...state,
          jobs: state.jobs.map(j => j.id === action.job.id ? { ...j, ...action.job, updatedAt: new Date().toISOString().slice(0, 10) } : j),
          isModalOpen: false,
          activeJobId: null,
        }
      }
      const newJob = {
        ...action.job,
        id: `j${Date.now()}`,
        applicantCount: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
      }
      return { ...state, jobs: [newJob, ...state.jobs], isModalOpen: false, activeJobId: null }
    }
    case 'SET_STATUS':
      return {
        ...state,
        jobs: state.jobs.map(j =>
          j.id === action.jobId ? { ...j, status: action.status, updatedAt: new Date().toISOString().slice(0, 10) } : j
        ),
      }
    default:
      return state
  }
}

export function JobsProvider({ children }) {
  const [state, dispatch] = useReducer(jobsReducer, initialState)

  const openCreateModal = () => dispatch({ type: 'OPEN_CREATE_MODAL' })
  const openEditModal   = (jobId) => dispatch({ type: 'OPEN_EDIT_MODAL', jobId })
  const closeModal      = () => dispatch({ type: 'CLOSE_MODAL' })
  const saveJob         = (job) => dispatch({ type: 'SAVE_JOB', job })
  const setStatus       = (jobId, status) => dispatch({ type: 'SET_STATUS', jobId, status })

  const activeJob = state.jobs.find(j => j.id === state.activeJobId) ?? null
  const openJobs  = state.jobs.filter(j => j.status === 'Open')

  return (
    <JobsContext.Provider value={{ ...state, activeJob, openJobs, openCreateModal, openEditModal, closeModal, saveJob, setStatus }}>
      {children}
    </JobsContext.Provider>
  )
}
