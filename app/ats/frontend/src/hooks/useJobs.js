import { useContext } from 'react'
import { JobsContext } from '@/context/JobsContext'

export function useJobs() {
  return useContext(JobsContext)
}
