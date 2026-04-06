import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Plus, Sparkles, MessageSquare, ClipboardList,
  Clock, CheckCircle2, Loader2, X,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSignalR } from '../../hooks/useSignalR'
import { isRateLimited } from '../../api/axios'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import ChatPanel from '../../components/ChatPanel'
import {
  Button, Badge, Card, CardHeader, StatCard,
  Input, Textarea, Select, EmptyState, SkeletonCard,
} from '../../components/ui'
import type { ServiceRequest } from '../../types'

const schema = z.object({
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().min(10, 'Min 10 characters').max(2000),
  category:    z.string().min(1, 'Select a category'),
  latitude:    z.number({ invalid_type_error: 'Required' }).min(-90).max(90),
  longitude:   z.number({ invalid_type_error: 'Required' }).min(-180).max(180),
})

type FormData = z.infer<typeof schema>

const CATEGORIES = [
  'Plumbing','Electrical','Cleaning','Carpentry',
  'Painting','Moving','Gardening','IT Support','Other',
]

function statusBadge(status: ServiceRequest['status']) {
  const map: Record<ServiceRequest['status'], { label: string; variant: string }> = {
    Pending:            { label: 'Pending',              variant: 'pending' },
    Accepted:           { label: 'Accepted',             variant: 'accepted' },
    PendingConfirmation:{ label: 'Awaiting Confirmation', variant: 'pendingconfirmation' },
    Completed:          { label: 'Completed',            variant: 'completed' },
  }
  const { label, variant } = map[status]
  return <Badge label={label} variant={variant as any} />
}

export default function CustomerDashboard() {
  const queryClient = useQueryClient()
  const { email } = useAuthStore()
  const [showForm, setShowForm]     = useState(false)
  const [enhancing, setEnhancing]   = useState(false)
  const [freeLimitHit, setFreeLimitHit] = useState(false)
  const [activeChat, setActiveChat] = useState<{ id: string; title: string } | null>(null)
  const [unread, setUnread]         = useState<Record<string, number>>({})
  const activeChatRef = useRef<string | null>(null)
  activeChatRef.current = activeChat?.id ?? null

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: '' },
  })
  const title       = watch('title')
  const description = watch('description')

  useSignalR({
    RequestNeedsConfirmation: (data: { requestId: string; title: string }) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast(`"${data.title}" marked complete — please confirm!`, { icon: '🔔', duration: 8000 })
    },
    NewMessageNotification: (data: { requestId: string; senderEmail: string }) => {
      const rid = String(data.requestId)
      if (activeChatRef.current === rid) return
      setUnread((p) => ({ ...p, [rid]: (p[rid] ?? 0) + 1 }))
      toast(`${data.senderEmail} sent you a message`, { icon: '💬', duration: 4000 })
    },
  })

  const { data: requests = [], isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ['requests'],
    queryFn: () => api.get('/requests').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post('/requests', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setFreeLimitHit(false)
      setShowForm(false)
      reset()
      toast.success('Request submitted successfully!')
    },
    onError: (err: any) => {
      if (isRateLimited(err)) return
      if (err?.response?.status === 403) setFreeLimitHit(true)
    },
  })

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

  const handleEnhance = async () => {
    if (!title || !description) return
    setEnhancing(true)
    try {
      const res = await api.post('/ai/enhance-description', { title, rawDescription: description })
      setValue('description', res.data.enhancedDescription)
      if (!watch('category')) setValue('category', res.data.suggestedCategory)
      toast.success('Description enhanced!')
    } catch (err) {
      if (!isRateLimited(err)) toast.error('AI enhancement failed.')
    } finally {
      setEnhancing(false)
    }
  }

  const pending   = requests.filter((r) => r.status === 'Pending').length
  const active    = requests.filter((r) => r.status === 'Accepted').length
  const completed = requests.filter((r) => r.status === 'Completed').length

  return (
    <>
      <AppLayout
        title="My Requests"
        description={`Welcome back, ${email?.split('@')[0]}`}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setShowForm(true)}>
            New Request
          </Button>
        }
      >
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard label="Total Requests" value={requests.length} icon={<ClipboardList size={18} />} color="blue" />
          <StatCard label="Active"          value={active}          icon={<Loader2 size={18} />}     color="amber" />
          <StatCard label="Completed"       value={completed}       icon={<CheckCircle2 size={18} />} color="emerald" />
        </div>

        {/* Create form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader
              title="New Service Request"
              description="Describe what you need done and where"
              actions={
                <button
                  onClick={() => { setShowForm(false); reset(); setFreeLimitHit(false) }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              }
            />

            {freeLimitHit && (
              <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg mb-5 text-sm text-amber-800">
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
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={enhancing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    onClick={handleEnhance}
                    disabled={enhancing || !title || !description}
                  >
                    {enhancing ? 'Enhancing...' : 'Enhance with AI'}
                  </Button>
                }
                {...register('description')}
              />

              <Select
                label="Category"
                error={errors.category?.message}
                {...register('category')}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Latitude"
                  type="number"
                  step="any"
                  placeholder="e.g. 51.5074"
                  error={errors.latitude?.message}
                  {...register('latitude', { valueAsNumber: true })}
                />
                <Input
                  label="Longitude"
                  type="number"
                  step="any"
                  placeholder="e.g. -0.1278"
                  error={errors.longitude?.message}
                  {...register('longitude', { valueAsNumber: true })}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="submit" loading={createMutation.isPending}>
                  Submit Request
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setShowForm(false); reset(); setFreeLimitHit(false) }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Requests list */}
        <Card padding={false}>
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">All Requests</h3>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={24} />}
              title="No requests yet"
              description="Submit your first service request to get started."
              action={
                <Button icon={<Plus size={15} />} size="sm" onClick={() => setShowForm(true)}>
                  New Request
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className={`px-6 py-4 transition-colors duration-100 ${
                    req.status === 'PendingConfirmation' ? 'bg-orange-50/50' : 'hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{req.title}</p>
                        {statusBadge(req.status)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {req.category} · {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(req.status === 'Accepted' || req.status === 'PendingConfirmation') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<MessageSquare size={13} />}
                          onClick={() => {
                            setActiveChat({ id: req.id, title: req.title })
                            setUnread((p) => ({ ...p, [req.id]: 0 }))
                          }}
                          className="relative"
                        >
                          Chat
                          {(unread[req.id] ?? 0) > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {unread[req.id] > 9 ? '9+' : unread[req.id]}
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {req.status === 'PendingConfirmation' && (
                    <div className="mt-3 flex items-center justify-between bg-white border border-orange-200 rounded-lg px-4 py-3">
                      <p className="text-xs text-orange-700 font-medium">
                        The provider has marked this job as complete — please confirm.
                      </p>
                      <Button
                        variant="success"
                        size="sm"
                        loading={confirmMutation.isPending}
                        onClick={() => confirmMutation.mutate(req.id)}
                        className="ml-4 shrink-0"
                      >
                        Confirm Complete
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
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
