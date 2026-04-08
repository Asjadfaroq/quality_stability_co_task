import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Loader2 } from 'lucide-react'
import type { MapJobDto } from '../types/index'

// ── Status colours ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  Pending:             '#f59e0b',  // amber
  Accepted:            '#3b82f6',  // blue
  PendingConfirmation: '#f97316',  // orange
  Completed:           '#10b981',  // emerald
}

const STATUS_LABEL: Record<string, string> = {
  Pending:             'Pending',
  Accepted:            'Accepted',
  PendingConfirmation: 'In Progress',
  Completed:           'Completed',
}

// ── Map bounds adjuster ───────────────────────────────────────────────────────

function MapBoundsAdjuster({ jobs }: { jobs: MapJobDto[] }) {
  const map = useMap()

  useEffect(() => {
    const valid = jobs.filter((j) => j.latitude !== 0 || j.longitude !== 0)
    if (valid.length === 0) return

    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 13)
      return
    }

    const bounds = L.latLngBounds(valid.map((j) => [j.latitude, j.longitude] as [number, number]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
  }, [jobs, map])

  return null
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div
      className="absolute bottom-4 left-4 z-[1000] bg-white rounded-xl shadow-lg border border-slate-200 px-3 py-2.5 space-y-1.5"
      style={{ minWidth: 130 }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Status</p>
      {Object.entries(STATUS_LABEL).map(([status, label]) => (
        <div key={status} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shrink-0 border-2 border-white"
            style={{ background: STATUS_COLOR[status], boxShadow: '0 0 0 1px rgba(0,0,0,0.12)' }}
          />
          <span className="text-[11px] text-slate-600">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface JobsMapProps {
  jobs: MapJobDto[]
  loading?: boolean
  /** Tailwind height class, e.g. "h-[520px]". Defaults to "h-[500px]". */
  height?: string
  /** When true, shows customer/provider emails in the popup (admin view). */
  showEmails?: boolean
}

export default function JobsMap({ jobs, loading = false, height = 'h-[500px]', showEmails = false }: JobsMapProps) {
  // Filter out any invalid coordinate pairs (0,0 indicates missing data)
  const validJobs = useMemo(
    () => jobs.filter((j) => j.latitude !== 0 || j.longitude !== 0),
    [jobs],
  )

  if (loading) {
    return (
      <div className={`${height} rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center gap-2 text-slate-400`}>
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading map…</span>
      </div>
    )
  }

  if (validJobs.length === 0) {
    return (
      <div className={`${height} rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400`}>
        <MapPin size={28} className="text-slate-300" />
        <p className="text-sm font-medium">No jobs to display on the map</p>
        <p className="text-xs text-slate-400">Jobs with valid coordinates will appear here</p>
      </div>
    )
  }

  // Default centre — overridden immediately by MapBoundsAdjuster
  const defaultCenter: [number, number] = [validJobs[0].latitude, validJobs[0].longitude]

  return (
    <div className={`${height} relative rounded-xl overflow-hidden border border-slate-200`}>
      <MapContainer
        center={defaultCenter}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl
      >
        {/* Free OpenStreetMap tiles — no API key required */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsAdjuster jobs={validJobs} />

        {validJobs.map((job) => (
          <CircleMarker
            key={job.id}
            center={[job.latitude, job.longitude]}
            radius={8}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: STATUS_COLOR[job.status] ?? '#64748b',
              fillOpacity: 0.95,
            }}
          >
            <Popup maxWidth={240}>
              <div className="space-y-1 py-0.5">
                <p className="font-semibold text-slate-900 text-[13px] leading-tight">{job.title}</p>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: STATUS_COLOR[job.status] ?? '#64748b' }}
                  />
                  <span className="text-[11px] font-medium" style={{ color: STATUS_COLOR[job.status] ?? '#64748b' }}>
                    {STATUS_LABEL[job.status] ?? job.status}
                  </span>
                </div>
                {job.category && (
                  <p className="text-[11px] text-slate-500">{job.category}</p>
                )}
                {showEmails && job.customerEmail && (
                  <p className="text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">Customer:</span> {job.customerEmail}
                  </p>
                )}
                {showEmails && job.providerEmail && (
                  <p className="text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">Provider:</span> {job.providerEmail}
                  </p>
                )}
                <p className="text-[10px] text-slate-400">
                  {new Date(job.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <Legend />
    </div>
  )
}
