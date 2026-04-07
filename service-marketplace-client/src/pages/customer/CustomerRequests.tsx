import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Plus, Sparkles, MessageSquare, ClipboardList,
  Clock, Loader2, X, Zap, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUnreadStore } from '../../store/unreadStore'
import { isRateLimited } from '../../api/axios'
import api from '../../api/axios'
import { useAiEnhance } from '../../hooks/useAiEnhance'
import AppLayout from '../../components/AppLayout'
import ChatPanel from '../../components/ChatPanel'
import {
  Button, Badge, Card,
  Input, Textarea, Select, EmptyState, SkeletonCard, Pagination,
} from '../../components/ui'
import type { PagedResult, ServiceRequest } from '../../types'

const schema = z.object({
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().min(10, 'Min 10 characters').max(2000),
  category:    z.string().min(1, 'Select a category'),
  latitude:    z.number({ error: 'Required' }).min(-90).max(90),
  longitude:   z.number({ error: 'Required' }).min(-180).max(180),
})

type FormData = z.infer<typeof schema>

const CATEGORIES = [
  'Plumbing','Electrical','Cleaning','Carpentry',
  'Painting','Moving','Gardening','IT Support','Other',
]

function statusBadge(status: ServiceRequest['status']) {
  const map: Record<ServiceRequest['status'], { label: string; variant: string }> = {
    Pending:            { label: 'Pending',               variant: 'pending' },
    Accepted:           { label: 'Accepted',              variant: 'accepted' },
    PendingConfirmation:{ label: 'Awaiting Confirmation',  variant: 'pendingconfirmation' },
    Completed:          { label: 'Completed',             variant: 'completed' },
  }
  const { label, variant } = map[status]
  return <Badge label={label} variant={variant as any} />
}

// ── New Request Modal ─────────────────────────────────────────────────────────

interface NewRequestModalProps {
  open: boolean
  onClose: () => void
}

function NewRequestModal({ open, onClose }: NewRequestModalProps) {
  const queryClient   = useQueryClient()
  const { enhancing, enhance } = useAiEnhance()
  const [freeLimitHit, setFreeLimitHit] = useState(false)
  const [visible, setVisible]           = useState(false)
  const { register, handleSubmit, setValue, watch, reset, setFocus, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: '' },
  })
  const title       = watch('title')
  const description = watch('description')

  // Drive enter/leave animation
  useEffect(() => {
    if (open) {
      setVisible(true)
      // slight delay so the entering animation plays after mount
      setTimeout(() => setFocus('title'), 120)
    } else {
      // let the leave animation finish before unmounting
      const t = setTimeout(() => setVisible(false), 250)
      return () => clearTimeout(t)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post('/requests', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setFreeLimitHit(false)
      handleClose()
      toast.success('Request submitted successfully!')
    },
    onError: (err: any) => {
      if (isRateLimited(err)) return
      if (err?.response?.status === 403) {
        // permission_denied → admin has revoked request.create from this role/user.
        // Any other 403 (e.g. free-tier limit) falls through to the in-form banner.
        if (err.response.data?.errorCode === 'permission_denied') {
          toast.error("You don't have permission to create requests. Contact your administrator.")
        } else {
          setFreeLimitHit(true)
        }
      }
    },
  })

  const handleClose = () => {
    reset()
    setFreeLimitHit(false)
    onClose()
  }

  const handleEnhance = async () => {
    if (!title || !description) return
    const data = await enhance(title, description)
    if (!data) return
    setValue('description', data.enhancedDescription)
    if (!watch('category')) setValue('category', data.suggestedCategory)
    toast.success('Description enhanced!')
  }

  if (!visible && !open) return null

  const isEntering = open && visible

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        transition: 'background 0.25s ease',
        background: isEntering ? 'rgba(15,23,42,0.45)' : 'rgba(15,23,42,0)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        style={{
          transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.2,0.64,1)',
          opacity:    isEntering ? 1 : 0,
          transform:  isEntering ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(12px)',
          width: '100%',
          maxWidth: 540,
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Modal header */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ borderBottom: '1px solid #F1F5F9' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.1)' }}
              >
                <Plus size={18} style={{ color: '#6366f1' }} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">New Service Request</h2>
                <p className="text-xs text-slate-400 mt-0.5">Describe your job and we'll match you with a provider</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal body */}
          <div className="px-6 py-5">
            {freeLimitHit && (
              <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl mb-5 text-sm text-amber-800">
                <Clock size={15} className="mt-0.5 shrink-0 text-amber-500" />
                Free tier limit reached. Upgrade your plan to create more requests.
              </div>
            )}

            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <Input
                label="Title"
                placeholder="e.g. Fix leaking kitchen pipe"
                error={errors.title?.message}
                {...register('title')}
              />

              <Textarea
                label="Description"
                placeholder="Describe the issue in detail (min 10 characters)"
                rows={4}
                error={errors.description?.message}
                actions={
                  <Button
                    type="button" variant="ghost" size="sm"
                    icon={enhancing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    onClick={handleEnhance}
                    disabled={enhancing || !title || !description}
                  >
                    {enhancing ? 'Enhancing...' : 'Enhance with AI'}
                  </Button>
                }
                {...register('description')}
              />

              <Select label="Category" error={errors.category?.message} {...register('category')}>
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Latitude"
                  type="number" step="any" placeholder="e.g. 51.5074"
                  error={errors.latitude?.message}
                  {...register('latitude', { valueAsNumber: true })}
                />
                <Input
                  label="Longitude"
                  type="number" step="any" placeholder="e.g. -0.1278"
                  error={errors.longitude?.message}
                  {...register('longitude', { valueAsNumber: true })}
                />
              </div>

              {/* Footer actions */}
              <div
                className="flex items-center justify-end gap-3 pt-2"
                style={{ borderTop: '1px solid #F1F5F9', marginTop: 20, paddingTop: 20 }}
              >
                <Button type="button" variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" loading={createMutation.isPending} icon={<Plus size={15} />}>
                  Submit Request
                </Button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 10

export default function CustomerRequests() {
  const queryClient = useQueryClient()
  const { email }   = useAuthStore()
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(DEFAULT_PAGE_SIZE)
  const [showModal, setShowModal]     = useState(false)
  const [activeChat, setActiveChat]   = useState<{ id: string; title: string } | null>(null)
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
          <Button icon={<Plus size={16} />} onClick={() => setShowModal(true)}>
            New Request
          </Button>
        </div>

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
            to="/customer/subscription"
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
            <h3 className="text-base font-semibold text-slate-900">All Requests</h3>
            <span className="text-xs text-slate-400">{totalCount} total</span>
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
                        {statusBadge(req.status)}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {req.category} · {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(req.status === 'Accepted' || req.status === 'PendingConfirmation') && (
                        <Button variant="ghost" size="sm" icon={<MessageSquare size={13} />} className="relative"
                          onClick={() => { setActiveChat({ id: req.id, title: req.title }); clearUnread(req.id) }}>
                          Chat
                          {(unreadCounts[req.id] ?? 0) > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {unreadCounts[req.id] > 9 ? '9+' : unreadCounts[req.id]}
                            </span>
                          )}
                        </Button>
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
