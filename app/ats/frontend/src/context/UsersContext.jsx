import { createContext, useState, useEffect, useContext } from 'react'
import { USE_API, api } from '@/services/api'
import { MOCK_USERS } from '@/data/mockData'
import { AuthContext } from '@/context/AuthContext'

export const UsersContext = createContext(null)

export function UsersProvider({ children }) {
  const [users, setUsers] = useState(USE_API ? [] : MOCK_USERS)
  const { authState } = useContext(AuthContext)

  useEffect(() => {
    if (!USE_API || authState !== 'authenticated') return
    api.get('/users')
      .then(data => { if (data) setUsers(data) })
      .catch(console.error)
  }, [authState])

  const userById = (id) => users.find(u => u.id === id) ?? null

  return (
    <UsersContext.Provider value={{ users, userById }}>
      {children}
    </UsersContext.Provider>
  )
}
