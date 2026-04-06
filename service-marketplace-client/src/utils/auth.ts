import type { UserRole } from '../types'

/** Decode the JWT payload and return the `exp` Unix timestamp, or null on failure. */
export function parseTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // JWT uses base64url — replace chars before decoding
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(base64))
    return typeof decoded.exp === 'number' ? decoded.exp : null
  } catch {
    return null
  }
}

/** Returns true if the token has expired or will expire within the next 30 seconds. */
export function isTokenExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false
  return Date.now() / 1000 > expiresAt - 30
}

/** Maps a user role to its primary dashboard route. */
export function getDashboardPath(role: UserRole | null): string {
  switch (role) {
    case 'Customer':         return '/customer'
    case 'Admin':            return '/admin'
    case 'ProviderAdmin':
    case 'ProviderEmployee': return '/provider'
    default:                 return '/login'
  }
}

// Key used to preserve the intended URL across a full-page reload on 401
export const AUTH_REDIRECT_KEY = 'auth_redirect'
