import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '../store/authStore'

const HUB_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5132/api')
  .replace('/api', '/hubs/notifications')

type EventHandlers = Record<string, (...args: any[]) => void>

export function useSignalR(handlers: EventHandlers) {
  const token = useAuthStore((s) => s.token)
  const connectionRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    if (!token) return

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    Object.entries(handlers).forEach(([event, handler]) => {
      connection.on(event, handler)
    })

    connection.start().catch((err) =>
      console.error('SignalR connection error:', err)
    )

    connectionRef.current = connection

    return () => {
      connection.stop()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return connectionRef
}
