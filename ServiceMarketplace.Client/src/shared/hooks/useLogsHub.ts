import { useEffect, useReducer, useRef, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '../store/authStore'
import type { LogEntry } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

interface State {
  entries: LogEntry[]
  connectionState: ConnectionState
  isPaused: boolean
  /** Entries buffered while paused — newest first, flushed on resume. */
  pauseQueue: LogEntry[]
}

type Action =
  | { type: 'SET_HISTORY';    entries: LogEntry[] }
  | { type: 'ADD_ENTRY';      entry: LogEntry }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'CLEAR' }
  | { type: 'SET_CONNECTION'; state: ConnectionState }

const MAX_ENTRIES = 200

function logsReducer(state: State, action: Action): State {
  switch (action.type) {

    case 'SET_HISTORY':
      // Server sends entries oldest-first; reverse so newest appears at index 0.
      return {
        ...state,
        entries:    [...action.entries].reverse().slice(0, MAX_ENTRIES),
        pauseQueue: [],
      }

    case 'ADD_ENTRY': {
      if (state.isPaused) {
        // Buffer while paused without mutating the visible list.
        const queue = [action.entry, ...state.pauseQueue].slice(0, MAX_ENTRIES)
        return { ...state, pauseQueue: queue }
      }
      const next = [action.entry, ...state.entries].slice(0, MAX_ENTRIES)
      return { ...state, entries: next }
    }

    case 'TOGGLE_PAUSE': {
      if (state.isPaused) {
        // Flush queue into display list (queued entries are already newest-first).
        const merged = [...state.pauseQueue, ...state.entries].slice(0, MAX_ENTRIES)
        return { ...state, isPaused: false, entries: merged, pauseQueue: [] }
      }
      return { ...state, isPaused: true }
    }

    case 'CLEAR':
      return { ...state, entries: [], pauseQueue: [] }

    case 'SET_CONNECTION':
      return { ...state, connectionState: action.state }

    default:
      return state
  }
}

// ── Hook options ──────────────────────────────────────────────────────────────

export interface UseLogsHubOptions {
  /** Hub path relative to base, e.g. "/hubs/admin-logs". */
  hubPath: string
  /** SignalR event that delivers initial history, e.g. "RecentLogs". */
  historyEvent: string
  /** SignalR event that delivers individual live entries, e.g. "LogEntry". */
  liveEvent: string
}

export interface UseLogsHubResult {
  entries: LogEntry[]
  connectionState: ConnectionState
  isPaused: boolean
  pauseQueueSize: number
  togglePause: () => void
  clear: () => void
}

// ── Normalization ─────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<number, LogCategory> = { 0: 'System', 1: 'Audit' }

/**
 * Guards against SignalR sending LogCategory as a numeric enum (0/1) when the
 * backend's SignalR JSON protocol isn't configured with JsonStringEnumConverter.
 * With the fix in place this is a no-op; without it the UI still works.
 */
function normalizeEntry(raw: unknown): LogEntry {
  const e = raw as LogEntry & { category: string | number }
  if (typeof e.category === 'number') {
    e.category = CATEGORY_MAP[e.category] ?? 'System'
  }
  return e as LogEntry
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5132/api')
  .replace('/api', '')

/**
 * Manages a dedicated SignalR hub connection for log streaming.
 * Supports pause/resume with an in-memory queue so fast log bursts
 * don't disrupt reading. The connection is torn down when the component unmounts.
 */
export function useLogsHub({
  hubPath,
  historyEvent,
  liveEvent,
}: UseLogsHubOptions): UseLogsHubResult {
  const token = useAuthStore((s) => s.token)

  const [state, dispatch] = useReducer(logsReducer, {
    entries:          [],
    connectionState:  'connecting',
    isPaused:         false,
    pauseQueue:       [],
  })

  // Keep latest dispatch stable across re-renders without re-creating the effect.
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  useEffect(() => {
    if (!token) return

    const hubUrl  = `${BASE_URL}${hubPath}`
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.None)
      .build()

    // History replay on (re)connect
    connection.on(historyEvent, (entries: unknown[]) => {
      dispatchRef.current({ type: 'SET_HISTORY', entries: entries.map(normalizeEntry) })
    })

    // Live entries
    connection.on(liveEvent, (entry: unknown) => {
      dispatchRef.current({ type: 'ADD_ENTRY', entry: normalizeEntry(entry) })
    })

    connection.onreconnecting(() => {
      dispatchRef.current({ type: 'SET_CONNECTION', state: 'reconnecting' })
    })

    connection.onreconnected(() => {
      dispatchRef.current({ type: 'SET_CONNECTION', state: 'connected' })
    })

    connection.onclose(() => {
      dispatchRef.current({ type: 'SET_CONNECTION', state: 'disconnected' })
    })

    let cancelled = false

    dispatchRef.current({ type: 'SET_CONNECTION', state: 'connecting' })

    connection
      .start()
      .then(() => {
        if (!cancelled)
          dispatchRef.current({ type: 'SET_CONNECTION', state: 'connected' })
      })
      .catch(() => {
        if (!cancelled)
          dispatchRef.current({ type: 'SET_CONNECTION', state: 'disconnected' })
      })

    return () => {
      cancelled = true
      connection.stop()
      dispatchRef.current({ type: 'SET_CONNECTION', state: 'disconnected' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hubPath, historyEvent, liveEvent])

  const togglePause = useCallback(() => dispatch({ type: 'TOGGLE_PAUSE' }), [])
  const clear       = useCallback(() => dispatch({ type: 'CLEAR' }),        [])

  return {
    entries:        state.entries,
    connectionState: state.connectionState,
    isPaused:       state.isPaused,
    pauseQueueSize: state.pauseQueue.length,
    togglePause,
    clear,
  }
}
