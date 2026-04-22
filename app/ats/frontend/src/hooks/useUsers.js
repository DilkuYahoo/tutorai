import { useContext } from 'react'
import { UsersContext } from '@/context/UsersContext'

export function useUsers() {
  return useContext(UsersContext)
}
