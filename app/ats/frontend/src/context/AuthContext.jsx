import { createContext, useReducer, useEffect } from 'react'
import { MOCK_USERS } from '@/data/mockData'
import { USE_API, api, setAuthToken } from '@/services/api'
import { getSession, cognitoLogin, cognitoLogout } from '@/services/cognito'

export const AuthContext = createContext(null)

// ── Mock mode (no API URL) ────────────────────────────────────────────────────

function mockReducer(state, action) {
  switch (action.type) {
    case 'SET_ROLE': {
      const user = MOCK_USERS.find(u => u.role === action.role) ?? MOCK_USERS[0]
      return { ...state, currentUser: user }
    }
    default:
      return state
  }
}

function MockProvider({ children }) {
  const [state, dispatch] = useReducer(mockReducer, {
    authState: 'authenticated',
    currentUser: MOCK_USERS[0],
  })
  const setRole = (role) => dispatch({ type: 'SET_ROLE', role })
  return (
    <AuthContext.Provider value={{ ...state, login: null, logout: null, setRole }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── API mode (real Cognito) ───────────────────────────────────────────────────

function apiReducer(state, action) {
  switch (action.type) {
    case 'LOADING':       return { authState: 'loading',         currentUser: null }
    case 'AUTHENTICATED': return { authState: 'authenticated',   currentUser: action.user }
    case 'UNAUTHENTICATED': return { authState: 'unauthenticated', currentUser: null }
    default:              return state
  }
}

function ApiProvider({ children }) {
  const [state, dispatch] = useReducer(apiReducer, { authState: 'loading', currentUser: null })

  useEffect(() => {
    getSession()
      .then(async (session) => {
        setAuthToken(session.getIdToken().getJwtToken())
        const user = await api.get('/users/me')
        dispatch({ type: 'AUTHENTICATED', user })
      })
      .catch(() => dispatch({ type: 'UNAUTHENTICATED' }))
  }, [])

  const login = async (email, password) => {
    const session = await cognitoLogin(email, password)
    setAuthToken(session.getIdToken().getJwtToken())
    const user = await api.get('/users/me')
    dispatch({ type: 'AUTHENTICATED', user })
  }

  const logout = () => {
    cognitoLogout()
    setAuthToken(null)
    dispatch({ type: 'UNAUTHENTICATED' })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setRole: () => {} }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Unified export ────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  return USE_API
    ? <ApiProvider>{children}</ApiProvider>
    : <MockProvider>{children}</MockProvider>
}
