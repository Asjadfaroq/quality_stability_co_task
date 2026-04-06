import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, UserRole } from '../types'

interface AuthState {
  token: string | null
  userId: string | null
  email: string | null
  role: UserRole | null
  login: (user: AuthUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      email: null,
      role: null,
      login: (user) =>
        set({ token: user.token, userId: user.userId, email: user.email, role: user.role }),
      logout: () => set({ token: null, userId: null, email: null, role: null }),
    }),
    { name: 'auth' }
  )
)
