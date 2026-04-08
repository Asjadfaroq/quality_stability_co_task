import type { UserRole } from '../types'
import { ROUTES } from '../constants/routes'

/** Decode and return the raw JWT payload object, or null on failure. */
function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // JWT uses base64url — normalise to standard base64 before decoding
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Decode the JWT payload and return the `exp` Unix timestamp, or null on failure. */
export function parseTokenExpiry(token: string): number | null {
  const payload = decodeTokenPayload(token)
  return payload && typeof payload.exp === 'number' ? payload.exp : null
}

/**
 * Decode the JWT payload and extract the authenticated user's email.
 *
 * ASP.NET Core Identity writes the email into one of two well-known claim URIs.
 * We check both, plus the short-form `email` claim used by many OIDC providers,
 * so this works regardless of how the backend configures its token.
 */
export function parseTokenEmail(token: string): string | null {
  const payload = decodeTokenPayload(token)
  if (!payload) return null

  // ASP.NET Core long-form claim (most common when using AddIdentity / ClaimTypes.Email)
  const aspNetEmail = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
  if (typeof aspNetEmail === 'string' && aspNetEmail) return aspNetEmail

  // Standard OIDC / short-form claim
  const oidcEmail = payload['email']
  if (typeof oidcEmail === 'string' && oidcEmail) return oidcEmail

  // ASP.NET Core "unique_name" — sometimes used for email-as-username setups
  const uniqueName = payload['unique_name']
  if (typeof uniqueName === 'string' && uniqueName) return uniqueName

  return null
}

/** Returns true if the token has expired or will expire within the next 30 seconds. */
export function isTokenExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false
  return Date.now() / 1000 > expiresAt - 30
}

/** Maps a user role to its primary dashboard route. */
export function getDashboardPath(role: UserRole | null): string {
  switch (role) {
    case 'Customer':         return ROUTES.CUSTOMER
    case 'Admin':            return ROUTES.ADMIN
    case 'ProviderAdmin':
    case 'ProviderEmployee': return ROUTES.PROVIDER
    default:                 return ROUTES.LOGIN
  }
}

// Key used to preserve the intended URL across a full-page reload on 401
export const AUTH_REDIRECT_KEY = 'auth_redirect'
