import { createContext, useReducer, useEffect, useContext } from 'react'
import { USE_API, api } from '@/services/api'
import { MOCK_USERS } from '@/data/mockData'
import { AuthContext } from '@/context/AuthContext'

export const UsersContext = createContext(null)

const INTERNAL_ROLES = ['admin', 'hiring_manager']

const initialState = {
  users:             USE_API ? [] : MOCK_USERS.filter(u => INTERNAL_ROLES.includes(u.role)),
  loading:           USE_API,
  isInviteModalOpen: false,
  isEditDrawerOpen:  false,
  editUserId:        null,
}

function usersReducer(state, action) {
  switch (action.type) {
    case 'SET_USERS':
      return { ...state, users: action.users, loading: false }
    case 'ADD_USER':
      return { ...state, users: [action.user, ...state.users] }
    case 'UPDATE_USER':
      return { ...state, users: state.users.map(u => u.id === action.user.id ? action.user : u) }
    case 'REMOVE_USER':
      return { ...state, users: state.users.filter(u => u.id !== action.userId) }
    case 'OPEN_INVITE':
      return { ...state, isInviteModalOpen: true }
    case 'CLOSE_INVITE':
      return { ...state, isInviteModalOpen: false }
    case 'OPEN_EDIT':
      return { ...state, editUserId: action.userId, isEditDrawerOpen: true }
    case 'CLOSE_EDIT':
      return { ...state, editUserId: null, isEditDrawerOpen: false }
    default:
      return state
  }
}

export function UsersProvider({ children }) {
  const [state, dispatch] = useReducer(usersReducer, initialState)
  const { authState } = useContext(AuthContext)

  useEffect(() => {
    if (!USE_API || authState !== 'authenticated') return
    api.get('/users')
      .then(data => { if (data) dispatch({ type: 'SET_USERS', users: data }) })
      .catch(console.error)
  }, [authState])

  const userById = (id) => state.users.find(u => u.id === id) ?? null

  const openInviteModal  = () => dispatch({ type: 'OPEN_INVITE' })
  const closeInviteModal = () => dispatch({ type: 'CLOSE_INVITE' })
  const openEditDrawer   = (userId) => dispatch({ type: 'OPEN_EDIT', userId })
  const closeEditDrawer  = () => dispatch({ type: 'CLOSE_EDIT' })

  const inviteUser = async (data) => {
    if (!USE_API) {
      const initials = data.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
      dispatch({ type: 'ADD_USER', user: { ...data, id: `u${Date.now()}`, avatarInitials: initials, status: 'active' } })
      return
    }
    const user = await api.post('/users', data)
    dispatch({ type: 'ADD_USER', user })
  }

  const updateUser = async (userId, data) => {
    if (!USE_API) {
      const existing = state.users.find(u => u.id === userId)
      dispatch({ type: 'UPDATE_USER', user: { ...existing, ...data } })
      return
    }
    const user = await api.put(`/users/${userId}`, data)
    dispatch({ type: 'UPDATE_USER', user })
  }

  const enableUser = async (userId) => {
    if (!USE_API) {
      const existing = state.users.find(u => u.id === userId)
      dispatch({ type: 'UPDATE_USER', user: { ...existing, status: 'active' } })
      return
    }
    const user = await api.post(`/users/${userId}/enable`, {})
    dispatch({ type: 'UPDATE_USER', user })
  }

  const disableUser = async (userId) => {
    if (!USE_API) {
      const existing = state.users.find(u => u.id === userId)
      dispatch({ type: 'UPDATE_USER', user: { ...existing, status: 'disabled' } })
      return
    }
    const user = await api.post(`/users/${userId}/disable`, {})
    dispatch({ type: 'UPDATE_USER', user })
  }

  const deleteUser = async (userId) => {
    if (!USE_API) {
      dispatch({ type: 'REMOVE_USER', userId })
      return
    }
    await api.delete(`/users/${userId}`)
    dispatch({ type: 'REMOVE_USER', userId })
  }

  return (
    <UsersContext.Provider value={{
      ...state,
      userById,
      openInviteModal,
      closeInviteModal,
      openEditDrawer,
      closeEditDrawer,
      inviteUser,
      updateUser,
      enableUser,
      disableUser,
      deleteUser,
    }}>
      {children}
    </UsersContext.Provider>
  )
}
