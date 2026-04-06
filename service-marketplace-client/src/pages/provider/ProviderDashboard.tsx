import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/axios'
import type { ServiceRequest } from '../../types'

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

export default function ProviderDashboard() {
  const { email, role, logout } = useAuthStore()
  const queryClient = useQueryClient()

  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState(10)
  const [nearbyResults, setNearbyResults] = useState<ServiceRequest[] | null>(null)
  const [searchingNearby, setSearchingNearby] = useState(false)

  const { data: allRequests = [], isLoading: loadingAll } = useQuery<ServiceRequest[]>({
    queryKey: ['requests'],
    queryFn: () => api.get('/requests').then((r) => r.data),
  })

  const pending = allRequests.filter((r) => r.status === 'Pending')
  const active = allRequests.filter((r) => r.status === 'Accepted')

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/requests/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast.success('Request accepted!')
    },
    onError: (err: any) => {
      if (err?.response?.status === 409)
        toast.error('This request was already accepted by someone else.')
      else
        toast.error('Failed to accept request.')
    },
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/requests/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast.success('Request marked as completed!')
    },
    onError: () => toast.error('Failed to complete request.'),
  })

  const handleNearbySearch = async () => {
    if (!lat || !lng) return toast.error('Enter latitude and longitude.')
    setSearchingNearby(true)
    try {
      const res = await api.get('/requests/nearby', {
        params: { lat, lng, radiusKm: radius },
      })
      setNearbyResults(res.data)
      if (res.data.length === 0) toast('No requests found nearby.', { icon: 'ℹ️' })
    } catch {
      toast.error('Failed to fetch nearby requests.')
    } finally {
      setSearchingNearby(false)
    }
  }

  const displayPending = nearbyResults ?? pending

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">Service Marketplace</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{role}</span>
          <span className="text-sm text-gray-500">{email}</span>
          {role === 'ProviderAdmin' && (
            <a href="/org" className="text-sm text-blue-600 hover:underline">
              Org Panel
            </a>
          )}
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Nearby Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Find Nearby Requests</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 51.5074"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. -0.1278"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Radius: <span className="font-semibold">{radius} km</span>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleNearbySearch}
              disabled={searchingNearby}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60 transition"
            >
              {searchingNearby ? 'Searching...' : 'Search Nearby'}
            </button>
            {nearbyResults && (
              <button
                onClick={() => setNearbyResults(null)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-300 transition"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Available / Pending Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {nearbyResults ? `Nearby Requests (${nearbyResults.length})` : 'Available Requests'}
          </h2>

          {loadingAll ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : displayPending.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No pending requests available.</p>
          ) : (
            <div className="space-y-3">
              {displayPending.map((req) => (
                <div key={req.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{req.title}</p>
                    <p className="text-gray-500 text-xs mt-1">{req.category} · {new Date(req.createdAt).toLocaleDateString()}</p>
                    <p className="text-gray-400 text-xs mt-1 truncate max-w-sm">{req.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(req.status)}
                    <button
                      onClick={() => acceptMutation.mutate(req.id)}
                      disabled={acceptMutation.isPending}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60 transition"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Active Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">My Active Requests</h2>

          {active.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No active requests. Accept one above.</p>
          ) : (
            <div className="space-y-3">
              {active.map((req) => (
                <div key={req.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{req.title}</p>
                    <p className="text-gray-500 text-xs mt-1">{req.category} · {new Date(req.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusBadge(req.status)}
                    <button
                      onClick={() => completeMutation.mutate(req.id)}
                      disabled={completeMutation.isPending}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60 transition"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
