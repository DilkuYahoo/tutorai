import { createContext, useReducer, useEffect } from 'react'

export const UIContext = createContext(null)

const getInitialTheme = () => {
  const stored = localStorage.getItem('pm-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

function uiReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR': return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    case 'TOGGLE_THEME': {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('pm-theme', newTheme)
      return { ...state, theme: newTheme }
    }
    default: return state
  }
}

export function UIProvider({ children }) {
  const [state, dispatch] = useReducer(uiReducer, {
    sidebarCollapsed: false,
    theme: getInitialTheme(),
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', state.theme === 'dark')
    root.classList.toggle('light', state.theme === 'light')
  }, [state.theme])

  return (
    <UIContext.Provider value={{
      ...state,
      toggleSidebar: () => dispatch({ type: 'TOGGLE_SIDEBAR' }),
      toggleTheme:   () => dispatch({ type: 'TOGGLE_THEME' }),
    }}>
      {children}
    </UIContext.Provider>
  )
}
