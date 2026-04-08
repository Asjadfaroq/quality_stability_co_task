import { create } from 'zustand'

export type NotificationType = 'new_job' | 'job_accepted' | 'job_confirmed' | 'message' | 'confirm_needed' | 'org_added' | 'org_removed' | 'subscription_changed'

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
  markRead:    (id: string) => void
  markAllRead: () => void
  clear:       () => void
}

/**
 * Cross-tab synchronisation via BroadcastChannel.
 *
 * When the user has the application open in multiple tabs (same origin,
 * same or different sessions), read/clear actions taken in one tab are
 * broadcast so that every other tab updates its local store without
 * requiring a round-trip to the server.
 *
 * Messages are typed so future channels can be added without collision.
 */
type SyncMessage =
  | { type: 'MARK_READ';     id: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'CLEAR' }

const CHANNEL_NAME = 'notification_sync'

// A single shared channel instance — created once, never recreated.
const syncChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(CHANNEL_NAME)
    : null

function postSync(msg: SyncMessage) {
  try { syncChannel?.postMessage(msg) } catch { /* tab may be closing */ }
}

export const useNotificationStore = create<NotificationState>((set) => {
  // Wire up the incoming cross-tab listener once, at store creation time.
  // We call the raw `set` directly so we don't need to hold a store reference.
  syncChannel?.addEventListener('message', (event: MessageEvent<SyncMessage>) => {
    const msg = event.data
    if (!msg?.type) return

    switch (msg.type) {
      case 'MARK_READ':
        set((s) => ({
          items: s.items.map((i) => i.id === msg.id ? { ...i, read: true } : i),
        }))
        break
      case 'MARK_ALL_READ':
        set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) }))
        break
      case 'CLEAR':
        set({ items: [] })
        break
    }
  })

  return {
    items: [],

    add: (n) =>
      set((s) => ({
        items: [
          { ...n, id: crypto.randomUUID(), at: new Date(), read: false },
          ...s.items,
        ].slice(0, 60), // keep max 60 entries
      })),

    markRead: (id) => {
      set((s) => ({
        items: s.items.map((i) => i.id === id ? { ...i, read: true } : i),
      }))
      postSync({ type: 'MARK_READ', id })
    },

    markAllRead: () => {
      set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) }))
      postSync({ type: 'MARK_ALL_READ' })
    },

    clear: () => {
      set({ items: [] })
      postSync({ type: 'CLEAR' })
    },
  }
})
