import { useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import api, { isRateLimited } from '../api/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id:      string
  role:    ChatRole
  content: string
}

export interface UseAiChatReturn {
  messages:     ChatMessage[]
  sending:      boolean
  send:         (text: string) => Promise<void>
  clearHistory: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// Maximum number of past turns sent to the backend to avoid unbounded context growth.
const MAX_HISTORY_TURNS = 10

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAiChat(): UseAiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending]   = useState(false)

  // Keep a ref so the send callback always has the latest messages without
  // needing to be re-created (avoids stale closure issues).
  const messagesRef = useRef<ChatMessage[]>(messages)
  messagesRef.current = messages

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    // Append the user's message immediately for snappy UX
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    try {
      // Build history payload from the last N turns (excluding the message we
      // just added, which is sent separately as the current `message` field).
      const history = messagesRef.current
        .slice(-MAX_HISTORY_TURNS)
        .map(({ role, content }) => ({ role, content }))

      const { data } = await api.post<{ reply: string }>('/ai/chat', {
        message: trimmed,
        history,
      })

      const assistantMsg: ChatMessage = {
        id:      uid(),
        role:    'assistant',
        content: data.reply,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      if (!isRateLimited(err)) toast.error('Failed to get a response. Please try again.')
      // Remove the optimistic user message so the user can retry
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
    } finally {
      setSending(false)
    }
  }, [sending])

  const clearHistory = useCallback(() => setMessages([]), [])

  return { messages, sending, send, clearHistory }
}
