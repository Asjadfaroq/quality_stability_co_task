import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getDashboardPath, isTokenExpired } from '../utils/auth'
import type { UserRole } from '../types'

interface Props {
  children: React.ReactNode
  roles?: UserRole[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { token, role, expiresAt, isInitialized } = useAuthStore()
  const location = useLocation()

  // Wait for startup token validation before making any routing decision
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // No token or token expired client-side → send to login, preserving intended destination
  if (!token || isTokenExpired(expiresAt)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Authenticated but wrong role → redirect to their own dashboard, not to /login
  if (roles && role && !roles.includes(role)) {
    return <Navigate to={getDashboardPath(role)} replace />
  }

  return <>{children}</>
}
