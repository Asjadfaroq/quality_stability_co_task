import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types'

interface Props {
  children: React.ReactNode
  roleRequired?: UserRole
}

export default function ProtectedRoute({ children, roleRequired }: Props) {
  const { token, role } = useAuthStore()

  if (!token) return <Navigate to="/login" replace />
  if (roleRequired && role !== roleRequired) return <Navigate to="/login" replace />

  return <>{children}</>
}
