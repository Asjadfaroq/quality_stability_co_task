export type UserRole = 'Admin' | 'ProviderAdmin' | 'ProviderEmployee' | 'Customer'

export type { StatItem } from '../components/ui'

export interface AuthUser {
  token: string
  userId: string
  email: string
  role: UserRole
}

export interface ServiceRequest {
  id: string
  title: string
  description: string
  category: string
  latitude: number
  longitude: number
  status: 'Pending' | 'Accepted' | 'Completed' | 'PendingConfirmation'
  createdAt: string
  updatedAt: string
}

/** Generic paginated response envelope returned by all list endpoints. */
export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}
