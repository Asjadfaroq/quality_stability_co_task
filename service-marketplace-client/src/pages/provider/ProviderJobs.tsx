import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Briefcase, Search, X, SlidersHorizontal } from 'lucide-react'
import { isRateLimited } from '../../api/axios'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Button, Badge, Card, CardHeader, Input, EmptyState, SkeletonCard, Pagination } from '../../components/ui'
import type { PagedResult, ServiceRequest } from '../../types'

const DEFAULT_PAGE_SIZE = 20

export default function ProviderJobs() {
  const queryClient = useQueryClient()
  const [page, setPage]                   = useState(1)
  const [pageSize, setPageSize]           = useState(DEFAULT_PAGE_SIZE)
  const [showNearby, setShowNearby]       = useState(false)
  const [lat, setLat]                     = useState('')
  const [lng, setLng]                     = useState('')
  const [radius, setRadius]               = useState(10)
  const [nearbyResults, setNearbyResults] = useState<ServiceRequest[] | null>(null)
  const [searching, setSearching]         = useState(false)

  const { data, isLoading } = useQuery<PagedResult<ServiceRequest>>({
    queryKey: ['requests-pending', page, pageSize],
    queryFn: () =>
      api.get('/requests', { params: { page, pageSize, statusFilter: 'Pending' } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const allRequests = data?.items      ?? []
  const totalCount  = data?.totalCount ?? 0
  const totalPages  = data?.totalPages ?? 1

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/requests/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast.success('Request accepted!')
    },
    onError: (err: any) => {
      if (isRateLimited(err)) return
      toast.error(err?.response?.status === 409
        ? 'This request was already accepted by someone else.'
        : 'Failed to accept request.')
    },
  })

  const handleNearbySearch = async () => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (!lat || !lng || isNaN(latNum) || isNaN(lngNum))
      return toast.error('Enter valid coordinates.')
    if (latNum < -90  || latNum > 90)  return toast.error('Latitude must be between -90 and 90.')
    if (lngNum < -180 || lngNum > 180) return toast.error('Longitude must be between -180 and 180.')
    setSearching(true)
    try {
      const res = await api.get('/requests/nearby', { params: { lat: latNum, lng: lngNum, radiusKm: radius } })
      setNearbyResults(res.data)
      if (res.data.length === 0) toast('No requests found nearby.', { icon: 'ℹ️' })
    } catch (err) {
      if (!isRateLimited(err)) toast.error('Failed to fetch nearby requests.')
    } finally {
      setSearching(false)
    }
  }

  // Server already filters to Pending only — no client-side filter needed.
  const displayPending = nearbyResults ?? allRequests

  return (
    <AppLayout title="Available Jobs">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Available Jobs</h2>
          <p className="text-sm text-slate-500 mt-0.5">Browse and accept pending service requests</p>
        </div>
        <Button
          variant={showNearby ? 'secondary' : 'primary'}
          icon={showNearby ? <X size={15} /> : <SlidersHorizontal size={15} />}
          onClick={() => { setShowNearby(!showNearby); setNearbyResults(null) }}
        >
          {showNearby ? 'Hide filter' : 'Find Nearby'}
        </Button>
      </div>

      {/* Nearby filter */}
      {showNearby && (
        <Card className="mb-6">
          <CardHeader
            title="Find Nearby Requests"
            description="Search for pending jobs within a radius of your location"
          />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Latitude"  type="number" step="any" placeholder="e.g. 51.5074"  value={lat} onChange={(e) => setLat(e.target.value)} />
            <Input label="Longitude" type="number" step="any" placeholder="e.g. -0.1278" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Search radius</label>
              <span className="text-sm font-semibold text-indigo-600">{radius} km</span>
            </div>
            <input type="range" min={1} max={100} value={radius} onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-indigo-600 cursor-pointer" />
            <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1 km</span><span>100 km</span></div>
          </div>
          <div className="flex items-center gap-3">
            <Button icon={<Search size={14} />} loading={searching} onClick={handleNearbySearch}>Search</Button>
            {nearbyResults && <Button variant="ghost" icon={<X size={14} />} onClick={() => setNearbyResults(null)}>Clear</Button>}
          </div>
        </Card>
      )}

      {/* Available jobs list */}
      <Card padding={false}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {nearbyResults ? `Nearby Results (${nearbyResults.length})` : 'Pending Requests'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Jobs available for you to accept</p>
          </div>
          {nearbyResults && <Badge label={`${nearbyResults.length} found`} variant="accepted" />}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
        ) : displayPending.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={22} />}
            title={nearbyResults ? 'No nearby requests found' : 'No available jobs'}
            description={nearbyResults ? 'Try increasing the search radius.' : 'Check back soon for new service requests.'}
          />
        ) : (
          <>
            {/* Column headers */}
            <div className="px-6 py-2.5 grid grid-cols-[1fr_auto] gap-4 bg-slate-50 border-b border-slate-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Job / Details</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Action</span>
            </div>

            <ul className="divide-y divide-slate-100">
              {displayPending.map((req) => (
                <li key={req.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 mb-1">{req.title}</p>
                      <p className="text-xs text-slate-400 mb-1.5">
                        {req.category} · {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-slate-400 line-clamp-2">{req.description}</p>
                    </div>
                    <Button size="sm" loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate(req.id)} className="shrink-0">
                      Accept
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {/* Show pagination only when not filtered by nearby (nearby results are already a subset) */}
            {!nearbyResults && (
              <Pagination
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
                pageSizeOptions={[5, 10, 20, 50]}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
              />
            )}
          </>
        )}
      </Card>
    </AppLayout>
  )
}
