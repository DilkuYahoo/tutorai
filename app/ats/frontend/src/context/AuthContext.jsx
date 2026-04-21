import { createContext, useReducer } from 'react'
import { MOCK_USERS } from '@/data/mockData'

export const AuthContext = createContext(null)

const initialState = {
  currentUser: MOCK_USERS[0], // Default: Admin (HR)
}

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_ROLE': {
      const user = MOCK_USERS.find(u => u.role === action.role) ?? MOCK_USERS[0]
      return { ...state, currentUser: user }
    }
    default:
      return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  const setRole = (role) => dispatch({ type: 'SET_ROLE', role })

  return (
    <AuthContext.Provider value={{ ...state, setRole }}>
      {children}
    </AuthContext.Provider>
  )
}
