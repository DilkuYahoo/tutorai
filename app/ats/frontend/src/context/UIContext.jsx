import { createContext, useReducer, useEffect } from 'react'

export const UIContext = createContext(null)

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem('ats-theme')
  if (stored === 'light' || stored === 'dark') return stored
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

const initialState = {
  sidebarCollapsed: false,
  theme: getInitialTheme(),
}

function uiReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    case 'TOGGLE_THEME':
      const newTheme = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('ats-theme', newTheme)
      return { ...state, theme: newTheme }
    default:
      return state
  }
}

export function UIProvider({ children }) {
  const [state, dispatch] = useReducer(uiReducer, initialState)
  const toggleSidebar = () => dispatch({ type: 'TOGGLE_SIDEBAR' })
  const toggleTheme = () => dispatch({ type: 'TOGGLE_THEME' })

  useEffect(() => {
    const root = document.documentElement
    if (state.theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
    }
  }, [state.theme])

  return (
    <UIContext.Provider value={{ ...state, toggleSidebar, toggleTheme }}>
      {children}
    </UIContext.Provider>
  )
}
