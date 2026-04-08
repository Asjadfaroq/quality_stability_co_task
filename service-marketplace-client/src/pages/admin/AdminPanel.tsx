import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Users, ChevronDown, ChevronUp, ShieldCheck,
  Trash2, AlertTriangle, Search, X, TrendingUp, TrendingDown,
} from 'lucide-react'

import api from '../../api/axios'
import { usePagination } from '../../hooks/usePagination'
import AppLayout from '../../components/AppLayout'
import { Card, Badge, EmptyState, SkeletonCard, Pagination } from '../../components/ui'
import {
  PermissionToggleGrid,
  nextOverrideState,
  type PermissionDto,
  type PermissionOverride,
  type OverrideState,
} from '../../components/PermissionToggleGrid'
import { apiErrorMessage } from '../../utils/format'
import { useAuthStore } from '../../store/authStore'
import type { PagedResult } from '../../types'

const DEFAULT_PAGE_SIZE = 50

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserDto {
  id: string
  email: string
  role: string
  subTier: string
}

interface RolePermissionsDto {
  permissions: PermissionDto[]
  roleAssignments: Record<string, string[]>
}

// ── Constants ─────────────────────────────────────────────────────────────────

interface RoleTab {
  value: string
  label: string
}

const ROLE_TABS: RoleTab[] = [
  { value: '',                 label: 'All'               },
  { value: 'Customer',         label: 'Customer'          },
  { value: 'ProviderAdmin',    label: 'Provider Admin'    },
  { value: 'ProviderEmployee', label: 'Provider Employee' },
]

const ROLE_AVATAR: Record<string, { bg: string; color: string }> = {
  Customer:         { bg: '#EEF2FF', color: '#6366f1' },
  ProviderAdmin:    { bg: '#ECFDF5', color: '#10b981' },
  ProviderEmployee: { bg: '#FFFBEB', color: '#f59e0b' },
  Admin:            { bg: '#FEF2F2', color: '#dc2626' },
}
const DEFAULT_AVATAR = { bg: '#F1F5F9', color: '#64748b' }

// ── UserPermissionsPanel ──────────────────────────────────────────────────────

function UserPermissionsPanel({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const queryClient = useQueryClient()
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const { data: roleData } = useQuery<RolePermissionsDto>({
    queryKey: ['admin-role-permissions'],
    queryFn:  () => api.get('/admin/roles/permissions').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: overrides = [], isLoading } = useQuery<PermissionOverride[]>({
    queryKey: ['user-permissions', userId],
    queryFn:  () => api.get(`/admin/users/${userId}/permissions`).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ permissionName, granted }: { permissionName: string; granted: boolean | null }) =>
      api.patch(`/admin/users/${userId}/permissions`, { permissionName, granted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] })
      toast.success('Permission updated.')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to update permission.')),
    onSettled: () => setUpdatingKey(null),
  })

  const handleToggle = (permName: string) => {
    if (isSelf || updatingKey !== null) return
    const current: OverrideState = overrides.find((o) => o.permissionName === permName)?.granted ?? null
    const next = nextOverrideState(current)
    setUpdatingKey(permName)
    mutation.mutate({ permissionName: permName, granted: next })
  }

  if (isLoading) {
    return (
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
        <div className="h-4 bg-slate-200 rounded animate-pulse w-48" />
      </div>
    )
  }

  return (
    <PermissionToggleGrid
      permissions={roleData?.permissions ?? []}
      overrides={overrides}
      updatingKey={updatingKey}
      disabled={isSelf}
      disabledReason="Cannot modify your own permissions."
      onToggle={handleToggle}
    />
  )
}

// ── ConfirmDeleteModal ────────────────────────────────────────────────────────

interface ConfirmDeleteModalProps {
  user: UserDto
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDeleteModal({ user, isDeleting, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  const deletionEffects = [
    'User account and login credentials',
    'All service requests submitted as customer',
    'Chat messages on those requests',
    user.role === 'ProviderAdmin'
      ? 'Owned organization (members will be detached)'
      : 'Organization membership',
    'Permission overrides and billing data',
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ border: '1px solid #E2E8F0' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(239,68,68,0.1)' }}
            >
              <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-slate-900">Delete user account?</h2>
              <p className="text-[13px] text-slate-500 mt-0.5 break-all">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-5">
          <p className="text-[13px] text-slate-600 leading-relaxed mb-3">
            This action is <strong>permanent and irreversible</strong>. The following will be deleted:
          </p>
          <ul className="space-y-1.5 mb-4">
            {deletionEffects.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[12px] text-slate-500">
                <span className="mt-0.5 shrink-0" style={{ color: '#ef4444' }}>•</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400">
            Jobs accepted by this user as a provider will remain, with the provider field cleared.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white flex items-center gap-2 transition-colors disabled:opacity-60"
            style={{ background: isDeleting ? '#fca5a5' : '#ef4444' }}
          >
            {isDeleting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 size={13} />
                Delete permanently
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AdminPanel ────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const queryClient             = useQueryClient()
  const { userId }              = useAuthStore()
  const { page, pageSize, setPage, setPageSize } = usePagination(DEFAULT_PAGE_SIZE)
  const [roleFilter, setRoleFilter]               = useState('')
  const [searchInput, setSearchInput]             = useState('')
  const [search, setSearch]                       = useState('')
  const [updatingSubId, setUpdatingSubId]         = useState<string | null>(null)
  const [expandedUserId, setExpandedUserId]       = useState<string | null>(null)
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserDto | null>(null)

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(id)
  }, [searchInput])

  // Reset to page 1 on filter/search changes
  useEffect(() => { setPage(1) }, [roleFilter, search])

  const { data, isLoading } = useQuery<PagedResult<UserDto>>({
    queryKey: ['admin-users', page, pageSize, roleFilter, search],
    queryFn:  () => api.get('/admin/users', {
      params: {
        page,
        pageSize,
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(search     ? { search }           : {}),
      },
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
    // Keep each tab's data fresh for 30 s — switching back to a recently-loaded
    // tab is instant (served from cache) instead of firing a new API request.
    staleTime: 30_000,
  })

  const users      = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const subMutation = useMutation({
    mutationFn: ({ id, subTier }: { id: string; subTier: string }) =>
      api.patch(`/admin/users/${id}/subscription`, { subTier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Subscription updated.')
    },
    onError:   () => toast.error('Failed to update subscription.'),
    onSettled: () => setUpdatingSubId(null),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User deleted successfully.')
      setPendingDeleteUser(null)
      setExpandedUserId((prev) => (prev === deletedId ? null : prev))
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to delete user.'))
      setPendingDeleteUser(null)
    },
  })

  const toggleSub = (user: UserDto) => {
    setUpdatingSubId(user.id)
    subMutation.mutate({ id: user.id, subTier: user.subTier === 'Free' ? 'Paid' : 'Free' })
  }

  const toggleExpand = (id: string) =>
    setExpandedUserId((prev) => (prev === id ? null : id))

  const isFiltered = !!roleFilter || !!search

  return (
    <AppLayout title="User Management">

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage subscriptions and per-user permission overrides.
          </p>
        </div>
      </div>

      <Card padding={false}>

        {/* ── Toolbar ───────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">

          {/* Role filter tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setRoleFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${
                  roleFilter === tab.value
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search input */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by email…"
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

        {/* ── Result count bar ───────────────────────────────────────────────── */}
        {!isLoading && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100">
            <span className="text-[11px] text-slate-500">
              {totalCount === 0
                ? isFiltered ? 'No users match the current filters.' : 'No users registered yet.'
                : <>{totalCount} user{totalCount !== 1 ? 's' : ''}{isFiltered ? ' match the current filters' : ''}</>
              }
            </span>
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>

        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No users found"
            description={isFiltered ? 'Try adjusting the filters or search term.' : 'Users will appear here once they register.'}
          />

        ) : (
          <>
            {/* Column headers */}
            <div className="px-6 py-2.5 grid grid-cols-[36px_1fr_auto_32px_32px] gap-4 items-center bg-white border-b border-slate-100">
              <div />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                User / Role
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right pr-2">
                Subscription
              </span>
              <div />
              <div />
            </div>

            <ul className="divide-y divide-slate-100">
              {users.map((user) => {
                const isSelf     = user.id === userId
                const isExpanded = expandedUserId === user.id
                const avatar     = ROLE_AVATAR[user.role] ?? DEFAULT_AVATAR
                const isPaid     = user.subTier === 'Paid'

                return (
                  <li key={user.id} className={isSelf ? 'opacity-60' : ''}>

                    {/* ── Main row ── */}
                    <div
                      className={`px-6 py-4 grid grid-cols-[36px_1fr_auto_32px_32px] gap-4 items-center transition-colors ${
                        isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none"
                        style={{ background: avatar.bg, color: avatar.color }}
                      >
                        {user.email.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Email + role badge */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-800 truncate">{user.email}</p>
                          {isSelf && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 uppercase tracking-wide">
                              You
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          <Badge label={user.role} variant={user.role.toLowerCase() as any} />
                        </div>
                      </div>

                      {/* Subscription badge + upgrade/downgrade */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge label={user.subTier} variant={user.subTier.toLowerCase() as any} />
                        {!isSelf && (
                          <button
                            type="button"
                            disabled={updatingSubId !== null}
                            onClick={() => toggleSub(user)}
                            title={isPaid ? 'Downgrade to Free' : 'Upgrade to Paid'}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                              isPaid
                                ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                                : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            {updatingSubId === user.id ? (
                              <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            ) : isPaid ? (
                              <TrendingDown size={11} />
                            ) : (
                              <TrendingUp size={11} />
                            )}
                            {isPaid ? 'Downgrade' : 'Upgrade'}
                          </button>
                        )}
                      </div>

                      {/* Delete button */}
                      {!isSelf && user.role !== 'Admin' ? (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteUser(user)}
                          title="Delete user"
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-red-300 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <div className="w-8 h-8 shrink-0" />
                      )}

                      {/* Expand permissions toggle */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(user.id)}
                        title={isExpanded ? 'Hide permissions' : 'Manage permissions'}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${
                          isExpanded
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>

                    {/* Permissions panel */}
                    {isExpanded && <UserPermissionsPanel userId={user.id} isSelf={isSelf} />}
                  </li>
                )
              })}
            </ul>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>

      {/* Legend */}
      <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
        <ShieldCheck size={14} className="shrink-0 mt-0.5 text-indigo-400" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Click the <strong className="text-slate-700">chevron</strong> next to any user to manage per-user permission overrides.
          Overrides take precedence over the role's default permissions — granting gives extra access,
          revoking removes access even if the role has it. Changes take effect immediately.
        </p>
      </div>

      {/* Delete confirmation modal */}
      {pendingDeleteUser && (
        <ConfirmDeleteModal
          user={pendingDeleteUser}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDeleteUser.id)}
          onCancel={() => { if (!deleteMutation.isPending) setPendingDeleteUser(null) }}
        />
      )}
    </AppLayout>
  )
}
