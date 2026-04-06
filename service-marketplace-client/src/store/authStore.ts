import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, UserRole } from '../types'
import { parseTokenExpiry, isTokenExpired } from '../utils/auth'

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
        set({ token: user.token, userId: user.userId, email: user.email, role: user.role, expiresAt })
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
          set({ expiresAt: parsedExpiry, isInitialized: true })
        }
      },
    }),
    {
      name: 'auth',
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
