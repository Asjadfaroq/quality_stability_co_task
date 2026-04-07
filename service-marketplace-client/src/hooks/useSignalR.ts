import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '../store/authStore'

const HUB_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5132/api')
  .replace('/api', '/hubs/notifications')

type EventHandlers = Record<string, (...args: any[]) => void>

/**
 * Connects to the SignalR hub and subscribes to events.
 *
 * Uses a stable-ref pattern: each registered listener is a thin wrapper that
 * always calls the LATEST version of the handler from `handlersRef`. This
 * means the connection is created only once (when the token appears) but
 * always calls up-to-date closures — no stale captures.
 */
export function useSignalR(handlers: EventHandlers) {
  const token       = useAuthStore((s) => s.token)
  const handlersRef = useRef<EventHandlers>(handlers)
  const connectionRef = useRef<signalR.HubConnection | null>(null)

  // Keep handlersRef current on every render so wrappers below always call
  // the latest handler without recreating the SignalR connection.
  handlersRef.current = handlers

  useEffect(() => {
    if (!token) return

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    // Register a stable wrapper per event — the wrapper always reads the
    // current handler from handlersRef, avoiding stale closure issues.
    const registeredEvents = Object.keys(handlers)
    registeredEvents.forEach((event) => {
      connection.on(event, (...args: any[]) => {
        handlersRef.current[event]?.(...args)
      })
    })

    connection
      .start()
      .then(() => {
        console.debug('[SignalR] Connected to', HUB_URL)
      })
      .catch((err) => {
        console.error('[SignalR] Connection failed:', err)
      })

    connectionRef.current = connection

    // Log reconnection lifecycle so broken connections surface in devtools
    connection.onreconnecting((err) =>
      console.warn('[SignalR] Reconnecting…', err))
    connection.onreconnected((id) =>
      console.debug('[SignalR] Reconnected, connectionId:', id))
    connection.onclose((err) =>
      err && console.error('[SignalR] Connection closed with error:', err))

    return () => {
      connection.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return connectionRef
}
