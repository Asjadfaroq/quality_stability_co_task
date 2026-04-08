import { useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import api, { isRateLimited } from '../api/axios'

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

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// Limit history sent to backend.
const MAX_HISTORY_TURNS = 10

export function useAiChat(): UseAiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending]   = useState(false)

  // Keep latest messages for send callback.
  const messagesRef = useRef<ChatMessage[]>(messages)
  messagesRef.current = messages

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    // Optimistic user message.
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    try {
      // Send last N turns as chat history.
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
