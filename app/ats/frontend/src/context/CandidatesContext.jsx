import { createContext, useReducer, useMemo } from 'react'
import { MOCK_CANDIDATES, MOCK_APPLICATIONS } from '@/data/mockData'

export const CandidatesContext = createContext(null)

const initialState = {
  candidates: MOCK_CANDIDATES,
  applications: MOCK_APPLICATIONS,
  activeAppId: null,
  isDrawerOpen: false,
  searchQuery: '',
  stageFilter: '',
  jobFilter: '',
}

function candidatesReducer(state, action) {
  switch (action.type) {
    case 'OPEN_DRAWER':
      return { ...state, activeAppId: action.appId, isDrawerOpen: true }
    case 'CLOSE_DRAWER':
      return { ...state, activeAppId: null, isDrawerOpen: false }
    case 'SET_FILTER':
      return { ...state, [action.key]: action.value }
    case 'MOVE_STAGE': {
      const now = new Date().toISOString().slice(0, 10)
      return {
        ...state,
        applications: state.applications.map(a =>
          a.id === action.appId
            ? {
                ...a,
                stage: action.stage,
                stageHistory: [
                  ...a.stageHistory,
                  { stage: action.stage, movedAt: now, movedBy: action.movedBy ?? 'u1', note: action.note ?? '' },
                ],
              }
            : a
        ),
      }
    }
    case 'ADD_NOTE':
      return {
        ...state,
        candidates: state.candidates.map(c =>
          c.id === action.candidateId
            ? { ...c, notes: c.notes ? `${c.notes}\n${action.text}` : action.text }
            : c
        ),
      }
    case 'ADD_TAG':
      return {
        ...state,
        candidates: state.candidates.map(c =>
          c.id === action.candidateId && !c.tags.includes(action.tag)
            ? { ...c, tags: [...c.tags, action.tag] }
            : c
        ),
      }
    case 'REMOVE_TAG':
      return {
        ...state,
        candidates: state.candidates.map(c =>
          c.id === action.candidateId
            ? { ...c, tags: c.tags.filter(t => t !== action.tag) }
            : c
        ),
      }
    default:
      return state
  }
}

export function CandidatesProvider({ children }) {
  const [state, dispatch] = useReducer(candidatesReducer, initialState)

  const filteredApplications = useMemo(() => {
    return state.applications.filter(app => {
      const candidate = state.candidates.find(c => c.id === app.candidateId)
      if (!candidate) return false
      const fullName = `${candidate.firstName} ${candidate.lastName}`.toLowerCase()
      const matchesSearch = !state.searchQuery || fullName.includes(state.searchQuery.toLowerCase())
      const matchesStage  = !state.stageFilter || app.stage === state.stageFilter
      const matchesJob    = !state.jobFilter   || app.jobId === state.jobFilter
      return matchesSearch && matchesStage && matchesJob
    })
  }, [state.applications, state.candidates, state.searchQuery, state.stageFilter, state.jobFilter])

  const activeApplication = state.applications.find(a => a.id === state.activeAppId) ?? null
  const activeCandidate   = activeApplication ? state.candidates.find(c => c.id === activeApplication.candidateId) ?? null : null

  const openDrawer  = (appId)                     => dispatch({ type: 'OPEN_DRAWER', appId })
  const closeDrawer = ()                          => dispatch({ type: 'CLOSE_DRAWER' })
  const setFilter   = (key, value)               => dispatch({ type: 'SET_FILTER', key, value })
  const moveStage   = (appId, stage, note)       => dispatch({ type: 'MOVE_STAGE', appId, stage, note })
  const addNote     = (candidateId, text)        => dispatch({ type: 'ADD_NOTE', candidateId, text })
  const addTag      = (candidateId, tag)         => dispatch({ type: 'ADD_TAG', candidateId, tag })
  const removeTag   = (candidateId, tag)         => dispatch({ type: 'REMOVE_TAG', candidateId, tag })

  return (
    <CandidatesContext.Provider value={{
      ...state,
      filteredApplications,
      activeApplication,
      activeCandidate,
      openDrawer,
      closeDrawer,
      setFilter,
      moveStage,
      addNote,
      addTag,
      removeTag,
    }}>
      {children}
    </CandidatesContext.Provider>
  )
}
