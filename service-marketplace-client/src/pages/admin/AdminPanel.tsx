import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Users, CreditCard, ChevronDown, ChevronUp, ShieldCheck, Minus } from 'lucide-react'

import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Card, CardHeader, Badge, Button, EmptyState, SkeletonCard, Pagination } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import type { PagedResult } from '../../types'

const DEFAULT_PAGE_SIZE = 50

interface UserDto {
  id: string
  email: string
  role: string
  subTier: string
}

interface PermissionDto {
  id: number
  name: string
}

interface RolePermissionsDto {
  permissions: PermissionDto[]
  roleAssignments: Record<string, string[]>
}

interface UserPermissionOverride {
  permissionName: string
  granted: boolean
}

// ── Permission override state: true=grant, false=revoke, null=no override ──────

type OverrideState = true | false | null

/** Cycles none → grant → revoke → none */
function nextOverrideState(current: OverrideState): OverrideState {
  if (current === null)  return true
  if (current === true)  return false
  return null
}

// ── Human-readable permission labels ──────────────────────────────────────────

const PERMISSION_LABELS: Record<string, string> = {
  'request.create':     'Create Requests',
  'request.accept':     'Accept Requests',
  'request.complete':   'Complete Requests',
  'request.view_all':   'View All Requests',
  'admin.manage_users': 'Manage Users',
  'org.manage':         'Manage Organisation',
  'org.view':           'View Organisation',
}

// ── UserPermissionsPanel ──────────────────────────────────────────────────────

function UserPermissionsPanel({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const queryClient = useQueryClient()
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const { data: roleData } = useQuery<RolePermissionsDto>({
    queryKey: ['admin-role-permissions'],
    queryFn:  () => api.get('/admin/roles/permissions').then(r => r.data),
    staleTime: 60_000,
  })

  const { data: overrides = [], isLoading } = useQuery<UserPermissionOverride[]>({
    queryKey: ['user-permissions', userId],
    queryFn:  () => api.get(`/admin/users/${userId}/permissions`).then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ permissionName, granted }: { permissionName: string; granted: boolean | null }) =>
      api.patch(`/admin/users/${userId}/permissions`, { permissionName, granted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', userId] })
      toast.success('Permission updated.')
    },
    onError:   () => toast.error('Failed to update permission.'),
    onSettled: () => setUpdatingKey(null),
  })

  const permissions = roleData?.permissions ?? []

  const overrideMap = new Map<string, boolean>(
    overrides.map(o => [o.permissionName, o.granted])
  )

  const toggle = (permName: string) => {
    if (updatingKey !== null || isSelf) return
    const current: OverrideState = overrideMap.has(permName)
      ? (overrideMap.get(permName) as boolean)
      : null
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
    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Permission Overrides
        <span className="ml-2 font-normal normal-case text-slate-400">
          — overrides take precedence over the role assignment
        </span>
      </p>

      {isSelf && (
        <p className="text-xs text-amber-600 mb-3">Cannot modify your own permissions.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {permissions.map(perm => {
          const override     = overrideMap.has(perm.name) ? overrideMap.get(perm.name)! : null
          const isUpdating   = updatingKey === perm.name
          const label        = PERMISSION_LABELS[perm.name] ?? perm.name

          let btnStyle = 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          let icon: React.ReactNode = <Minus size={11} className="text-slate-300" />

          if (override === true) {
            btnStyle = 'bg-emerald-50 border-emerald-300 text-emerald-700'
            icon = (
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7L5.5 10L11.5 4" stroke="#059669" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )
          } else if (override === false) {
            btnStyle = 'bg-red-50 border-red-300 text-red-700'
            icon = (
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="#dc2626" strokeWidth="2.2"
                  strokeLinecap="round" />
              </svg>
            )
          }

          return (
            <button
              key={perm.name}
              type="button"
              disabled={isSelf || updatingKey !== null}
              onClick={() => toggle(perm.name)}
              title={
                override === null
                  ? `${label}: inheriting from role (click to grant)`
                  : override
                  ? `${label}: explicitly granted (click to revoke)`
                  : `${label}: explicitly revoked (click to remove override)`
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium
                transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60
                ${isUpdating ? 'opacity-50' : 'hover:scale-105'}
                ${btnStyle}
              `}
            >
              {isUpdating ? (
                <span className="w-2.5 h-2.5 rounded-full border-2 border-t-transparent border-current animate-spin block" />
              ) : icon}
              {label}
            </button>
          )
        })}
      </div>

      <p className="text-[10px] text-slate-400 mt-3">
        <span className="inline-flex items-center gap-1 mr-3">
          <Minus size={9} className="text-slate-300" /> inherits from role
        </span>
        <span className="text-emerald-600 mr-3">✓ explicitly granted</span>
        <span className="text-red-500">✕ explicitly revoked</span>
        <span className="ml-1 text-slate-400">— click to cycle</span>
      </p>
    </div>
  )
}

// ── AdminPanel ────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const queryClient             = useQueryClient()
  const { userId }              = useAuthStore()
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [updatingSubId, setUpdatingSubId]   = useState<string | null>(null)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<PagedResult<UserDto>>({
    queryKey: ['admin-users', page, pageSize],
    queryFn:  () => api.get('/admin/users', { params: { page, pageSize } }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const users      = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const subMutation = useMutation({
    mutationFn: ({ id, subTier }: { id: string; subTier: string }) =>
      api.patch(`/admin/users/${id}/subscription`, { subTier }),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Subscription updated.') },
    onError:    () => toast.error('Failed to update subscription.'),
    onSettled:  () => setUpdatingSubId(null),
  })

  const toggleSub = (user: UserDto) => {
    setUpdatingSubId(user.id)
    subMutation.mutate({ id: user.id, subTier: user.subTier === 'Free' ? 'Paid' : 'Free' })
  }

  const toggleExpand = (id: string) =>
    setExpandedUserId(prev => (prev === id ? null : id))

  return (
    <AppLayout title="User Management">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">User Management</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage subscriptions and per-user permission overrides. Use{' '}
          <span className="font-medium text-indigo-600">Roles &amp; Permissions</span> to control role-level access.
        </p>
      </div>

      <Card padding={false}>
        <div className="px-6 py-5 border-b border-gray-100">
          <CardHeader
            title="All Users"
            description={`${totalCount} registered user${totalCount !== 1 ? 's' : ''}`}
          />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No users found"
            description="Users will appear here once they register."
          />
        ) : (
          <>
            <div className="px-6 py-2.5 flex items-center gap-4 bg-slate-50 border-b border-slate-100">
              <div className="w-9 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">User / Role</span>
              </div>
              <div className="w-36 shrink-0 text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Subscription</span>
              </div>
              <div className="w-8 shrink-0" />
            </div>

            <ul className="divide-y divide-gray-100">
              {users.map(user => {
                const isSelf     = user.id === userId
                const isExpanded = expandedUserId === user.id

                return (
                  <li key={user.id} className={isSelf ? 'opacity-60' : ''}>
                    {/* Main row */}
                    <div className="px-6 py-3.5 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                        {user.email.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
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

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge label={user.subTier} variant={user.subTier.toLowerCase() as any} />
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={updatingSubId === user.id}
                          disabled={isSelf || updatingSubId !== null}
                          icon={<CreditCard size={13} />}
                          onClick={() => toggleSub(user)}
                          title={isSelf ? 'Cannot modify your own subscription' : undefined}
                        >
                          {user.subTier === 'Paid' ? 'Downgrade' : 'Upgrade'}
                        </Button>
                      </div>

                      {/* Expand toggle */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(user.id)}
                        title={isExpanded ? 'Hide permissions' : 'Manage permissions'}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                      >
                        {isExpanded
                          ? <ChevronUp size={15} />
                          : <ChevronDown size={15} />
                        }
                      </button>
                    </div>

                    {/* Permission overrides panel */}
                    {isExpanded && (
                      <UserPermissionsPanel userId={user.id} isSelf={isSelf} />
                    )}
                  </li>
                )
              })}
            </ul>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={p => setPage(p)}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageSizeChange={s => { setPageSize(s); setPage(1) }}
            />
          </>
        )}
      </Card>

      {/* Legend */}
      <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
        <ShieldCheck size={14} className="shrink-0 mt-0.5 text-slate-400" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Click the <strong>chevron</strong> next to any user to manage per-user permission overrides.
          Overrides take precedence over the role's default permissions — granting gives a user extra access,
          revoking removes access even if their role has it. Changes take effect immediately.
        </p>
      </div>
    </AppLayout>
  )
}
