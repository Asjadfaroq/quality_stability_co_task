import { useState, useRef } from 'react'
import ChatPanel from '../../components/ChatPanel'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useSignalR } from '../../hooks/useSignalR'
import api from '../../api/axios'
import type { ServiceRequest } from '../../types'

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(10, 'Min 10 characters').max(2000),
  category: z.string().min(1, 'Category is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

type FormData = z.infer<typeof schema>

const statusBadge = (status: ServiceRequest['status']) => {
  const styles = {
    Pending: 'bg-amber-100 text-amber-700',
    Accepted: 'bg-blue-100 text-blue-700',
    Completed: 'bg-green-100 text-green-700',
    PendingConfirmation: 'bg-orange-100 text-orange-700',
  }
  const labels = {
    Pending: 'Pending',
    Accepted: 'Accepted',
    Completed: 'Completed',
    PendingConfirmation: 'Awaiting Your Confirmation',
  }
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function CustomerDashboard() {
  const { email, logout } = useAuthStore()
  const queryClient = useQueryClient()
  const [freeLimitError, setFreeLimitError] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [activeChat, setActiveChat] = useState<{ id: string; title: string } | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  const activeChatRef = useRef<string | null>(null)
  activeChatRef.current = activeChat?.id ?? null

  useSignalR({
    RequestNeedsConfirmation: (data: { requestId: string; title: string }) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast('Provider marked "' + data.title + '" as complete. Please confirm!', {
        icon: '🔔',
        duration: 8000,
      })
    },
    NewMessageNotification: (data: { requestId: string; senderEmail: string }) => {
      const rid = String(data.requestId)
      if (activeChatRef.current === rid) return // panel is open, no badge needed
      setUnreadCounts((prev) => ({ ...prev, [rid]: (prev[rid] ?? 0) + 1 }))
      toast(data.senderEmail + ' sent you a message', { icon: '💬', duration: 4000 })
    },
  })

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: '' },
  })

  const description = watch('description')
  const title = watch('title')

  const { data: requests = [], isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ['requests'],
    queryFn: () => api.get('/requests').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post('/requests', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setFreeLimitError(false)
      reset()
    },
    onError: (err: any) => {
      if (err?.response?.status === 403) setFreeLimitError(true)
    },
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/requests/${id}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast.success('Job confirmed as completed!')
    },
    onError: () => toast.error('Failed to confirm completion.'),
  })

  const handleEnhance = async () => {
    if (!title || !description) return
    setEnhancing(true)
    try {
      const res = await api.post('/ai/enhance-description', {
        title,
        rawDescription: description,
      })
      setValue('description', res.data.enhancedDescription)
      if (!watch('category')) setValue('category', res.data.suggestedCategory)
    } catch {
      toast.error('AI enhancement failed. Please try again.')
    } finally {
      setEnhancing(false)
    }
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">Service Marketplace</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{email}</span>
          <button
            onClick={logout}
            className="text-sm text-red-500 hover:text-red-700 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Create Request Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">New Service Request</h2>

          {freeLimitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              Free tier limit reached. Upgrade to create more requests.
            </div>
          )}

          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                {...register('title')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Fix leaking pipe"
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <button
                  type="button"
                  onClick={handleEnhance}
                  disabled={enhancing || !title || !description}
                  className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-full disabled:opacity-50 transition"
                >
                  {enhancing ? 'Enhancing...' : '✨ Enhance with AI'}
                </button>
              </div>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the service you need (min 10 characters)"
              />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                {...register('category')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select category</option>
                {['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting', 'Moving', 'Gardening', 'IT Support', 'Other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  {...register('latitude', { valueAsNumber: true })}
                  type="number"
                  step="any"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 51.5074"
                />
                {errors.latitude && <p className="text-red-500 text-xs mt-1">{errors.latitude.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  {...register('longitude', { valueAsNumber: true })}
                  type="number"
                  step="any"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. -0.1278"
                />
                {errors.longitude && <p className="text-red-500 text-xs mt-1">{errors.longitude.message}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-60 transition"
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* My Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">My Requests</h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No requests yet. Create your first one above.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className={`border rounded-lg p-4 ${req.status === 'PendingConfirmation' ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{req.title}</p>
                      <p className="text-gray-500 text-xs mt-1">{req.category} · {new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(req.status)}
                      {(req.status === 'Accepted' || req.status === 'PendingConfirmation') && (
                        <button
                          onClick={() => {
                            setActiveChat({ id: req.id, title: req.title })
                            setUnreadCounts((prev) => ({ ...prev, [req.id]: 0 }))
                          }}
                          className="relative text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-lg transition"
                        >
                          💬 Chat
                          {(unreadCounts[req.id] ?? 0) > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                              {unreadCounts[req.id] > 9 ? '9+' : unreadCounts[req.id]}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {req.status === 'PendingConfirmation' && (
                    <div className="mt-3 flex items-center justify-between bg-white border border-orange-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-orange-700">The provider has marked this job as complete. Please confirm.</p>
                      <button
                        onClick={() => confirmMutation.mutate(req.id)}
                        disabled={confirmMutation.isPending}
                        className="ml-4 text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1.5 rounded-lg disabled:opacity-60 transition whitespace-nowrap"
                      >
                        Confirm Complete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

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
