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

// ── Logs / Activity ───────────────────────────────────────────────────────────

export type LogCategory = 'System' | 'Audit'

/**
 * A single structured log entry received from the backend via SignalR
 * or the REST fallback endpoint GET /api/admin/logs.
 */
export interface LogEntry {
  /** Serilog level: Verbose | Debug | Information | Warning | Error | Fatal */
  level: string
  message: string
  exception: string | null
  /** Class that emitted the log, e.g. "RequestService". */
  sourceContext: string | null
  /** UTC ISO timestamp. */
  timestamp: string
  /** ASP.NET Core trace correlation ID. */
  traceId: string | null
  category: LogCategory
  /** ID of the user who performed the action — Audit entries only. */
  actorUserId: string | null
  /** Machine-readable action key, e.g. "RequestCreated" — Audit entries only. */
  action: string | null
}
