import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Plus, MessageSquare, ClipboardList,
  Zap, CheckCircle2, ArrowRight, Map, List,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUnreadStore } from '../../store/unreadStore'
import { isRateLimited } from '../../api/axios'
import api from '../../api/axios'
import { formatDate } from '../../utils/format'
import { StatusBadge } from '../../utils/status'
import { ROUTES } from '../../constants/routes'
import AppLayout from '../../components/AppLayout'
import ChatPanel from '../../components/ChatPanel'
import JobsMap from '../../components/JobsMap'
import { NewRequestModal } from './components/NewRequestModal'
import {
  Button, Card,
  EmptyState, SkeletonCard, Pagination,
} from '../../components/ui'
import type { PagedResult, ServiceRequest, MapJobDto } from '../../types'

// ── Main page ─────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 10

type ViewMode = 'list' | 'map'

export default function CustomerRequests() {
  const queryClient = useQueryClient()
  const { email }   = useAuthStore()
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(DEFAULT_PAGE_SIZE)
  const [showModal, setShowModal]     = useState(false)
  const [activeChat, setActiveChat]   = useState<{ id: string; title: string } | null>(null)
  const [viewMode, setViewMode]       = useState<ViewMode>('list')
  const unreadCounts = useUnreadStore((s) => s.counts)
  const clearUnread  = useUnreadStore((s) => s.clear)

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/requests/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast.success('Job confirmed as complete!')
    },
    onError: (err: unknown) => {
      if (isRateLimited(err)) return
      toast.error('Failed to confirm completion.')
    },
  })

  const { data, isLoading } = useQuery<PagedResult<ServiceRequest>>({
    queryKey: ['requests', page, pageSize],
    queryFn: () => api.get('/requests', { params: { page, pageSize } }).then((r) => r.data),
    placeholderData: (prev) => prev,
    enabled: viewMode === 'list',
  })

  const { data: mapJobs, isLoading: mapLoading } = useQuery<MapJobDto[]>({
    queryKey: ['requests-map-customer'],
    queryFn: () => api.get('/requests/map').then((r) => r.data),
    enabled: viewMode === 'map',
    staleTime: 60_000,
  })

  const requests   = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  return (
    <>
      <AppLayout title="My Requests">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">My Requests</h2>
            <p className="text-sm text-slate-500 mt-0.5">Welcome back, {email?.split('@')[0]}</p>
          </div>
          {/* View mode toggle — right-aligned */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors ${
                viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <List size={13} /> List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors ${
                viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Map size={13} /> Map
            </button>
          </div>
        </div>

        {/* ── Map view ──────────────────────────────────────────────────────── */}
        {viewMode === 'map' && (
          <Card className="p-4 mb-6">
            <p className="text-xs text-slate-500 mb-3">
              Showing all your requests on the map. Click a marker for details.
            </p>
            <JobsMap jobs={mapJobs ?? []} loading={mapLoading} height="h-[480px]" />
          </Card>
        )}

        {/* Subscription banner */}
        <div
          className="mb-5 rounded-2xl flex items-center justify-between gap-4 px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5498 55%, #3b6fd4 100%)',
            boxShadow: '0 4px 20px rgba(30,58,95,0.22)',
          }}
        >
          <div className="flex items-center gap-4 min-w-0">
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <Zap size={18} style={{ color: '#93c5fd' }} />
            </div>

            {/* Text */}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white leading-tight">
                Unlock unlimited service requests
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {['Unlimited requests', 'Priority matching', 'Dedicated support'].map((f) => (
                  <span key={f} className="flex items-center gap-1">
                    <CheckCircle2 size={11} style={{ color: '#86efac', flexShrink: 0 }} />
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>{f}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <Link
            to={ROUTES.CUSTOMER_SUBSCRIPTION}
            className="flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2 text-[12.5px] font-semibold transition-opacity hover:opacity-90"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
              backdropFilter: 'blur(4px)',
              whiteSpace: 'nowrap',
            }}
          >
            Upgrade Plan
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* Requests list */}
        <Card padding={false}>
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-slate-900">All Requests</h3>
              <span className="text-xs text-slate-400">{totalCount} total</span>
            </div>
            <Button icon={<Plus size={15} />} size="sm" onClick={() => setShowModal(true)}>
              New Request
            </Button>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">{[1,2,3].map((i) => <SkeletonCard key={i} />)}</div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={24} />}
              title="No requests yet"
              description="Submit your first service request to get started."
              action={<Button icon={<Plus size={15} />} size="sm" onClick={() => setShowModal(true)}>New Request</Button>}
            />
          ) : (
            <>
              {/* Column headers */}
              <div className="px-6 py-2.5 grid grid-cols-[1fr_auto] gap-4 bg-slate-50 border-b border-slate-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Request / Category</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status / Actions</span>
              </div>

            <ul className="divide-y divide-slate-100">
              {requests.map((req) => (
                <li key={req.id} className={`px-6 py-4 transition-colors ${req.status === 'PendingConfirmation' ? 'bg-orange-50/50' : 'hover:bg-slate-50/50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {req.category} · {formatDate(req.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(req.status === 'Accepted' || req.status === 'PendingConfirmation') && (
                        <button
                          type="button"
                          onClick={() => { setActiveChat({ id: req.id, title: req.title }); clearUnread(req.id) }}
                          className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
                        >
                          <MessageSquare size={13} />
                          Chat
                          {(unreadCounts[req.id] ?? 0) > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {unreadCounts[req.id] > 9 ? '9+' : unreadCounts[req.id]}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {req.status === 'PendingConfirmation' && (
                    <div className="mt-3 flex items-center justify-between bg-white border border-orange-200 rounded-lg px-4 py-3">
                      <p className="text-xs text-orange-700 font-medium">The provider has marked this job as complete — please confirm.</p>
                      <Button variant="success" size="sm" loading={confirmMutation.isPending} onClick={() => confirmMutation.mutate(req.id)} className="ml-4 shrink-0">
                        Confirm Complete
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setPage}
              pageSizeOptions={[5, 10, 20, 50]}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            />
            </>
          )}
        </Card>
      </AppLayout>

      <NewRequestModal open={showModal} onClose={() => setShowModal(false)} />

      {activeChat && (
        <ChatPanel requestId={activeChat.id} requestTitle={activeChat.title} onClose={() => setActiveChat(null)} />
      )}
    </>
  )
}
