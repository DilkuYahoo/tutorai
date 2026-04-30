import { createContext, useContext, useState } from 'react'
import { superCoach, coaches, players, parents } from '@/data/mock'

const AuthContext = createContext(null)

const MOCK_USERS = {
  'super_coach': { ...superCoach, role: 'super_coach' },
  'coach':       { ...coaches[0], role: 'coach' },
  'coach2':      { ...coaches[1], role: 'coach' },
  'player':      { ...players[0], role: 'player' },
  'parent':      { ...parents[0], role: 'parent' },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  function login(role) {
    setUser(MOCK_USERS[role] || MOCK_USERS['player'])
  }

  function logout() {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
