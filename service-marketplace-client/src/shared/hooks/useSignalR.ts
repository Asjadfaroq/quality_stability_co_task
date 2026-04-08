import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '../store/authStore'

const HUB_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5132/api')
  .replace('/api', '/hubs/notifications')

type EventHandler = { bivarianceHack(...args: unknown[]): void }['bivarianceHack']
type EventHandlers = Record<string, EventHandler>

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
      // Suppress SignalR's internal logger entirely — our lifecycle callbacks
      // (onreconnecting, onreconnected, onclose) handle all relevant events.
      // Without this, every intentional stop() during navigation or StrictMode
      // teardown prints a loud "Failed to start the connection" error.
      .configureLogging(signalR.LogLevel.None)
      .build()

    // Register a stable wrapper per event — the wrapper always reads the
    // current handler from handlersRef, avoiding stale closure issues.
    const registeredEvents = Object.keys(handlers)
    registeredEvents.forEach((event) => {
      connection.on(event, (...args: unknown[]) => {
        handlersRef.current[event]?.(...args)
      })
    })

    let cancelled = false

    connection
      .start()
      .then(() => {
        if (!cancelled) console.debug('[SignalR] Connected to', HUB_URL)
      })
      .catch((err) => {
        // When React StrictMode tears down the effect during negotiation,
        // stop() throws an AbortError — that's expected, not a real failure.
        if (!cancelled) console.error('[SignalR] Connection failed:', err)
      })

    connectionRef.current = connection

    // Log reconnection lifecycle so broken connections surface in devtools
    connection.onreconnecting((err) =>
      console.warn('[SignalR] Reconnecting…', err))
    connection.onreconnected((id) =>
      console.debug('[SignalR] Reconnected, connectionId:', id))
    connection.onclose((err) =>
      err && !cancelled && console.error('[SignalR] Connection closed with error:', err))

    return () => {
      cancelled = true
      connection.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return connectionRef
}
