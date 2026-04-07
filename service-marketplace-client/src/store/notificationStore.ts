import { create } from 'zustand'

export type NotificationType = 'new_job' | 'job_confirmed' | 'message' | 'confirm_needed'

export interface AppNotification {
  id:    string
  type:  NotificationType
  title: string
  body:  string
  at:    Date
  read:  boolean
  link?: string
}

interface NotificationState {
  items:       AppNotification[]
  add:         (n: Omit<AppNotification, 'id' | 'at' | 'read'>) => void
  markAllRead: () => void
  clear:       () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],

  add: (n) =>
    set((s) => ({
      items: [
        { ...n, id: crypto.randomUUID(), at: new Date(), read: false },
        ...s.items,
      ].slice(0, 60), // keep max 60 entries
    })),

  markAllRead: () =>
    set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),

  clear: () => set({ items: [] }),
}))
