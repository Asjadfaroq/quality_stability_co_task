import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, Search, X, Map, List } from 'lucide-react'

import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import JobsMap from '../../components/JobsMap'
import {
  Card, Badge, EmptyState, Skeleton, Pagination,
} from '../../components/ui'
import type { PagedResult, MapJobDto } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminJobDto {
  id: string
  title: string
  category: string | null
  status: string
  customerId: string
  customerEmail: string
  acceptedByProviderId: string | null
  providerEmail: string | null
  createdAt: string
  updatedAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 25

/** Maps each API status value to a display label and Badge variant. */
const STATUS_META: Record<string, { label: string; variant: string }> = {
  Pending:             { label: 'Pending',     variant: 'pending'             },
  Accepted:            { label: 'Accepted',    variant: 'accepted'            },
  PendingConfirmation: { label: 'In Progress', variant: 'pendingconfirmation' },
  Completed:           { label: 'Completed',   variant: 'completed'           },
}

interface StatusOption {
  value: string   // '' means "All"
  label: string
}

const STATUS_FILTERS: StatusOption[] = [
  { value: '',                    label: 'All'         },
  { value: 'Pending',             label: 'Pending'     },
  { value: 'Accepted',            label: 'Accepted'    },
  { value: 'PendingConfirmation', label: 'In Progress' },
  { value: 'Completed',           label: 'Completed'   },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-40" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-5 w-24 rounded-full" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-36" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-36" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
        </tr>
      ))}
    </>
  )
}

// ── AdminJobs ─────────────────────────────────────────────────────────────────

type ViewMode = 'table' | 'map'

export default function AdminJobs() {
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // Two-state debounce: `searchInput` is the raw controlled value of the text
  // field; `search` is the debounced value that actually drives the query.
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')

  // Debounce: wait 350 ms after the user stops typing before firing the query.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(id)
  }, [searchInput])

  // Reset to page 1 whenever filters change so we don't show an empty page.
  useEffect(() => { setPage(1) }, [statusFilter, search])

  const { data, isLoading, isPlaceholderData } = useQuery<PagedResult<AdminJobDto>>({
    queryKey: ['admin-jobs', page, pageSize, statusFilter, search],
    queryFn: () =>
      api.get('/admin/jobs', {
        params: {
          page,
          pageSize,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(search       ? { search }              : {}),
        },
      }).then(r => r.data),
    // Keep the previous page's data visible while the next page loads
    // so the table doesn't flash empty on every page turn.
    placeholderData: prev => prev,
    enabled: viewMode === 'table',
  })

  // Map data — fetched only when map view is active
  const { data: mapJobs, isLoading: mapLoading } = useQuery<MapJobDto[]>({
    queryKey: ['admin-jobs-map'],
    queryFn: () => api.get('/requests/map').then(r => r.data),
    enabled: viewMode === 'map',
    staleTime: 60_000,
  })

  const jobs       = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const isFiltered = !!statusFilter || !!search

  return (
    <AppLayout title="All Jobs">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">All Jobs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Platform-wide view of every service request across all statuses.
          </p>
        </div>
        {/* View mode toggle */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors ${
              viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <List size={13} /> Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors ${
              viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Map size={13} /> Map
          </button>
        </div>
      </div>

      {/* ── Map view ──────────────────────────────────────────────────────── */}
      {viewMode === 'map' && (
        <Card className="p-4">
          <p className="text-xs text-slate-500 mb-3">
            Showing all {mapJobs?.length ?? 0} jobs on the map. Click a marker for details.
          </p>
          <JobsMap jobs={mapJobs ?? []} loading={mapLoading} height="h-[560px]" showEmails />
        </Card>
      )}

      {/* ── Table view ────────────────────────────────────────────────────── */}
      {viewMode === 'table' && (
      <Card padding={false}>
        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">

          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(opt => (
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
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search input */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search title, category, email…"
              className="w-full pl-8 pr-8 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-800
                         placeholder:text-slate-400 bg-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                         transition-shadow"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ── Result count line ──────────────────────────────────────────── */}
        {!isLoading && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100">
            <span className="text-[11px] text-slate-500">
              {totalCount === 0
                ? isFiltered ? 'No jobs match the current filters.' : 'No jobs yet.'
                : <>{totalCount} job{totalCount !== 1 ? 's' : ''}{isFiltered ? ' match the current filters' : ''}</>
              }
            </span>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-white">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[28%]">
                  Job
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[10%]">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[13%]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[18%]">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[18%]">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[13%]">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className={isPlaceholderData ? 'opacity-60' : ''}>
              {isLoading ? (
                <TableSkeleton />
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<Briefcase size={22} />}
                      title="No jobs found"
                      description={
                        isFiltered
                          ? 'Try adjusting the filters or search term.'
                          : 'Jobs will appear here once customers submit requests.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                jobs.map(job => {
                  const meta = STATUS_META[job.status] ?? { label: job.status, variant: 'default' }
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Title */}
                      <td className="px-4 py-3.5 max-w-0">
                        <p className="font-medium text-slate-800 truncate" title={job.title}>
                          {job.title}
                        </p>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        {job.category
                          ? <span className="text-slate-500 truncate block max-w-[100px]" title={job.category}>{job.category}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <Badge label={meta.label} variant={meta.variant as any} />
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5 max-w-0">
                        <span
                          className="text-slate-600 truncate block max-w-[160px]"
                          title={job.customerEmail}
                        >
                          {job.customerEmail}
                        </span>
                      </td>

                      {/* Provider */}
                      <td className="px-4 py-3.5 max-w-0">
                        {job.providerEmail
                          ? (
                            <span
                              className="text-slate-600 truncate block max-w-[160px]"
                              title={job.providerEmail}
                            >
                              {job.providerEmail}
                            </span>
                          )
                          : <span className="text-slate-300">—</span>
                        }
                      </td>

                      {/* Created date */}
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {formatDate(job.createdAt)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        <Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageSizeChange={s => { setPageSize(s); setPage(1) }}
        />
      </Card>
      )}
    </AppLayout>
  )
}
