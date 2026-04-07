import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, MessageSquare, AlertCircle } from 'lucide-react'
import { isRateLimited } from '../../api/axios'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import ChatPanel from '../../components/ChatPanel'
import { Button, Badge, Card, EmptyState, SkeletonCard, Pagination } from '../../components/ui'
import { useUnreadStore } from '../../store/unreadStore'
import type { PagedResult, ServiceRequest } from '../../types'

function statusBadge(status: ServiceRequest['status']) {
  const map: Record<ServiceRequest['status'], { label: string; variant: string }> = {
    Pending:            { label: 'Pending',    variant: 'pending' },
    Accepted:           { label: 'Accepted',   variant: 'accepted' },
    PendingConfirmation:{ label: 'Confirming', variant: 'pendingconfirmation' },
    Completed:          { label: 'Completed',  variant: 'completed' },
  }
  const { label, variant } = map[status]
  return <Badge label={label} variant={variant as any} />
}

const DEFAULT_PAGE_SIZE = 10

export default function ActiveJobs() {
  const queryClient = useQueryClient()
  const [page, setPage]             = useState(1)
  const [pageSize, setPageSize]     = useState(DEFAULT_PAGE_SIZE)
  const [activeChat, setActiveChat] = useState<{ id: string; title: string } | null>(null)
  const unreadCounts = useUnreadStore((s) => s.counts)
  const clearUnread  = useUnreadStore((s) => s.clear)

  const { data, isLoading } = useQuery<PagedResult<ServiceRequest>>({
    queryKey: ['requests-active', page, pageSize],
    queryFn: () =>
      api.get('/requests', { params: { page, pageSize, statusFilter: 'Active' } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const allRequests = data?.items      ?? []
  const totalCount  = data?.totalCount ?? 0
  const totalPages  = data?.totalPages ?? 1

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/requests/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast.success('Marked as complete — awaiting customer confirmation.')
    },
    onError: (err: unknown) => {
      if (isRateLimited(err)) return
      toast.error('Failed to mark as complete.')
    },
  })

  // Server already filters to Accepted + PendingConfirmation only — no client-side filter needed.
  const active = allRequests

  return (
    <>
      <AppLayout title="Active Jobs">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Active Jobs</h2>
          <p className="text-sm text-slate-500 mt-0.5">Jobs you have accepted and are currently working on</p>
        </div>

        <Card padding={false}>
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">In Progress</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isLoading ? 'Loading…' : `${totalCount} active job${totalCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            {totalCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(59,130,246,0.08)', color: '#2563eb' }}
              >
                <Loader2 size={11} className="animate-spin" />
                {totalCount} ongoing
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : active.length === 0 ? (
            <EmptyState
              icon={<Loader2 size={22} />}
              title="No active jobs"
              description="Jobs you accept will appear here. Go to Available Jobs to browse and accept."
            />
          ) : (
            <>
              {/* Column headers */}
              <div className="px-6 py-2.5 grid grid-cols-[1fr_auto] gap-4 bg-slate-50 border-b border-slate-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Job / Details</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Actions</span>
              </div>

              <ul className="divide-y divide-slate-100">
                {active.map((req) => (
                  <li
                    key={req.id}
                    className={`px-6 py-4 transition-colors ${
                      req.status === 'PendingConfirmation' ? 'bg-orange-50/40' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-medium text-slate-800">{req.title}</p>
                          {statusBadge(req.status)}
                        </div>
                        <p className="text-xs text-slate-400 mb-1">
                          {req.category} · {new Date(req.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-slate-400 line-clamp-1">{req.description}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          icon={<MessageSquare size={13} />}
                          className="relative"
                          onClick={() => {
                            setActiveChat({ id: req.id, title: req.title })
                            clearUnread(req.id)
                          }}
                        >
                          Chat
                          {(unreadCounts[req.id] ?? 0) > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {unreadCounts[req.id] > 9 ? '9+' : unreadCounts[req.id]}
                            </span>
                          )}
                        </Button>

                        {req.status === 'Accepted' && (
                          <Button
                            variant="success" size="sm"
                            loading={completeMutation.isPending}
                            onClick={() => completeMutation.mutate(req.id)}
                          >
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Awaiting confirmation banner */}
                    {req.status === 'PendingConfirmation' && (
                      <div className="mt-3 flex items-center gap-2.5 bg-white border border-orange-200 rounded-lg px-4 py-2.5">
                        <AlertCircle size={14} className="text-orange-400 shrink-0" />
                        <p className="text-xs text-orange-700 font-medium">
                          Marked complete — waiting for the customer to confirm.
                        </p>
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
