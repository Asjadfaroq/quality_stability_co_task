import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ClipboardList, CheckCircle2, Loader2, Clock,
  ArrowRight, Plus,
} from 'lucide-react'
import { useAuthStore } from '../../../shared/store/authStore'
import { useUnreadStore } from '../../../shared/store/unreadStore'
import api from '../../../shared/api/axios'
import { formatDate } from '../../../shared/utils/format'
import { isRequestChatOpen } from '../../../shared/utils/requestChat'
import { StatusBadge } from '../../../shared/utils/status'
import { ROUTES } from '../../../shared/constants/routes'
import AppLayout from '../../../shared/components/AppLayout'
import ChatPanel from '../../../shared/components/ChatPanel'
import { RequestChatButton } from '../../../shared/components/RequestChatButton'
import { Button, StatsBar, SkeletonCard } from '../../../shared/components/ui'
import type { PagedResult, ServiceRequest, StatItem } from '../../../shared/types/index'

const RECENT_LIMIT = 5

export default function CustomerDashboard() {
  const { email } = useAuthStore()
  const unreadCounts = useUnreadStore((s) => s.counts)
  const clearUnread = useUnreadStore((s) => s.clear)
  const [activeChat, setActiveChat] = useState<{ id: string; title: string } | null>(null)

  const [totalQ, pendingQ, activeQ, completedQ, recentQ] = useQueries({
    queries: [
      {
        queryKey: ['requests', 'dashboard', 'total'],
        queryFn: () =>
          api.get<PagedResult<ServiceRequest>>('/requests', { params: { page: 1, pageSize: 1 } }).then((r) => r.data),
      },
      {
        queryKey: ['requests', 'dashboard', 'pending'],
        queryFn: () =>
          api
            .get<PagedResult<ServiceRequest>>('/requests', { params: { page: 1, pageSize: 1, statusFilter: 'Pending' } })
            .then((r) => r.data),
      },
      {
        queryKey: ['requests', 'dashboard', 'active'],
        queryFn: () =>
          api
            .get<PagedResult<ServiceRequest>>('/requests', { params: { page: 1, pageSize: 1, statusFilter: 'Active' } })
            .then((r) => r.data),
      },
      {
        queryKey: ['requests', 'dashboard', 'completed'],
        queryFn: () =>
          api
            .get<PagedResult<ServiceRequest>>('/requests', {
              params: { page: 1, pageSize: 1, statusFilter: 'Completed' },
            })
            .then((r) => r.data),
      },
      {
        queryKey: ['requests', 'dashboard', 'recent'],
        queryFn: () =>
          api
            .get<PagedResult<ServiceRequest>>('/requests', { params: { page: 1, pageSize: RECENT_LIMIT } })
            .then((r) => r.data),
      },
    ],
  })

  const isLoading = [totalQ, pendingQ, activeQ, completedQ, recentQ].some((q) => q.isPending)

  const stats: StatItem[] = useMemo(
    () => [
      {
        label: 'Total Requests',
        value: totalQ.data?.totalCount ?? 0,
        icon: <ClipboardList size={16} />,
        color: 'indigo',
      },
      {
        label: 'Pending',
        value: pendingQ.data?.totalCount ?? 0,
        icon: <Clock size={16} />,
        color: 'amber',
      },
      {
        label: 'Active',
        value: activeQ.data?.totalCount ?? 0,
        icon: <Loader2 size={16} />,
        color: 'sky',
      },
      {
        label: 'Completed',
        value: completedQ.data?.totalCount ?? 0,
        icon: <CheckCircle2 size={16} />,
        color: 'emerald',
      },
    ],
    [totalQ.data?.totalCount, pendingQ.data?.totalCount, activeQ.data?.totalCount, completedQ.data?.totalCount],
  )

  const recent = recentQ.data?.items ?? []

  return (
    <>
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Welcome back, {email?.split('@')[0]} 👋
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Here's an overview of your service requests
            </p>
          </div>
          <Link to={ROUTES.CUSTOMER_REQUESTS}>
            <Button icon={<Plus size={16} />}>New Request</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="h-[72px] bg-white rounded-xl border border-slate-200 animate-pulse mb-6" />
        ) : (
          <StatsBar items={stats} />
        )}

        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Requests</h3>
            <Link
              to={ROUTES.CUSTOMER_REQUESTS}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <ClipboardList size={28} className="text-slate-200" />
              <p className="text-sm text-slate-500 font-medium">No requests yet</p>
              <p className="text-xs text-slate-400">Go to My Requests to submit your first one</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((req) => (
                <li
                  key={req.id}
                  className={`px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 transition-colors ${
                    req.status === 'PendingConfirmation' ? 'bg-orange-50/30' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {req.category} · {formatDate(req.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap sm:justify-end">
                    {isRequestChatOpen(req.status) && (
                      <RequestChatButton
                        compact
                        unreadCount={unreadCounts[req.id] ?? 0}
                        onClick={() => {
                          setActiveChat({ id: req.id, title: req.title })
                          clearUnread(req.id)
                        }}
                      />
                    )}
                    <StatusBadge status={req.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppLayout>

      {activeChat && (
        <ChatPanel
          requestId={activeChat.id}
          requestTitle={activeChat.title}
          onClose={() => setActiveChat(null)}
        />
      )}
    </>
  )
}
