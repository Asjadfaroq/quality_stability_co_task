import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
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
  }
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${styles[status]}`}>
      {status}
    </span>
  )
}

export default function CustomerDashboard() {
  const { email, logout } = useAuthStore()
  const queryClient = useQueryClient()
  const [freeLimitError, setFreeLimitError] = useState(false)
  const [enhancing, setEnhancing] = useState(false)

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
    } finally {
      setEnhancing(false)
    }
  }

  return (
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
                <div key={req.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{req.title}</p>
                    <p className="text-gray-500 text-xs mt-1">{req.category} · {new Date(req.createdAt).toLocaleDateString()}</p>
                  </div>
                  {statusBadge(req.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
