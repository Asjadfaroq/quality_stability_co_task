import { Navigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuthStore } from '../store/authStore'
import { getDashboardPath, isTokenExpired } from '../utils/auth'

interface Props {
  children: React.ReactNode
}

export default function PublicRoute({ children }: Props) {
  const { token, role, expiresAt, isInitialized } = useAuthStore()

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Authenticated and token still valid → send to their dashboard
  if (token && !isTokenExpired(expiresAt)) {
    return <Navigate to={role ? getDashboardPath(role) : ROUTES.LOGIN} replace />
  }

  return <>{children}</>
}
