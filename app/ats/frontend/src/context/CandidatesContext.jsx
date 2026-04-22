import { createContext, useReducer, useEffect, useMemo } from 'react'
import { MOCK_CANDIDATES, MOCK_APPLICATIONS } from '@/data/mockData'
import { USE_API, api } from '@/services/api'

export const CandidatesContext = createContext(null)

const initialState = {
  candidates:  USE_API ? [] : MOCK_CANDIDATES,
  applications: USE_API ? [] : MOCK_APPLICATIONS,
  loading:     USE_API,
  activeAppId: null,
  isDrawerOpen: false,
  searchQuery: '',
  stageFilter: '',
  jobFilter: '',
}

function candidatesReducer(state, action) {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, candidates: action.candidates, applications: action.applications, loading: false }
    case 'OPEN_DRAWER':
      return { ...state, activeAppId: action.appId, isDrawerOpen: true }
    case 'CLOSE_DRAWER':
      return { ...state, activeAppId: null, isDrawerOpen: false }
    case 'SET_FILTER':
      return { ...state, [action.key]: action.value }
    case 'MOVE_STAGE':
      return {
        ...state,
        applications: state.applications.map(a =>
          a.id === action.appId ? { ...a, stage: action.stage } : a
        ),
      }
    case 'UPDATE_CANDIDATE':
      return {
        ...state,
        candidates: state.candidates.map(c =>
          c.id === action.candidate.id ? action.candidate : c
        ),
      }
    default:
      return state
  }
}

// Flatten the pipeline board (stage -> [card]) into application-shaped objects
function flattenBoard(board) {
  return Object.entries(board).flatMap(([stage, cards]) =>
    cards.map(card => ({
      id:            card.appId,
      candidateId:   card.candidateId,
      jobId:         card.jobId,
      jobTitle:      card.jobTitle,
      stage,
      fitScore:      card.fitScore ?? null,
      appliedAt:     card.appliedAt ?? '',
      stageHistory:  [],
    }))
  )
}

export function CandidatesProvider({ children }) {
  const [state, dispatch] = useReducer(candidatesReducer, initialState)

  useEffect(() => {
    if (!USE_API) return
    Promise.all([api.get('/pipeline'), api.get('/candidates')])
      .then(([board, candidates]) => {
        dispatch({ type: 'SET_DATA', candidates, applications: flattenBoard(board) })
      })
      .catch(console.error)
  }, [])

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
  const activeCandidate   = activeApplication
    ? state.candidates.find(c => c.id === activeApplication.candidateId) ?? null
    : null

  const openDrawer  = (appId)          => dispatch({ type: 'OPEN_DRAWER', appId })
  const closeDrawer = ()               => dispatch({ type: 'CLOSE_DRAWER' })
  const setFilter   = (key, value)     => dispatch({ type: 'SET_FILTER', key, value })

  const moveStage = async (appId, stage, note) => {
    if (!USE_API) {
      dispatch({ type: 'MOVE_STAGE', appId, stage })
      return
    }
    await api.post(`/applications/${appId}/move`, { stage, note: note ?? '' })
    dispatch({ type: 'MOVE_STAGE', appId, stage })
  }

  const _updateCandidate = async (candidateId, patch) => {
    if (!USE_API) {
      dispatch({ type: 'UPDATE_CANDIDATE', candidate: { ...state.candidates.find(c => c.id === candidateId), ...patch } })
      return
    }
    const updated = await api.put(`/candidates/${candidateId}`, patch)
    dispatch({ type: 'UPDATE_CANDIDATE', candidate: updated })
  }

  const addNote = (candidateId, text) => {
    const c = state.candidates.find(c => c.id === candidateId)
    if (!c) return
    const notes = c.notes ? `${c.notes}\n${text}` : text
    _updateCandidate(candidateId, { ...c, notes })
  }

  const addTag = (candidateId, tag) => {
    const c = state.candidates.find(c => c.id === candidateId)
    if (!c || c.tags?.includes(tag)) return
    _updateCandidate(candidateId, { ...c, tags: [...(c.tags ?? []), tag] })
  }

  const removeTag = (candidateId, tag) => {
    const c = state.candidates.find(c => c.id === candidateId)
    if (!c) return
    _updateCandidate(candidateId, { ...c, tags: (c.tags ?? []).filter(t => t !== tag) })
  }

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
