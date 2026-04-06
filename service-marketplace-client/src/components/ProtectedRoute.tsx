import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types'

interface Props {
  children: React.ReactNode
  roles?: UserRole[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { token, role } = useAuthStore()

  if (!token) return <Navigate to="/login" replace />
  if (roles && role && !roles.includes(role)) return <Navigate to="/login" replace />

  return <>{children}</>
}
