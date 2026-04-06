import { useEffect, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, Send, Wifi, WifiOff, MessageSquare } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'

interface Message {
  id: string
  senderId: string
  senderEmail: string
  content: string
  sentAt: string
}

interface Props {
  requestId: string
  requestTitle: string
  onClose: () => void
}

const HUB_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5132/api')
  .replace('/api', '/hubs/notifications')

export default function ChatPanel({ requestId, requestTitle, onClose }: Props) {
  const { userId, token } = useAuthStore()
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [connected, setConnected] = useState(false)
  const [sending, setSending]     = useState(false)
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)
  const inputRef      = useRef<HTMLTextAreaElement>(null)

  const { data: history = [] } = useQuery<Message[]>({
    queryKey: ['chat', requestId],
    queryFn:  () => api.get(`/chat/${requestId}`).then((r) => r.data),
  })

  useEffect(() => { setMessages(history) }, [history])

  useEffect(() => {
    if (!token) return

    // Prevents React StrictMode's double-mount from firing the error toast.
    let cancelled = false

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connection.on('ReceiveMessage', (msg: Message) => {
      setMessages((prev) => [...prev, msg])
    })

    connection.on('ChatError', (error: string) => {
      toast.error(error)
    })

    connection.start().then(async () => {
      if (cancelled) return
      await connection.invoke('JoinRequestChat', requestId)
      setConnected(true)
    }).catch(() => {
      if (!cancelled) toast.error('Failed to connect to chat. Please refresh.')
    })

    connectionRef.current = connection

    return () => {
      cancelled = true
      connection.invoke('LeaveRequestChat', requestId).catch(() => {})
      connection.stop()
    }
  }, [requestId, token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !connectionRef.current || !connected || sending) return
    setSending(true)
    setInput('')
    try {
      await connectionRef.current.invoke('SendMessage', requestId, text)
    } catch {
      setInput(text)
      toast.error('Failed to send message. Please try again.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Group consecutive messages from same sender
  const grouped = messages.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || messages[i - 1].senderId !== msg.senderId,
    isLast:  i === messages.length - 1 || messages[i + 1].senderId !== msg.senderId,
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm flex flex-col pointer-events-auto overflow-hidden"
        style={{ height: '520px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <MessageSquare size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">Chat</p>
              <p className="text-blue-200 text-xs truncate">{requestTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              {connected
                ? <Wifi size={13} className="text-green-300" />
                : <WifiOff size={13} className="text-gray-400 animate-pulse" />
              }
              <span className="text-xs text-blue-200">{connected ? 'Live' : 'Connecting...'}</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 bg-gray-50">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <MessageSquare size={20} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No messages yet</p>
              <p className="text-xs text-gray-400 mt-1">Start the conversation below</p>
            </div>
          ) : (
            grouped.map((msg) => {
              const isMe = msg.senderId === userId
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${msg.isFirst ? 'mt-3' : 'mt-0.5'}`}
                >
                  {msg.isFirst && (
                    <span className="text-[11px] text-gray-400 mb-1 px-1">
                      {isMe ? 'You' : msg.senderEmail}
                    </span>
                  )}

                  <div className={`
                    px-3.5 py-2 text-sm max-w-[82%] break-words leading-relaxed
                    ${isMe
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                    }
                    ${isMe
                      ? msg.isFirst && msg.isLast ? 'rounded-2xl rounded-br-md'
                        : msg.isFirst ? 'rounded-2xl rounded-br-sm'
                        : msg.isLast  ? 'rounded-2xl rounded-tr-sm rounded-br-md'
                        : 'rounded-2xl rounded-r-sm'
                      : msg.isFirst && msg.isLast ? 'rounded-2xl rounded-bl-md'
                        : msg.isFirst ? 'rounded-2xl rounded-bl-sm'
                        : msg.isLast  ? 'rounded-2xl rounded-tl-sm rounded-bl-md'
                        : 'rounded-2xl rounded-l-sm'
                    }
                  `}>
                    {msg.content}
                  </div>

                  {msg.isLast && (
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-3 py-3 bg-white shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? 'Type a message…' : 'Connecting…'}
              rows={1}
              disabled={!connected}
              className="
                flex-1 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm
                text-gray-900 placeholder:text-gray-400 resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:bg-gray-50 disabled:text-gray-400
                transition-shadow max-h-28 overflow-y-auto
              "
              style={{ lineHeight: '1.5' }}
            />
            <button
              onClick={sendMessage}
              disabled={!connected || !input.trim() || sending}
              className="
                w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700
                flex items-center justify-center shrink-0
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              <Send size={15} className="text-white" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 pl-1">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}
