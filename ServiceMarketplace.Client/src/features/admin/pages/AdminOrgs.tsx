import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Search, X, Users } from 'lucide-react'

import api from '../../../shared/api/axios'
import { formatDate } from '../../../shared/utils/format'
import { usePagination } from '../../../shared/hooks/usePagination'
import AppLayout from '../../../shared/components/AppLayout'
import { Card, EmptyState, Skeleton, Pagination } from '../../../shared/components/ui'
import type { PagedResult } from '../../../shared/types/index'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminOrgDto {
  id: string
  name: string
  ownerId: string
  ownerEmail: string
  memberCount: number
  createdAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 10

// ── Sub-components ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-44" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-40" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-10" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
        </tr>
      ))}
    </>
  )
}

// ── AdminOrgs ─────────────────────────────────────────────────────────────────

export default function AdminOrgs() {
  const { page, pageSize, setPage, setPageSize } = usePagination(DEFAULT_PAGE_SIZE)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')

  // 350 ms debounce — only commit to `search` (query key) after the user pauses.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(id)
  }, [searchInput])

  // Reset to page 1 when the search term changes.
  useEffect(() => { setPage(1) }, [search, setPage])

  const { data, isLoading, isPlaceholderData } = useQuery<PagedResult<AdminOrgDto>>({
    queryKey: ['admin-orgs', page, pageSize, search],
    queryFn: () =>
      api.get('/admin/orgs', {
        params: {
          page,
          pageSize,
          ...(search ? { search } : {}),
        },
      }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const orgs       = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  return (
    <AppLayout title="All Organisations">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">All Organisations</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Platform-wide list of every provider organisation, their admin, and member count.
        </p>
      </div>

      <Card padding={false}>
        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[13px] text-slate-500 shrink-0">
            {!isLoading && (
              totalCount === 0
                ? (search ? 'No organisations match.' : 'No organisations yet.')
                : <>{totalCount} organisation{totalCount !== 1 ? 's' : ''}{search ? ' match' : ''}</>
            )}
          </p>

          {/* Search */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search name or admin email…"
              className="w-full pl-8 pr-8 py-2 rounded-lg border border-slate-200 text-[13px]
                         text-slate-800 placeholder:text-slate-400 bg-white
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

        {/* ── Mobile cards ──────────────────────────────────────────────── */}
        <div className={`sm:hidden p-4 space-y-3 ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-52" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))
          ) : orgs.length === 0 ? (
            <EmptyState
              icon={<Building2 size={22} />}
              title="No organisations found"
              description={
                search
                  ? 'Try a different name or email.'
                  : 'Organisations will appear here once provider admins create them.'
              }
            />
          ) : (
            orgs.map(org => (
              <div key={org.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold select-none"
                    style={{
                      background: 'rgba(99,102,241,0.1)',
                      color: '#6366f1',
                    }}
                  >
                    {org.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Organisation</p>
                    <p className="font-medium text-slate-800 break-words">{org.name}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-slate-500">Admin</p>
                  <p className="text-sm text-slate-700 break-all">{org.ownerEmail}</p>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Users size={13} className="text-slate-400 shrink-0" />
                    <span>{org.memberCount} members</span>
                  </div>
                  <span className="text-slate-500">{formatDate(org.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Desktop table ─────────────────────────────────────────────── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-white">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[35%]">
                  Organisation
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[35%]">
                  Admin
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[15%]">
                  Members
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[15%]">
                  Created
                </th>
              </tr>
            </thead>

            <tbody className={isPlaceholderData ? 'opacity-60' : ''}>
              {isLoading ? (
                <TableSkeleton />
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={<Building2 size={22} />}
                      title="No organisations found"
                      description={
                        search
                          ? 'Try a different name or email.'
                          : 'Organisations will appear here once provider admins create them.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                orgs.map(org => (
                  <tr
                    key={org.id}
                    className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Org name */}
                    <td className="px-4 py-3.5 max-w-0">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold select-none"
                          style={{
                            background: 'rgba(99,102,241,0.1)',
                            color: '#6366f1',
                          }}
                        >
                          {org.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span
                          className="font-medium text-slate-800 truncate"
                          title={org.name}
                        >
                          {org.name}
                        </span>
                      </div>
                    </td>

                    {/* Owner email */}
                    <td className="px-4 py-3.5 max-w-0">
                      <span
                        className="text-slate-600 truncate block max-w-[240px]"
                        title={org.ownerEmail}
                      >
                        {org.ownerEmail}
                      </span>
                    </td>

                    {/* Member count */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Users size={13} className="text-slate-400 shrink-0" />
                        <span>{org.memberCount}</span>
                      </div>
                    </td>

                    {/* Created date */}
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      {formatDate(org.createdAt)}
                    </td>
                  </tr>
                ))
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
          onPageSizeChange={setPageSize}
        />
      </Card>
    </AppLayout>
  )
}
