import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Briefcase, Loader2, CheckCircle2, MessageSquare,
  AlertCircle, RefreshCw, Search, X, SlidersHorizontal,
  MapPin, CalendarDays,
} from 'lucide-react'
import api, { isRateLimited } from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import ChatPanel from '../../components/ChatPanel'
import {
  Button, Badge, Card, CardHeader, Input, EmptyState, SkeletonCard, Pagination,
} from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useUnreadStore } from '../../store/unreadStore'
import type { PagedResult, ServiceRequest } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterTab = 'available' | 'active' | 'completed'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ServiceRequest['status'], { label: string; variant: string }> = {
  Pending:             { label: 'Pending',     variant: 'pending'             },
  Accepted:            { label: 'Accepted',    variant: 'accepted'            },
  PendingConfirmation: { label: 'Confirming',  variant: 'pendingconfirmation' },
  Completed:           { label: 'Completed',   variant: 'completed'           },
}

function StatusBadge({ status }: { status: ServiceRequest['status'] }) {
  const { label, variant } = STATUS_BADGE[status]
  return <Badge label={label} variant={variant as any} />
}

const DEFAULT_PAGE_SIZE = 20

// ── Main component ────────────────────────────────────────────────────────────

export default function ProviderJobs() {
  const queryClient    = useQueryClient()
  const { hasPermission } = usePermissions()
  const canAccept      = hasPermission('request.accept')
  const canComplete    = hasPermission('request.complete')
  const canViewAll     = hasPermission('request.view_all')
  const unreadCounts   = useUnreadStore((s) => s.counts)
  const clearUnread    = useUnreadStore((s) => s.clear)

  const [activeTab, setActiveTab]         = useState<FilterTab>('available')
  const [page, setPage]                   = useState(1)
  const [pageSize, setPageSize]           = useState(DEFAULT_PAGE_SIZE)
  const [acceptingId, setAcceptingId]     = useState<string | null>(null)
  const [completingId, setCompletingId]   = useState<string | null>(null)
  const [activeChat, setActiveChat]       = useState<{ id: string; title: string } | null>(null)

  // Nearby filter state (available tab only)
  const [showNearby, setShowNearby]       = useState(false)
  const [lat, setLat]                     = useState('')
  const [lng, setLng]                     = useState('')
  const [radius, setRadius]               = useState(10)
  const [nearbyResults, setNearbyResults] = useState<ServiceRequest[] | null>(null)
  const [searching, setSearching]         = useState(false)

  const { latitude: geoLat, longitude: geoLng, loading: geoLoading, error: geoError, detect } = useGeolocation()

  // Reset page when switching tabs
  useEffect(() => { setPage(1) }, [activeTab])

  // Auto-detect location when nearby panel opens
  useEffect(() => {
    if (showNearby) detect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNearby])

  // Fill lat/lng once geolocation resolves
  useEffect(() => {
    if (geoLat !== null && geoLng !== null) {
      setLat(String(geoLat))
      setLng(String(geoLng))
    }
  }, [geoLat, geoLng])

  // ── Queries ─────────────────────────────────────────────────────────────────

  const availableQuery = useQuery<PagedResult<ServiceRequest>>({
    queryKey: ['requests-pending', page, pageSize],
    queryFn: () =>
      api.get('/requests', { params: { page, pageSize, statusFilter: 'Pending' } }).then((r) => r.data),
    placeholderData: (prev) => prev,
    enabled: activeTab === 'available',
  })

  const activeQuery = useQuery<PagedResult<ServiceRequest>>({
    queryKey: ['requests-active', page, pageSize],
    queryFn: () =>
      api.get('/requests', { params: { page, pageSize, statusFilter: 'Active' } }).then((r) => r.data),
    placeholderData: (prev) => prev,
    enabled: activeTab === 'active',
  })

  const completedQuery = useQuery<PagedResult<ServiceRequest>>({
    queryKey: ['provider-completed', page, pageSize],
    queryFn: () =>
      api.get('/requests/completed', { params: { page, pageSize } }).then((r) => r.data),
    placeholderData: (prev) => prev,
    enabled: activeTab === 'completed',
  })

  const current    = activeTab === 'available' ? availableQuery
                   : activeTab === 'active'    ? activeQuery
                   :                             completedQuery

  const items      = current.data?.items      ?? []
  const totalCount = current.data?.totalCount ?? 0
  const totalPages = current.data?.totalPages ?? 1

  // Display: nearby results override the available list when a search is active
  const displayItems: ServiceRequest[] = activeTab === 'available' && nearbyResults !== null
    ? nearbyResults
    : items

  // ── Mutations ────────────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/requests/${id}/accept`),
    onSuccess: (_data, acceptedId) => {
      queryClient.invalidateQueries({ queryKey: ['requests-pending'] })
      queryClient.invalidateQueries({ queryKey: ['requests-active'] })
      setNearbyResults((prev) => prev ? prev.filter((r) => r.id !== acceptedId) : null)
      toast.success('Request accepted!')
    },
    onError: (err: any) => {
      if (isRateLimited(err)) return
      toast.error(err?.response?.status === 409
        ? 'This request was already accepted by someone else.'
        : 'Failed to accept request.')
    },
    onSettled: () => setAcceptingId(null),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/requests/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests-active'] })
      toast.success('Marked as complete — awaiting customer confirmation.')
    },
    onError: (err: unknown) => {
      if (isRateLimited(err)) return
      toast.error('Failed to mark as complete.')
    },
    onSettled: () => setCompletingId(null),
  })

  // ── Nearby search ─────────────────────────────────────────────────────────────

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

  // ── Tab config ────────────────────────────────────────────────────────────────

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'available', label: 'Available' },
    { key: 'active',    label: 'Active'    },
    { key: 'completed', label: 'Completed' },
  ]

  // ── Empty state copy ──────────────────────────────────────────────────────────

  const emptyTitle = activeTab === 'available' ? 'No available jobs'
                   : activeTab === 'active'    ? 'No active jobs'
                   :                             'No completed jobs yet'

  const emptyDesc  = activeTab === 'available' ? 'Check back soon for new service requests.'
                   : activeTab === 'active'    ? 'Jobs you accept will appear here.'
                   :                             'Jobs you finish and customers confirm will appear here.'

  const emptyIcon  = activeTab === 'available' ? <Briefcase size={22} />
                   : activeTab === 'active'    ? <Loader2   size={22} />
                   :                             <CheckCircle2 size={22} />

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <AppLayout title="My Jobs">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">My Jobs</h2>
            <p className="text-sm text-slate-500 mt-0.5">Browse available requests, manage active work, and view history</p>
          </div>
          {/* Nearby filter toggle — only relevant on available tab */}
          {activeTab === 'available' && canViewAll && (
            <Button
              variant={showNearby ? 'secondary' : 'primary'}
              icon={showNearby ? <X size={15} /> : <SlidersHorizontal size={15} />}
              onClick={() => { setShowNearby(!showNearby); setNearbyResults(null) }}
            >
              {showNearby ? 'Hide filter' : 'Find Nearby'}
            </Button>
          )}
        </div>

        {/* Tab filter pills */}
        <div className="flex items-center gap-1.5 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); setNearbyResults(null); setShowNearby(false) }}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Nearby filter panel — available tab only */}
        {activeTab === 'available' && showNearby && (
          <Card className="mb-5">
            <CardHeader
              title="Find Nearby Requests"
              description="Search for pending jobs within a radius of your location"
            />
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-slate-700">Your location</span>
                <button
                  type="button"
                  onClick={detect}
                  disabled={geoLoading}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {geoLoading ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                  {geoLoading ? 'Detecting…' : 'Detect my location'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Latitude"  type="number" step="any" placeholder="e.g. 51.5074"  value={lat} onChange={(e) => setLat(e.target.value)} />
                <Input label="Longitude" type="number" step="any" placeholder="e.g. -0.1278" value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
              {geoError && (
                <p className="flex items-center gap-1.5 text-[11.5px] text-amber-600">
                  <MapPin size={11} className="shrink-0" />{geoError}
                </p>
              )}
              {!geoError && geoLat !== null && (
                <p className="flex items-center gap-1.5 text-[11.5px] text-emerald-600">
                  <MapPin size={11} className="shrink-0" />Location detected — you can still edit the values above.
                </p>
              )}
            </div>
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">Search radius</label>
                <span className="text-sm font-semibold text-indigo-600">{radius} km</span>
              </div>
              <input
                type="range" min={1} max={100} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1 km</span><span>100 km</span></div>
            </div>
            <div className="flex items-center gap-3">
              <Button icon={<Search size={14} />} loading={searching} onClick={handleNearbySearch}>Search</Button>
              {nearbyResults && <Button variant="ghost" icon={<X size={14} />} onClick={() => setNearbyResults(null)}>Clear</Button>}
            </div>
          </Card>
        )}

        {/* Jobs list */}
        <Card padding={false}>
          {/* Card header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {activeTab === 'available' && nearbyResults ? `Nearby Results (${nearbyResults.length})`
                 : activeTab === 'available' ? 'Pending Requests'
                 : activeTab === 'active'    ? 'In Progress'
                 :                             'Job History'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {current.isLoading ? 'Loading…'
                 : nearbyResults   ? `${nearbyResults.length} job${nearbyResults.length !== 1 ? 's' : ''} nearby`
                 :                   `${totalCount} job${totalCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            {activeTab === 'active' && totalCount > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(59,130,246,0.08)', color: '#2563eb' }}
              >
                <Loader2 size={11} className="animate-spin" />
                {totalCount} ongoing
              </span>
            )}
            {activeTab === 'completed' && (current.data?.items ?? []).length > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}
              >
                <CheckCircle2 size={11} />
                All confirmed
              </span>
            )}
            {activeTab === 'available' && nearbyResults && (
              <Badge label={`${nearbyResults.length} found`} variant="accepted" />
            )}
          </div>

          {/* Content */}
          {current.isLoading ? (
            <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>

          ) : current.isError ? (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)' }}>
                <AlertCircle size={20} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Failed to load jobs</p>
                <p className="text-xs text-slate-400 mt-0.5">Check your connection and try again</p>
              </div>
              <button
                onClick={() => current.refetch()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'rgba(15,23,42,0.06)', color: '#1e293b' }}
              >
                <RefreshCw size={12} />Retry
              </button>
            </div>

          ) : displayItems.length === 0 ? (
            <EmptyState
              icon={emptyIcon}
              title={emptyTitle}
              description={emptyDesc}
            />

          ) : (
            <>
              {/* Column headers */}
              <div className="px-6 py-2.5 grid grid-cols-[1fr_auto] gap-4 bg-slate-50 border-b border-slate-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {activeTab === 'completed' ? 'Job / Description' : 'Job / Details'}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {activeTab === 'completed' ? 'Completed On' : 'Action'}
                </span>
              </div>

              <ul className="divide-y divide-slate-100">
                {displayItems.map((req) => (
                  <li
                    key={req.id}
                    className={`px-6 py-4 transition-colors ${
                      req.status === 'PendingConfirmation' ? 'bg-orange-50/40' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">

                      {/* ── Available / Active: card-style info ── */}
                      {activeTab !== 'completed' && (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-medium text-slate-800">{req.title}</p>
                              <StatusBadge status={req.status} />
                            </div>
                            <p className="text-xs text-slate-400 mb-1">
                              {req.category} · {new Date(req.createdAt).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-slate-400 line-clamp-1">{req.description}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Active tab actions */}
                            {activeTab === 'active' && (
                              <>
                                <Button
                                  variant="ghost" size="sm"
                                  icon={<MessageSquare size={13} />}
                                  className="relative"
                                  onClick={() => { setActiveChat({ id: req.id, title: req.title }); clearUnread(req.id) }}
                                >
                                  Chat
                                  {(unreadCounts[req.id] ?? 0) > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                      {unreadCounts[req.id] > 9 ? '9+' : unreadCounts[req.id]}
                                    </span>
                                  )}
                                </Button>
                                {req.status === 'Accepted' && canComplete && (
                                  <Button
                                    variant="success" size="sm"
                                    loading={completingId === req.id}
                                    disabled={completingId !== null}
                                    onClick={() => { setCompletingId(req.id); completeMutation.mutate(req.id) }}
                                  >
                                    Mark Complete
                                  </Button>
                                )}
                              </>
                            )}

                            {/* Available tab: accept action */}
                            {activeTab === 'available' && canAccept && (
                              <Button
                                size="sm"
                                loading={acceptingId === req.id}
                                disabled={acceptingId !== null}
                                onClick={() => { setAcceptingId(req.id); acceptMutation.mutate(req.id) }}
                              >
                                Accept
                              </Button>
                            )}
                          </div>
                        </>
                      )}

                      {/* ── Completed tab: history-style layout ── */}
                      {activeTab === 'completed' && (
                        <>
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div
                              className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(16,185,129,0.1)' }}
                            >
                              <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{req.description}</p>
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 mt-1.5">
                                <MapPin size={10} />{req.category}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-1"
                              style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}
                            >
                              <CheckCircle2 size={11} />Completed
                            </span>
                            <p className="text-[11px] text-slate-400 flex items-center justify-end gap-1 mt-1">
                              <CalendarDays size={10} />
                              {new Date(req.updatedAt).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* PendingConfirmation banner */}
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

              {/* Pagination — hidden when showing nearby results */}
              {!(activeTab === 'available' && nearbyResults) && (
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
