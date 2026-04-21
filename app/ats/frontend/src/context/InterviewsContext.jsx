import { createContext, useReducer } from 'react'
import { MOCK_INTERVIEWS } from '@/data/mockData'

export const InterviewsContext = createContext(null)

const initialState = {
  interviews: MOCK_INTERVIEWS,
  isFeedbackModalOpen: false,
  activeFeedbackId: null,
}

function interviewsReducer(state, action) {
  switch (action.type) {
    case 'OPEN_FEEDBACK':
      return { ...state, activeFeedbackId: action.interviewId, isFeedbackModalOpen: true }
    case 'CLOSE_FEEDBACK':
      return { ...state, activeFeedbackId: null, isFeedbackModalOpen: false }
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
    case 'SCHEDULE_INTERVIEW':
      return {
        ...state,
        interviews: [
          { ...action.interview, id: `i${Date.now()}`, status: 'Scheduled', feedback: null },
          ...state.interviews,
        ],
      }
    default:
      return state
  }
}

export function InterviewsProvider({ children }) {
  const [state, dispatch] = useReducer(interviewsReducer, initialState)

  const upcomingInterviews = state.interviews
    .filter(i => i.status === 'Scheduled')
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

  const pastInterviews = state.interviews
    .filter(i => i.status === 'Completed' || i.status === 'Cancelled' || i.status === 'No-show')
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))

  const activeFeedbackInterview = state.interviews.find(i => i.id === state.activeFeedbackId) ?? null

  const openFeedbackModal    = (interviewId) => dispatch({ type: 'OPEN_FEEDBACK', interviewId })
  const closeFeedbackModal   = ()            => dispatch({ type: 'CLOSE_FEEDBACK' })
  const submitFeedback       = (interviewId, feedback) => dispatch({ type: 'SUBMIT_FEEDBACK', interviewId, feedback })
  const scheduleInterview    = (interview)  => dispatch({ type: 'SCHEDULE_INTERVIEW', interview })

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
    }}>
      {children}
    </InterviewsContext.Provider>
  )
}
