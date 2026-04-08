import {
  Briefcase, Building2, CheckCircle2, CreditCard,
  KeyRound, LogIn, ShieldCheck, UserCheck,
  UserMinus, UserPlus, UserX, Zap,
} from 'lucide-react'

import AppLayout from '../../../shared/components/AppLayout'
import { Card, EmptyState, Skeleton } from '../../../shared/components/ui'
import { useLogsHub, type ConnectionState } from '../../../shared/hooks/useLogsHub'
import { timeAgo, formatDate } from '../../../shared/utils/format'
import type { LogEntry } from '../../../shared/types'

// ── Action metadata ───────────────────────────────────────────────────────────

interface ActionMeta {
  icon:  React.ReactNode
  color: string
  bg:    string
  label: string
}

function getActionMeta(action: string | null): ActionMeta {
  switch (action) {
    case 'UserRegistered':
      return { icon: <UserPlus size={15} />,    color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Account Created'          }
    case 'UserLoggedIn':
      return { icon: <LogIn size={15} />,        color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Signed In'                }
    case 'RequestCreated':
      return { icon: <Briefcase size={15} />,    color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  label: 'Request Created'          }
    case 'RequestAccepted':
      return { icon: <UserCheck size={15} />,    color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Request Accepted'         }
    case 'RequestMarkedComplete':
      return { icon: <CheckCircle2 size={15} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Marked Complete'          }
    case 'RequestConfirmed':
      return { icon: <CheckCircle2 size={15} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Completion Confirmed'     }
    case 'OrgCreated':
      return { icon: <Building2 size={15} />,    color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  label: 'Organisation Created'     }
    case 'OrgMemberAdded':
      return { icon: <UserPlus size={15} />,     color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Member Added'             }
    case 'OrgMemberRemoved':
      return { icon: <UserMinus size={15} />,    color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Member Removed'           }
    case 'AdminUserDeleted':
      return { icon: <UserX size={15} />,        color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'User Deleted'             }
    case 'AdminRoleUpdated':
      return { icon: <ShieldCheck size={15} />,  color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  label: 'Role Updated'             }
    case 'AdminSubscriptionUpdated':
      return { icon: <CreditCard size={15} />,   color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Subscription Updated'     }
    case 'AdminPermissionUpdated':
      return { icon: <KeyRound size={15} />,     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Permission Updated'       }
    default:
      return { icon: <Zap size={15} />,          color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: action ?? 'Activity'       }
  }
}

// ── Connection badge ──────────────────────────────────────────────────────────

function ConnectionBadge({ state }: { state: ConnectionState }) {
  if (state === 'connected')
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    )
  if (state === 'reconnecting')
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <span className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        Reconnecting
      </span>
    )
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
      <span className="w-2 h-2 rounded-full bg-slate-300" />
      Disconnected
    </span>
  )
}

// ── Single activity card ──────────────────────────────────────────────────────

function ActivityCard({ entry }: { entry: LogEntry }) {
  const meta = getActionMeta(entry.action)

  return (
    <div
      className="flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-50/60"
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: meta.bg, color: meta.color }}
      >
        {meta.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-800 leading-snug">{meta.label}</p>
          <span
            className="text-[11px] text-slate-400 shrink-0 mt-0.5 whitespace-nowrap"
            title={formatDate(entry.timestamp)}
          >
            {timeAgo(entry.timestamp)}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{entry.message}</p>
      </div>
    </div>
  )
}

// ── Skeleton cards ────────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4">
          <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Date separator ────────────────────────────────────────────────────────────

function dateBucket(iso: string): string {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 86_400_000) return 'Today'
  if (diff < 172_800_000) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── ActivityLog ───────────────────────────────────────────────────────────────

export default function ActivityLog() {
  const {
    entries,
    connectionState,
  } = useLogsHub({
    hubPath:      '/hubs/activity',
    historyEvent: 'RecentActivity',
    liveEvent:    'ActivityEntry',
  })

  const isLoading = connectionState === 'connecting' && entries.length === 0

  // Group entries by date bucket for the timeline separator
  const grouped = (() => {
    if (entries.length === 0) return []
    const buckets: { bucket: string; items: LogEntry[] }[] = []
    let currentBucket = ''

    for (const entry of entries) {
      const b = dateBucket(entry.timestamp)
      if (b !== currentBucket) {
        currentBucket = b
        buckets.push({ bucket: b, items: [] })
      }
      buckets[buckets.length - 1].items.push(entry)
    }
    return buckets
  })()

  return (
    <AppLayout title="My Activity">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900">My Activity</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            A real-time log of your important actions on the platform.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ConnectionBadge state={connectionState} />
          {entries.length > 0 && (
            <span className="text-xs text-slate-400">
              {entries.length} event{entries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <ActivitySkeleton />
        ) : entries.length === 0 ? (
          <div className="py-16">
            <EmptyState
              icon={<Zap size={28} className="text-slate-300" />}
              title="No activity yet"
              description="Your important actions will appear here in real-time."
            />
          </div>
        ) : (
          <div>
            {grouped.map(({ bucket, items }) => (
              <div key={bucket}>
                {/* Date separator */}
                <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    {bucket}
                  </p>
                </div>
                {items.map((entry, i) => (
                  <ActivityCard key={`${entry.timestamp}-${i}`} entry={entry} />
                ))}
              </div>
            ))}

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Zap size={11} />
                Live stream · last {entries.length} event{entries.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </Card>
    </AppLayout>
  )
}
