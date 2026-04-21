import { useContext } from 'react'
import { CandidatesContext } from '@/context/CandidatesContext'

export function useCandidates() {
  return useContext(CandidatesContext)
}
