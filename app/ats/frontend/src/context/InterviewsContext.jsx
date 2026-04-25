import { createContext, useReducer, useEffect, useContext } from 'react'
import { MOCK_INTERVIEWS } from '@/data/mockData'
import { USE_API, api } from '@/services/api'
import { AuthContext } from '@/context/AuthContext'

export const InterviewsContext = createContext(null)

const initialState = {
  interviews:            USE_API ? [] : MOCK_INTERVIEWS,
  loading:               USE_API,
  isFeedbackModalOpen:   false,
  activeFeedbackId:      null,
  isScheduleModalOpen:   false,
  scheduleContext:       null, // { applicationId, candidateId, jobId, candidateName, jobTitle }
  activeInterviewId:     null, // set when rescheduling an existing interview
}

function interviewsReducer(state, action) {
  switch (action.type) {
    case 'SET_INTERVIEWS':
      return { ...state, interviews: action.interviews, loading: false }
    case 'UPSERT_INTERVIEW': {
      const exists = state.interviews.find(i => i.id === action.interview.id)
      const interviews = exists
        ? state.interviews.map(i => i.id === action.interview.id ? action.interview : i)
        : [action.interview, ...state.interviews]
      return { ...state, interviews }
    }
    case 'OPEN_FEEDBACK':
      return { ...state, activeFeedbackId: action.interviewId, isFeedbackModalOpen: true }
    case 'CLOSE_FEEDBACK':
      return { ...state, activeFeedbackId: null, isFeedbackModalOpen: false }
    case 'OPEN_SCHEDULE':
      return { ...state, scheduleContext: action.context, activeInterviewId: action.interviewId ?? null, isScheduleModalOpen: true }
    case 'CLOSE_SCHEDULE':
      return { ...state, scheduleContext: null, activeInterviewId: null, isScheduleModalOpen: false }
    case 'UPDATE_INTERVIEW':
      return {
        ...state,
        interviews: state.interviews.map(i => i.id === action.interview.id ? action.interview : i),
      }
    case 'SUBMIT_FEEDBACK':
      return {
        ...state,
        interviews: state.interviews.map(i =>
          i.id === action.interviewId
            ? { ...i, status: 'Completed', feedback: { ...action.feedback, submittedAt: new Date().toISOString() } }
            : i
        ),
        isFeedbackModalOpen: false,
        activeFeedbackId: null,
      }
    default:
      return state
  }
}

export function InterviewsProvider({ children }) {
  const [state, dispatch] = useReducer(interviewsReducer, initialState)
  const { authState } = useContext(AuthContext)

  useEffect(() => {
    if (!USE_API || authState !== 'authenticated') return
    api.get('/interviews')
      .then(interviews => dispatch({ type: 'SET_INTERVIEWS', interviews }))
      .catch(console.error)
  }, [authState])

  const upcomingInterviews = state.interviews
    .filter(i => i.status === 'Scheduled')
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

  const pastInterviews = state.interviews
    .filter(i => i.status === 'Completed' || i.status === 'No-show')
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))

  const activeFeedbackInterview = state.interviews.find(i => i.id === state.activeFeedbackId) ?? null

  const openFeedbackModal  = (interviewId) => dispatch({ type: 'OPEN_FEEDBACK', interviewId })
  const closeFeedbackModal = ()            => dispatch({ type: 'CLOSE_FEEDBACK' })

  const openScheduleModal  = (context, interviewId = null) => dispatch({ type: 'OPEN_SCHEDULE', context, interviewId })
  const closeScheduleModal = () => dispatch({ type: 'CLOSE_SCHEDULE' })

  const scheduleInterview = async (interview) => {
    if (!USE_API) {
      dispatch({ type: 'UPSERT_INTERVIEW', interview: { ...interview, id: `i${Date.now()}`, status: 'Scheduled', feedback: null } })
      return
    }
    const created = await api.post('/interviews', interview)
    dispatch({ type: 'UPSERT_INTERVIEW', interview: created })
  }

  const updateInterview = async (interviewId, updates) => {
    const existing = state.interviews.find(i => i.id === interviewId)
    dispatch({ type: 'UPDATE_INTERVIEW', interview: { ...existing, ...updates } })
    if (!USE_API) return
    try {
      const updated = await api.put(`/interviews/${interviewId}`, updates)
      dispatch({ type: 'UPDATE_INTERVIEW', interview: updated })
    } catch (err) {
      if (existing) dispatch({ type: 'UPDATE_INTERVIEW', interview: existing })
      throw err
    }
  }

  const submitFeedback = async (interviewId, feedback) => {
    if (!USE_API) {
      dispatch({ type: 'SUBMIT_FEEDBACK', interviewId, feedback })
      return
    }
    const updated = await api.post(`/interviews/${interviewId}/feedback`, feedback)
    dispatch({ type: 'UPSERT_INTERVIEW', interview: updated })
    dispatch({ type: 'CLOSE_FEEDBACK' })
  }

  return (
    <InterviewsContext.Provider value={{
      ...state,
      upcomingInterviews,
      pastInterviews,
      activeFeedbackInterview,
      openFeedbackModal,
      closeFeedbackModal,
      submitFeedback,
      scheduleInterview,
      updateInterview,
      openScheduleModal,
      closeScheduleModal,
    }}>
      {children}
    </InterviewsContext.Provider>
  )
}
