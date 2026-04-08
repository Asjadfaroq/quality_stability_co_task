import axios from 'axios'

/**
 * Shared formatting utilities — import from here instead of duplicating
 * per-file implementations.
 */

/**
 * Returns a human-readable relative time string ("3m ago", "2h ago", etc.)
 * for any Date or ISO string.  Falls back to a short locale date once the
 * value is more than a week old.
 */
export function timeAgo(date: Date | string): string {
  const d    = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'Just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 7)  return `${days}d ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Formats an ISO date string as a short locale date (e.g. "15 Apr 2025").
 * Accepts optional `Intl.DateTimeFormatOptions` to customise the output.
 */
export function formatDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  return new Date(iso).toLocaleDateString('en-GB', options)
}

/**
 * Extracts a user-facing message from an Axios error response, preferring
 * the RFC 9457 `detail` field, then `message`, then the provided fallback.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as { response?: { data?: { detail?: string; message?: string } } }
    return e.response?.data?.detail ?? e.response?.data?.message ?? fallback
  }
  return fallback
}

/** Machine-readable code from API (ProblemDetails extension or flat JSON body). */
export function apiErrorCode(err: unknown): string | undefined {
  if (!axios.isAxiosError(err)) return undefined
  const d = err.response?.data
  if (d && typeof d === 'object' && 'errorCode' in d) {
    const c = (d as { errorCode: unknown }).errorCode
    return typeof c === 'string' ? c : undefined
  }
  return undefined
}
