import { createContext, useReducer, useEffect } from 'react'
import { MOCK_JOBS } from '@/data/mockData'
import { USE_API, api } from '@/services/api'

export const JobsContext = createContext(null)

const initialState = {
  jobs: USE_API ? [] : MOCK_JOBS,
  loading: USE_API,
  activeJobId: null,
  isModalOpen: false,
}

function jobsReducer(state, action) {
  switch (action.type) {
    case 'SET_JOBS':
      return { ...state, jobs: action.jobs, loading: false }
    case 'OPEN_CREATE_MODAL':
      return { ...state, activeJobId: null, isModalOpen: true }
    case 'OPEN_EDIT_MODAL':
      return { ...state, activeJobId: action.jobId, isModalOpen: true }
    case 'CLOSE_MODAL':
      return { ...state, activeJobId: null, isModalOpen: false }
    case 'UPSERT_JOB': {
      const exists = state.jobs.find(j => j.id === action.job.id)
      const jobs = exists
        ? state.jobs.map(j => j.id === action.job.id ? action.job : j)
        : [action.job, ...state.jobs]
      return { ...state, jobs, isModalOpen: false, activeJobId: null }
    }
    case 'SET_STATUS':
      return {
        ...state,
        jobs: state.jobs.map(j =>
          j.id === action.jobId ? { ...j, status: action.status } : j
        ),
      }
    default:
      return state
  }
}

export function JobsProvider({ children }) {
  const [state, dispatch] = useReducer(jobsReducer, initialState)

  useEffect(() => {
    if (!USE_API) return
    api.get('/jobs')
      .then(jobs => dispatch({ type: 'SET_JOBS', jobs }))
      .catch(console.error)
  }, [])

  const openCreateModal = () => dispatch({ type: 'OPEN_CREATE_MODAL' })
  const openEditModal   = (jobId) => dispatch({ type: 'OPEN_EDIT_MODAL', jobId })
  const closeModal      = () => dispatch({ type: 'CLOSE_MODAL' })

  const saveJob = async (job) => {
    if (!USE_API) {
      const isNew = !state.jobs.find(j => j.id === job.id)
      const saved = isNew
        ? { ...job, id: `j${Date.now()}`, applicantCount: 0, createdAt: new Date().toISOString().slice(0, 10) }
        : job
      dispatch({ type: 'UPSERT_JOB', job: saved })
      return
    }
    if (job.id && state.jobs.find(j => j.id === job.id)) {
      const updated = await api.put(`/jobs/${job.id}`, job)
      if (updated) dispatch({ type: 'UPSERT_JOB', job: updated })
    } else {
      const { id } = await api.post('/jobs', job)
      const created = await api.get(`/jobs/${id}`)
      dispatch({ type: 'UPSERT_JOB', job: created })
    }
  }

  const setStatus = async (jobId, status) => {
    if (!USE_API) {
      dispatch({ type: 'SET_STATUS', jobId, status })
      return
    }
    if (status === 'Archived') {
      await api.delete(`/jobs/${jobId}`)
    } else {
      await api.put(`/jobs/${jobId}`, { status })
    }
    dispatch({ type: 'SET_STATUS', jobId, status })
  }

  const activeJob = state.jobs.find(j => j.id === state.activeJobId) ?? null
  const openJobs  = state.jobs.filter(j => j.status === 'Open')

  return (
    <JobsContext.Provider value={{
      ...state,
      activeJob,
      openJobs,
      openCreateModal,
      openEditModal,
      closeModal,
      saveJob,
      setStatus,
    }}>
      {children}
    </JobsContext.Provider>
  )
}
