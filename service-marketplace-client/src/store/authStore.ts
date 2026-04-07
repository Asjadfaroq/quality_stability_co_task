import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthUser, UserRole } from '../types'
import { parseTokenExpiry, parseTokenEmail, isTokenExpired } from '../utils/auth'

interface AuthState {
  token:         string   | null
  userId:        string   | null
  email:         string   | null
  role:          UserRole | null
  expiresAt:     number   | null  // Unix seconds decoded from JWT exp claim
  isInitialized: boolean          // true once startup token validation is complete

  login:      (user: AuthUser) => void
  logout:     () => void
  initialize: () => void          // call once on app mount
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token:         null,
      userId:        null,
      email:         null,
      role:          null,
      expiresAt:     null,
      isInitialized: false,

      login: (user) => {
        const expiresAt = parseTokenExpiry(user.token)
        // Prefer the email field from the API response; fall back to decoding it
        // from the JWT payload in case the backend omits it from the response body.
        const email = user.email || parseTokenEmail(user.token)
        set({ token: user.token, userId: user.userId, email, role: user.role, expiresAt })
      },

      logout: () =>
        set({ token: null, userId: null, email: null, role: null, expiresAt: null }),

      initialize: () => {
        const { token, expiresAt } = get()

        if (!token) {
          set({ isInitialized: true })
          return
        }

        // Re-parse expiry from the token in case the stored expiresAt is stale
        const parsedExpiry = parseTokenExpiry(token) ?? expiresAt

        if (isTokenExpired(parsedExpiry)) {
          // Token expired while the user was away — clear silently
          set({ token: null, userId: null, email: null, role: null, expiresAt: null, isInitialized: true })
        } else {
          // If email was never stored (e.g. session persisted before this field was
          // added), recover it from the token payload so the UI always has it.
          const { email } = get()
          const resolvedEmail = email || parseTokenEmail(token)
          set({ email: resolvedEmail, expiresAt: parsedExpiry, isInitialized: true })
        }
      },
    }),
    {
      name: 'auth',
      // sessionStorage is tab-scoped — each tab has its own isolated session,
      // so two tabs can be logged in as different accounts simultaneously.
      storage: createJSONStorage(() => sessionStorage),
      // isInitialized is runtime-only — never persist it so it always starts false
      partialize: (state) => ({
        token:     state.token,
        userId:    state.userId,
        email:     state.email,
        role:      state.role,
        expiresAt: state.expiresAt,
      }),
    }
  )
)
