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

/** Lightweight job record returned by GET /requests/map. */
export interface MapJobDto {
  id: string
  title: string
  category: string | null
  status: 'Pending' | 'Accepted' | 'Completed' | 'PendingConfirmation'
  latitude: number
  longitude: number
  /** Populated for Admin role only. */
  customerEmail: string | null
  /** Populated for Admin role only. */
  providerEmail: string | null
  createdAt: string
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
