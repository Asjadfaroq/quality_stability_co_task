import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, MapPin, CalendarDays, AlertCircle, RefreshCw } from 'lucide-react'
import api from '../../api/axios'
import { formatDate } from '../../utils/format'
import { usePagination } from '../../hooks/usePagination'
import AppLayout from '../../components/AppLayout'
import { Card, EmptyState, SkeletonCard, Pagination } from '../../components/ui'
import type { PagedResult, ServiceRequest } from '../../types'

const DEFAULT_PAGE_SIZE = 10

export default function CompletedJobs() {
  const { page, pageSize, setPage, setPageSize } = usePagination(DEFAULT_PAGE_SIZE)

  const { data, isLoading, isError, refetch } = useQuery<PagedResult<ServiceRequest>>({
    queryKey: ['provider-completed', page, pageSize],
    queryFn: () =>
      api.get('/requests/completed', { params: { page, pageSize } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const completed  = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  return (
    <AppLayout title="Completed Jobs">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Completed Jobs</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Full history of every job you have successfully completed
        </p>
      </div>

      <Card padding={false}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Job History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isLoading ? 'Loading…' : `${totalCount} completed job${totalCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          {completed.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}
            >
              <CheckCircle2 size={11} />
              All confirmed
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>

        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.08)' }}
            >
              <AlertCircle size={20} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Failed to load completed jobs</p>
              <p className="text-xs text-slate-400 mt-0.5">Check your connection and try again</p>
            </div>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(15,23,42,0.06)', color: '#1e293b' }}
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>

        ) : completed.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} />}
            title="No completed jobs yet"
            description="Jobs you finish and the customer confirms will appear here."
          />

        ) : (
          <>
            <div className="px-6 py-2.5 grid grid-cols-[1fr_auto] gap-4 bg-slate-50 border-b border-slate-100">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Job / Description</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Completed On</span>
            </div>

            <ul className="divide-y divide-slate-100">
              {completed.map((req) => (
                <li key={req.id} className="px-6 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-4">
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
                          <MapPin size={10} />
                          {req.category}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-1"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}
                      >
                        <CheckCircle2 size={11} />
                        Completed
                      </span>
                      <p className="text-[11px] text-slate-400 flex items-center justify-end gap-1 mt-1">
                        <CalendarDays size={10} />
                        {formatDate(req.updatedAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setPage}
              pageSizeOptions={[5, 10, 20, 50]}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>
    </AppLayout>
  )
}
