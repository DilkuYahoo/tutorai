import { useContext } from 'react'
import { InterviewsContext } from '@/context/InterviewsContext'

export function useInterviews() {
  return useContext(InterviewsContext)
}
