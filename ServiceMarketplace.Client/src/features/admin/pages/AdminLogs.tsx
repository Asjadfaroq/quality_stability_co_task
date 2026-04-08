import { useState, useMemo } from 'react'
import {
  Activity, ChevronDown, ChevronRight,
  Pause, Play, Search, Trash2, X, Zap,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import AppLayout from '../../../shared/components/AppLayout'
import { Button, Card, EmptyState, Skeleton } from '../../../shared/components/ui'
import { useLogsHub, type ConnectionState } from '../../../shared/hooks/useLogsHub'
import { timeAgo, formatDate } from '../../../shared/utils/format'
import api from '../../../shared/api/axios'
import type { LogEntry, LogCategory } from '../../../shared/types'

// ── Constants ─────────────────────────────────────────────────────────────────

type CategoryFilter = 'All' | LogCategory
type LevelFilter    = 'All' | 'Information' | 'Warning' | 'Error' | 'Fatal'

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'All',    label: 'All'    },
  { value: 'System', label: 'System' },
  { value: 'Audit',  label: 'Audit'  },
]

const LEVEL_FILTERS: { value: LevelFilter; label: string }[] = [
  { value: 'All',         label: 'All'     },
  { value: 'Information', label: 'Info'    },
  { value: 'Warning',     label: 'Warning' },
  { value: 'Error',       label: 'Error'   },
  { value: 'Fatal',       label: 'Fatal'   },
]

// ── Level styling ─────────────────────────────────────────────────────────────

function getLevelStyle(level: string): { badge: string; row: string } {
  switch (level.toLowerCase()) {
    case 'fatal':
      return { badge: 'bg-red-100 text-red-900 border-red-300',       row: 'bg-red-50/60' }
    case 'error':
      return { badge: 'bg-red-50 text-red-700 border-red-200',        row: 'bg-red-50/30' }
    case 'warning':
      return { badge: 'bg-amber-50 text-amber-700 border-amber-200',  row: ''             }
    case 'information':
      return { badge: 'bg-sky-50 text-sky-700 border-sky-200',        row: ''             }
    case 'debug':
      return { badge: 'bg-slate-100 text-slate-500 border-slate-200', row: 'opacity-70'   }
    case 'verbose':
      return { badge: 'bg-slate-50 text-slate-400 border-slate-200',  row: 'opacity-50'   }
    default:
      return { badge: 'bg-gray-100 text-gray-600 border-gray-200',    row: ''             }
  }
}

function getCategoryStyle(category: LogCategory): string {
  return category === 'Audit'
    ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
    : 'bg-slate-100 text-slate-500 border-slate-200'
}

// ── Connection indicator ──────────────────────────────────────────────────────

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === 'connected') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    )
  }
  if (state === 'reconnecting') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <span className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        Reconnecting
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
      <span className="w-2 h-2 rounded-full bg-slate-300" />
      Disconnected
    </span>
  )
}

// ── Expandable exception row ──────────────────────────────────────────────────

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const level = getLevelStyle(entry.level)
  const hasException = !!entry.exception
  const label = entry.level === 'Information' ? 'Info' : entry.level

  return (
    <>
      <tr
        className={`border-b border-slate-100 transition-colors hover:bg-slate-50/70 ${level.row}`}
        onClick={() => hasException && setExpanded((v) => !v)}
        style={{ cursor: hasException ? 'pointer' : 'default' }}
      >
        {/* Expand toggle */}
        <td className="pl-4 pr-1 py-2.5 w-6">
          {hasException ? (
            <span className="text-slate-400">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <span className="w-4 inline-block" />
          )}
        </td>

        {/* Timestamp */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span
            className="text-[11px] text-slate-500 font-mono"
            title={formatDate(entry.timestamp)}
          >
            {timeAgo(entry.timestamp)}
          </span>
        </td>

        {/* Level */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${level.badge}`}>
            {label.toUpperCase()}
          </span>
        </td>

        {/* Category */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getCategoryStyle(entry.category)}`}>
            {entry.category.toUpperCase()}
          </span>
        </td>

        {/* Action / Source */}
        <td className="px-3 py-2.5 whitespace-nowrap max-w-[140px]">
          <span className="text-[11px] font-medium text-slate-700 truncate block">
            {entry.action ?? entry.sourceContext?.split('.').pop() ?? '—'}
          </span>
        </td>

        {/* Message */}
        <td className="px-3 py-2.5">
          <span className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
            {entry.message}
          </span>
        </td>

        {/* Actor */}
        <td className="px-3 py-2.5 whitespace-nowrap hidden xl:table-cell">
          {entry.actorUserId ? (
            <span
              className="text-[10px] font-mono text-indigo-500 truncate block max-w-[90px]"
              title={entry.actorUserId}
            >
              {entry.actorUserId.slice(0, 8)}…
            </span>
          ) : (
            <span className="text-[10px] text-slate-300">—</span>
          )}
        </td>
      </tr>

      {/* Exception detail row */}
      {expanded && entry.exception && (
        <tr className="bg-red-50/50 border-b border-red-100">
          <td colSpan={7} className="px-10 py-3">
            <pre className="text-[10px] text-red-700 font-mono whitespace-pre-wrap break-all leading-relaxed overflow-x-auto max-h-48">
              {entry.exception}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

function LogMobileCard({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const level = getLevelStyle(entry.level)
  const hasException = !!entry.exception
  const label = entry.level === 'Information' ? 'Info' : entry.level

  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${level.row}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 font-mono" title={formatDate(entry.timestamp)}>
          {timeAgo(entry.timestamp)}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${level.badge}`}>
            {label.toUpperCase()}
          </span>
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getCategoryStyle(entry.category)}`}>
            {entry.category.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="mt-2">
        <p className="text-xs text-slate-500">Action / Source</p>
        <p className="text-xs font-medium text-slate-700 break-words">
          {entry.action ?? entry.sourceContext?.split('.').pop() ?? '—'}
        </p>
      </div>

      <div className="mt-2">
        <p className="text-xs text-slate-500">Message</p>
        <p className="text-sm text-slate-700 leading-relaxed break-words">{entry.message}</p>
      </div>

      {entry.actorUserId && (
        <div className="mt-2">
          <p className="text-xs text-slate-500">Actor</p>
          <p className="text-[11px] font-mono text-indigo-500 break-all">{entry.actorUserId}</p>
        </div>
      )}

      {hasException && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {expanded ? 'Hide exception' : 'Show exception'}
        </button>
      )}

      {expanded && entry.exception && (
        <pre className="mt-2 text-[10px] text-red-700 font-mono whitespace-pre-wrap break-all leading-relaxed overflow-x-auto max-h-48 bg-red-50 border border-red-100 rounded-lg p-2.5">
          {entry.exception}
        </pre>
      )}
    </div>
  )
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          <td className="pl-4 pr-1 py-2.5 w-6" />
          <td className="px-3 py-2.5"><Skeleton className="h-3 w-16" /></td>
          <td className="px-3 py-2.5"><Skeleton className="h-4 w-10 rounded" /></td>
          <td className="px-3 py-2.5"><Skeleton className="h-4 w-12 rounded" /></td>
          <td className="px-3 py-2.5"><Skeleton className="h-3 w-24" /></td>
          <td className="px-3 py-2.5"><Skeleton className="h-3 w-56" /></td>
          <td className="px-3 py-2.5 hidden xl:table-cell"><Skeleton className="h-3 w-16" /></td>
        </tr>
      ))}
    </>
  )
}

// ── AdminLogs ─────────────────────────────────────────────────────────────────

export default function AdminLogs() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [levelFilter,    setLevelFilter]    = useState<LevelFilter>('All')
  const [search,         setSearch]         = useState('')

  const {
    entries,
    connectionState,
    isPaused,
    pauseQueueSize,
    togglePause,
    clear,
  } = useLogsHub({
    hubPath:      '/hubs/admin-logs',
    historyEvent: 'RecentLogs',
    liveEvent:    'LogEntry',
  })

  // REST fallback — seeds the view when SignalR hasn't connected yet.
  // Once SignalR fires 'RecentLogs' it replaces these entries in the reducer.
  const { isLoading: isRestLoading } = useQuery<LogEntry[]>({
    queryKey: ['admin-logs-seed'],
    queryFn:  () => api.get('/admin/logs', { params: { count: 200 } }).then(r => r.data),
    enabled:  connectionState !== 'connected' && entries.length === 0,
    staleTime: Infinity,
  })

  const isLoading = isRestLoading && entries.length === 0

  // ── Client-side filtering (all filtering is local — no round-trips) ───────

  const filtered = useMemo(() => {
    let list = entries

    if (categoryFilter !== 'All')
      list = list.filter(e => e.category === categoryFilter)

    if (levelFilter !== 'All') {
      const lvl = levelFilter.toLowerCase()
      list = list.filter(e => e.level.toLowerCase() === lvl)
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase()
      list = list.filter(e =>
        e.message.toLowerCase().includes(term) ||
        (e.action?.toLowerCase().includes(term)) ||
        (e.sourceContext?.toLowerCase().includes(term)) ||
        (e.actorUserId?.toLowerCase().includes(term)),
      )
    }

    return list
  }, [entries, categoryFilter, levelFilter, search])

  const counts = useMemo(() => ({
    system: entries.filter(e => e.category === 'System').length,
    audit:  entries.filter(e => e.category === 'Audit').length,
    error:  entries.filter(e => ['error', 'fatal'].includes(e.level.toLowerCase())).length,
  }), [entries])

  return (
    <AppLayout title="System Logs">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">System Logs</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time stream of system events and user audit activity.
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <Stat label="Total" value={entries.length} color="#6366f1" />
          <Stat label="System" value={counts.system} color="#64748b" />
          <Stat label="Audit" value={counts.audit} color="#6366f1" />
          {counts.error > 0 && <Stat label="Errors" value={counts.error} color="#ef4444" />}
        </div>
      </div>

      <Card padding={false}>
        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 border-b border-slate-100">

          {/* Category pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0 overflow-x-auto max-w-full">
            {CATEGORY_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setCategoryFilter(f.value)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={
                  categoryFilter === f.value
                    ? { background: '#fff', color: '#0f172a', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                    : { color: '#64748b' }
                }
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Level pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {LEVEL_FILTERS.map(f => {
              const active = levelFilter === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => setLevelFilter(f.value)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                  style={
                    active
                      ? { background: '#6366f1', color: '#fff', borderColor: '#6366f1' }
                      : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }
                  }
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-full sm:w-52">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search messages…"
              className="w-full pl-7 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Connection + controls */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <ConnectionBadge state={connectionState} />

            {isPaused && pauseQueueSize > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-indigo-600 bg-indigo-50 border border-indigo-200">
                +{pauseQueueSize}
              </span>
            )}

            <Button
              variant={isPaused ? 'primary' : 'secondary'}
              size="sm"
              icon={isPaused ? <Play size={12} /> : <Pause size={12} />}
              onClick={togglePause}
              title={isPaused ? 'Resume live stream' : 'Pause live stream'}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>

            <button
              onClick={clear}
              title="Clear log view"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* ── Result count ── */}
        {!isLoading && (
          <div className="px-4 py-2 border-b border-slate-50 bg-slate-50/50">
            <p className="text-[11px] text-slate-400">
              Showing <strong className="text-slate-600">{filtered.length}</strong> of{' '}
              <strong className="text-slate-600">{entries.length}</strong> entries
              {isPaused && <span className="ml-2 text-amber-500 font-medium">· Stream paused</span>}
            </p>
          </div>
        )}

        {/* ── Mobile cards ── */}
        <div className="sm:hidden p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-4 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-10/12" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={<Activity size={28} className="text-slate-300" />}
                title="No log entries"
                description={
                  entries.length > 0
                    ? 'No entries match your current filters.'
                    : 'Waiting for log entries from the server…'
                }
              />
            </div>
          ) : (
            filtered.map((entry, i) => (
              <LogMobileCard key={`${entry.timestamp}-${i}`} entry={entry} />
            ))
          )}
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pl-4 pr-1 py-2.5 w-6" />
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Time</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Level</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Category</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Action / Source</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Message</th>
                <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hidden xl:table-cell">Actor</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <EmptyState
                      icon={<Activity size={28} className="text-slate-300" />}
                      title="No log entries"
                      description={
                        entries.length > 0
                          ? 'No entries match your current filters.'
                          : 'Waiting for log entries from the server…'
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((entry, i) => (
                  <LogRow key={`${entry.timestamp}-${i}`} entry={entry} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              Showing last {filtered.length} entries · Click a row with an exception to expand it
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Zap size={11} />
              Real-time via SignalR · REST seed on disconnect
            </div>
          </div>
        )}
      </Card>
    </AppLayout>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-xs font-bold text-slate-800">{value}</span>
    </div>
  )
}
