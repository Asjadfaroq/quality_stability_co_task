import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'

/**
 * Fetches the calling user's effective permission set from GET /api/permissions/me.
 *
 * Usage:
 *   const { hasPermission, isLoading } = usePermissions()
 *   {hasPermission('request.accept') && <AcceptButton />}
 *
 * Notes:
 * - Admin users short-circuit to true for every permission without an API call.
 * - The query is cached for 5 minutes (matching backend cache TTL) and not
 *   refetched on window focus to avoid redundant calls.
 * - While loading, hasPermission returns false so restricted actions stay hidden.
 */
export function usePermissions() {
  const token  = useAuthStore((s) => s.token)
  const userId = useAuthStore((s) => s.userId)
  const role   = useAuthStore((s) => s.role)

  const isAdmin = role === 'Admin'

  const { data, isLoading } = useQuery<string[]>({
    // Include userId in the key so that when a different user logs in on the
    // same tab their query is never served the previous user's cached data.
    queryKey: ['permissions-me', userId],
    queryFn:  () => api.get('/permissions/me').then((r) => r.data),
    // Admin always has full access — skip the round-trip.
    enabled:    !!token && !!userId && !isAdmin,
    staleTime:  5 * 60 * 1000, // 5 min — matches backend TTL
    gcTime:     10 * 60 * 1000,
  })

  const permissionsSet = new Set(data ?? [])

  /**
   * Returns true if the current user has the named permission.
   * Always true for Admin; false while the fetch is in-flight.
   */
  function hasPermission(name: string): boolean {
    if (isAdmin)  return true
    if (isLoading) return false
    return permissionsSet.has(name)
  }

  return {
    hasPermission,
    isLoading: isLoading && !isAdmin,
  }
}
