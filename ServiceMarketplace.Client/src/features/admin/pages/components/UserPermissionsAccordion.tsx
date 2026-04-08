import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronUp, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import api from '../../../../shared/api/axios'
import { Badge } from '../../../../shared/components/ui'
import type { BadgeVariant } from '../../../../shared/components/ui'
import {
  PermissionToggleGrid,
  nextOverrideState,
  type PermissionDto,
  type PermissionOverride,
  type OverrideState,
} from '../../../../shared/components/PermissionToggleGrid'
import { apiErrorMessage } from '../../../../shared/utils/format'

interface RolePermissionsDto {
  permissions: PermissionDto[]
  roleAssignments: Record<string, string[]>
}

export interface AdminUserRow {
  id: string
  email: string
  role: string
  subTier: string
}

interface Props {
  user: AdminUserRow
  userId: string | null
  isExpanded: boolean
  isUpdatingSub: boolean
  onToggleExpand: (id: string) => void
  onToggleSub: (user: AdminUserRow) => void
  onDelete: (user: AdminUserRow) => void
  roleAvatar: Record<string, { bg: string; color: string }>
  defaultAvatar: { bg: string; color: string }
}

const USER_ROLES = ['Admin', 'ProviderAdmin', 'ProviderEmployee', 'Customer'] as const

const toBadgeVariant = (value: string): BadgeVariant => {
  const normalized = value.toLowerCase().replace(/\s/g, '')
  return normalized as BadgeVariant
}

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

export function UserPermissionsAccordion({
  user,
  userId,
  isExpanded,
  isUpdatingSub,
  onToggleExpand,
  onToggleSub,
  onDelete,
  roleAvatar,
  defaultAvatar,
}: Props) {
  const queryClient = useQueryClient()
  const isSelf = user.id === userId
  const avatar = roleAvatar[user.role] ?? defaultAvatar
  const isPaid = user.subTier === 'Paid'

  const [updatingRole, setUpdatingRole] = useState(false)
  const roleMutation = useMutation({
    mutationFn: (role: string) =>
      api.patch(`/admin/users/${user.id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user.id] })
      toast.success('User role updated.')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to update role.')),
    onSettled: () => setUpdatingRole(false),
  })

  const handleRoleChange = (nextRole: string) => {
    if (isSelf || roleMutation.isPending || nextRole === user.role) return
    setUpdatingRole(true)
    roleMutation.mutate(nextRole)
  }

  return (
    <li className={isSelf ? 'opacity-60' : ''}>
      <div
        className={`px-6 py-4 grid grid-cols-[36px_1fr_auto_32px_32px] gap-4 items-center transition-colors ${
          isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'
        }`}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none"
          style={{ background: avatar.bg, color: avatar.color }}
        >
          {user.email.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-800 truncate">{user.email}</p>
            {isSelf && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 uppercase tracking-wide">
                You
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge label={user.role} variant={toBadgeVariant(user.role)} />
            {!isSelf && (
              <select
                value={user.role}
                disabled={updatingRole || roleMutation.isPending}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                title="Assign role"
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge label={user.subTier} variant={toBadgeVariant(user.subTier)} />
          {!isSelf && (
            <button
              type="button"
              disabled={isUpdatingSub}
              onClick={() => onToggleSub(user)}
              title={isPaid ? 'Downgrade to Free' : 'Upgrade to Paid'}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isPaid
                  ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                  : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              {isUpdatingSub ? (
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

        {!isSelf && user.role !== 'Admin' ? (
          <button
            type="button"
            onClick={() => onDelete(user)}
            title="Delete user"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-red-300 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 size={14} />
          </button>
        ) : (
          <div className="w-8 h-8 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => onToggleExpand(user.id)}
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

      {isExpanded && <UserPermissionsPanel userId={user.id} isSelf={isSelf} />}
    </li>
  )
}
