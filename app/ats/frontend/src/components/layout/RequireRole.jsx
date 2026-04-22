import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function RequireRole({ allowed, children }) {
  const { authState, currentUser } = useAuth()

  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (!allowed.includes(currentUser?.role)) {
    return <Navigate to={currentUser?.role === 'candidate' ? '/careers' : '/dashboard'} replace />
  }

  return children
}
