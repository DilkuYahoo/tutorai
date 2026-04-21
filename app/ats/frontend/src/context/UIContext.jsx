import { createContext, useReducer } from 'react'

export const UIContext = createContext(null)

const initialState = {
  sidebarCollapsed: false,
}

function uiReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    default:
      return state
  }
}

export function UIProvider({ children }) {
  const [state, dispatch] = useReducer(uiReducer, initialState)
  const toggleSidebar = () => dispatch({ type: 'TOGGLE_SIDEBAR' })

  return (
    <UIContext.Provider value={{ ...state, toggleSidebar }}>
      {children}
    </UIContext.Provider>
  )
}
