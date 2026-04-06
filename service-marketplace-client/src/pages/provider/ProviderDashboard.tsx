import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useSignalR } from '../../hooks/useSignalR'
import ChatPanel from '../../components/ChatPanel'
import api, { isRateLimited } from '../../api/axios'
import type { ServiceRequest } from '../../types'

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
    PendingConfirmation: 'Awaiting Customer',
  }
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function ProviderDashboard() {
  const { email, role, logout } = useAuthStore()
  const queryClient = useQueryClient()

  const [activeChat, setActiveChat] = useState<{ id: string; title: string } | null>(null)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const activeChatRef = useRef<string | null>(null)
  activeChatRef.current = activeChat?.id ?? null
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState(10)
  const [nearbyResults, setNearbyResults] = useState<ServiceRequest[] | null>(null)
  const [searchingNearby, setSearchingNearby] = useState(false)

  useSignalR({
    RequestConfirmed: (data: { requestId: string; title: string }) => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast.success('Customer confirmed "' + data.title + '" as completed!')
    },
    NewMessageNotification: (data: { requestId: string; senderEmail: string }) => {
      const rid = String(data.requestId)
      if (activeChatRef.current === rid) return
      setUnreadCounts((prev) => ({ ...prev, [rid]: (prev[rid] ?? 0) + 1 }))
      toast(data.senderEmail + ' sent you a message', { icon: '💬', duration: 4000 })
    },
  })

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
      if (isRateLimited(err)) return
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
    onError: (err: unknown) => {
      if (isRateLimited(err)) return
      toast.error('Failed to complete request.')
    },
  })

  const handleNearbySearch = async () => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (!lat || !lng || isNaN(latNum) || isNaN(lngNum))
      return toast.error('Enter valid latitude and longitude.')
    if (latNum < -90 || latNum > 90)
      return toast.error('Latitude must be between -90 and 90.')
    if (lngNum < -180 || lngNum > 180)
      return toast.error('Longitude must be between -180 and 180.')
    setSearchingNearby(true)
    try {
      const res = await api.get('/requests/nearby', {
        params: { lat: latNum, lng: lngNum, radiusKm: radius },
      })
      setNearbyResults(res.data)
      if (res.data.length === 0) toast('No requests found nearby.', { icon: 'ℹ️' })
    } catch (err) {
      if (!isRateLimited(err)) toast.error('Failed to fetch nearby requests.')
    } finally {
      setSearchingNearby(false)
    }
  }

  const displayPending = nearbyResults ?? pending

  return (
    <>
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
                      onClick={() => {
                        setActiveChat({ id: req.id, title: req.title })
                        setUnreadCounts((prev) => ({ ...prev, [req.id]: 0 }))
                      }}
                      className="relative text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1.5 rounded-lg transition"
                    >
                      💬 Chat
                      {(unreadCounts[req.id] ?? 0) > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {unreadCounts[req.id] > 9 ? '9+' : unreadCounts[req.id]}
                        </span>
                      )}
                    </button>
                    {req.status === 'Accepted' && (
                      <button
                        onClick={() => completeMutation.mutate(req.id)}
                        disabled={completeMutation.isPending}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60 transition"
                      >
                        Complete
                      </button>
                    )}
                    {req.status === 'PendingConfirmation' && (
                      <span className="text-xs text-orange-600 italic">Waiting for customer...</span>
                    )}
                  </div>
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
