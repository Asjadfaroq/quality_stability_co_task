import { useEffect, useRef } from 'react'
import { MapPin, Loader2, AlertCircle, CheckCircle2, Search, X } from 'lucide-react'

import type { ServiceRequest } from '../../../types'

// ── Component ─────────────────────────────────────────────────────────────────

interface NearbyFilterPopoverProps {
  showNearby:     boolean
  setShowNearby:  (v: boolean) => void
  lat:            string
  setLat:         (v: string) => void
  lng:            string
  setLng:         (v: string) => void
  radius:         number
  setRadius:      (v: number) => void
  nearbyResults:  ServiceRequest[] | null
  searching:      boolean
  geoLat:         number | null
  geoLng:         number | null
  geoLoading:     boolean
  geoError:       string | null
  detect:         () => void
  onSearch:       () => void
  onClear:        () => void
}

export function NearbyFilterPopover({
  showNearby, setShowNearby,
  lat, setLat, lng, setLng,
  radius, setRadius,
  nearbyResults, searching,
  geoLat, geoLoading, geoError,
  detect, onSearch, onClear,
}: NearbyFilterPopoverProps) {
  const nearbyRef = useRef<HTMLDivElement>(null)

  // Close popover when clicking outside
  useEffect(() => {
    if (!showNearby) return
    const handler = (e: MouseEvent) => {
      if (nearbyRef.current && !nearbyRef.current.contains(e.target as Node))
        setShowNearby(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNearby, setShowNearby])

  return (
    <div className="relative" ref={nearbyRef}>
      <button
        type="button"
        onClick={() => setShowNearby(!showNearby)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${
          showNearby || nearbyResults
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <MapPin size={13} className={showNearby || nearbyResults ? 'text-white' : 'text-indigo-500'} />
        Nearby
        {nearbyResults && !showNearby && (
          <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-white/80 inline-block" />
        )}
      </button>

      {/* ── Floating popover ── */}
      {showNearby && (
        <div
          className="absolute right-0 top-full mt-2 z-30 w-[296px] rounded-2xl overflow-hidden"
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            boxShadow: '0 20px 60px -10px rgba(15,23,42,0.18), 0 4px 16px -4px rgba(15,23,42,0.10)',
            animation: 'nearbySlideIn 0.16s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <style>{`
            @keyframes nearbySlideIn {
              from { opacity:0; transform:translateY(-6px) scale(0.97); }
              to   { opacity:1; transform:translateY(0)   scale(1);    }
            }
          `}</style>

          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center">
                <MapPin size={12} className="text-white" />
              </div>
              <span className="text-[12px] font-semibold text-white">Find Nearby Jobs</span>
            </div>
            <button
              type="button"
              onClick={() => setShowNearby(false)}
              className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X size={11} className="text-white/80" />
            </button>
          </div>

          <div className="p-4 space-y-3.5">

            {/* Coordinates row */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Coordinates</span>
                <button
                  type="button"
                  onClick={detect}
                  disabled={geoLoading}
                  className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {geoLoading
                    ? <Loader2 size={10} className="animate-spin" />
                    : <MapPin size={10} />}
                  {geoLoading ? 'Detecting…' : 'Auto-detect'}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="number" step="any" placeholder="Latitude"
                  value={lat} onChange={(e) => setLat(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-800 placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <input
                  type="number" step="any" placeholder="Longitude"
                  value={lng} onChange={(e) => setLng(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 text-[12px] text-slate-800 placeholder:text-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Geo feedback — compact single line */}
              {geoError && (
                <p className="flex items-center gap-1 mt-1.5 text-[11px] text-amber-600">
                  <AlertCircle size={10} className="shrink-0" />{geoError}
                </p>
              )}
              {!geoError && geoLat !== null && (
                <p className="flex items-center gap-1 mt-1.5 text-[11px] text-emerald-600">
                  <CheckCircle2 size={10} className="shrink-0" />Location detected
                </p>
              )}
            </div>

            {/* Radius slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Radius</span>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(79,70,229,0.1)', color: '#4F46E5' }}
                >
                  {radius} km
                </span>
              </div>
              <input
                type="range" min={1} max={100} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-600"
                style={{ background: `linear-gradient(to right,#4F46E5 ${radius}%,#E2E8F0 ${radius}%)` }}
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>1 km</span><span>100 km</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={onSearch}
                disabled={searching}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold text-white transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)' }}
              >
                {searching
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Search size={12} />}
                {searching ? 'Searching…' : 'Search'}
              </button>
              {nearbyResults && (
                <button
                  type="button"
                  onClick={onClear}
                  className="px-3 py-2 rounded-xl text-[12px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
