import { createContext, useState, useEffect } from 'react'
import { USE_API, api } from '@/services/api'
import { MOCK_USERS } from '@/data/mockData'

export const UsersContext = createContext(null)

export function UsersProvider({ children }) {
  const [users, setUsers] = useState(USE_API ? [] : MOCK_USERS)

  useEffect(() => {
    if (!USE_API) return
    api.get('/users')
      .then(data => { if (data) setUsers(data) })
      .catch(console.error)
  }, [])

  const userById = (id) => users.find(u => u.id === id) ?? null

  return (
    <UsersContext.Provider value={{ users, userById }}>
      {children}
    </UsersContext.Provider>
  )
}
