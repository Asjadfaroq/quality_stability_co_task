import { useEffect, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'
import { useQuery } from '@tanstack/react-query'
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
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load chat history
  const { data: history = [] } = useQuery<Message[]>({
    queryKey: ['chat', requestId],
    queryFn: () => api.get(`/chat/${requestId}`).then((r) => r.data),
  })

  useEffect(() => {
    setMessages(history)
  }, [history])

  // Connect to hub and join chat room
  useEffect(() => {
    if (!token) return

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connection.on('ReceiveMessage', (msg: Message) => {
      setMessages((prev) => [...prev, msg])
    })

    connection.start().then(async () => {
      await connection.invoke('JoinRequestChat', requestId)
      setConnected(true)
    }).catch(console.error)

    connectionRef.current = connection

    return () => {
      connection.invoke('LeaveRequestChat', requestId).catch(() => {})
      connection.stop()
    }
  }, [requestId, token])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || !connectionRef.current || !connected) return
    await connectionRef.current.invoke('SendMessage', requestId, input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm flex flex-col pointer-events-auto"
           style={{ height: '500px' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-blue-600 rounded-t-xl">
          <div>
            <p className="text-white font-medium text-sm">Chat</p>
            <p className="text-blue-200 text-xs truncate max-w-[200px]">{requestTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-400'}`} />
            <button onClick={onClose} className="text-white hover:text-blue-200 text-lg leading-none">×</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 ? (
            <p className="text-gray-400 text-xs text-center mt-8">No messages yet. Say hello!</p>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === userId
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-400 mb-0.5">
                    {isMe ? 'You' : msg.senderEmail}
                  </span>
                  <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] break-words ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-xs text-gray-300 mt-0.5">
                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!connected}
          />
          <button
            onClick={sendMessage}
            disabled={!connected || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50 transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
