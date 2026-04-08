import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Map } from 'lucide-react'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import JobsMap from '../../components/JobsMap'
import { Card } from '../../components/ui'
import type { MapJobDto } from '../../types'

const STATUS_FILTERS = [
  { value: '',                    label: 'All'         },
  { value: 'Accepted',            label: 'Accepted'    },
  { value: 'PendingConfirmation', label: 'In Progress' },
  { value: 'Completed',           label: 'Completed'   },
]

export default function ProviderMapPage() {
  const [statusFilter, setStatusFilter] = useState('')

  const { data: allJobs = [], isLoading } = useQuery<MapJobDto[]>({
    queryKey: ['provider-map'],
    queryFn: () => api.get('/requests/map').then((r) => r.data),
    staleTime: 60_000,
  })

  const filteredJobs = statusFilter
    ? allJobs.filter((j) => j.status === statusFilter)
    : allJobs

  return (
    <AppLayout title="Jobs Map">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Jobs Map</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          All jobs accepted or completed by you and your organisation members.
        </p>
      </div>

      <Card className="p-4">
        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${
                statusFilter === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-400">
            {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Map */}
        {!isLoading && allJobs.length === 0 ? (
          <div className="h-[500px] rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Map size={28} className="text-slate-300" />
            <p className="text-sm font-medium">No jobs to display yet</p>
            <p className="text-xs">Accept some jobs and they will appear here.</p>
          </div>
        ) : (
          <JobsMap jobs={filteredJobs} loading={isLoading} height="h-[520px]" />
        )}
      </Card>
    </AppLayout>
  )
}
