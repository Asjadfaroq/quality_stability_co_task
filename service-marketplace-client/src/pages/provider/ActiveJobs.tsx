import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, MessageSquare, AlertCircle } from 'lucide-react'
import { useSignalR } from '../../hooks/useSignalR'
import { isRateLimited } from '../../api/axios'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import ChatPanel from '../../components/ChatPanel'
import { Button, Badge, Card, EmptyState, SkeletonCard } from '../../components/ui'
import type { ServiceRequest } from '../../types'

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

export default function ActiveJobs() {
  const queryClient = useQueryClient()
  const [activeChat, setActiveChat] = useState<{ id: string; title: string } | null>(null)
  const [unread, setUnread]         = useState<Record<string, number>>({})
  const activeChatRef = useRef<string | null>(null)
  activeChatRef.current = activeChat?.id ?? null

  useSignalR({
    RequestConfirmed: (data: { requestId: string; title: string }) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast.success(`"${data.title}" confirmed complete!`)
    },
    NewMessageNotification: (data: { requestId: string; senderEmail: string }) => {
      const rid = String(data.requestId)
      if (activeChatRef.current === rid) return
      setUnread((p) => ({ ...p, [rid]: (p[rid] ?? 0) + 1 }))
      toast(`${data.senderEmail} sent you a message`, { icon: '💬', duration: 4000 })
    },
  })

  const { data: allRequests = [], isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ['requests'],
    queryFn: () => api.get('/requests').then((r) => r.data),
  })

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

  const active = allRequests.filter(
    (r) => r.status === 'Accepted' || r.status === 'PendingConfirmation',
  )

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
                {isLoading ? 'Loading…' : `${active.length} active job${active.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {active.length > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(59,130,246,0.08)', color: '#2563eb' }}
              >
                <Loader2 size={11} className="animate-spin" />
                {active.length} ongoing
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
                            setUnread((p) => ({ ...p, [req.id]: 0 }))
                          }}
                        >
                          Chat
                          {(unread[req.id] ?? 0) > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {unread[req.id] > 9 ? '9+' : unread[req.id]}
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
