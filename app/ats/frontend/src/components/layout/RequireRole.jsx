import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function RequireRole({ allowed, children }) {
  const { currentUser } = useAuth()

  if (!allowed.includes(currentUser.role)) {
    return <Navigate to={currentUser.role === 'candidate' ? '/careers' : '/dashboard'} replace />
  }

  return children
}
