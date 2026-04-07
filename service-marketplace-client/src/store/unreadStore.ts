import { create } from 'zustand'

interface UnreadState {
  counts: Record<string, number>
  add:    (requestId: string) => void
  clear:  (requestId: string) => void
}

export const useUnreadStore = create<UnreadState>((set) => ({
  counts: {},

  add: (requestId) =>
    set((s) => ({
      counts: { ...s.counts, [requestId]: (s.counts[requestId] ?? 0) + 1 },
    })),

  clear: (requestId) =>
    set((s) => {
      const next = { ...s.counts }
      delete next[requestId]
      return { counts: next }
    }),
}))
