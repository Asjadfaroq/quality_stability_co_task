import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldCheck, Lock } from 'lucide-react'

import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Card, CardHeader, SkeletonCard } from '../../components/ui'

// ── Static display metadata ───────────────────────────────────────────────────

const PERMISSION_META: Record<string, { label: string; description: string }> = {
  'request.create':    { label: 'Create Requests',     description: 'Submit new service requests' },
  'request.accept':    { label: 'Accept Requests',     description: 'Accept pending requests from customers' },
  'request.complete':  { label: 'Complete Requests',   description: 'Mark requests as done and view history' },
  'request.view_all':  { label: 'View All Requests',   description: 'Browse every request on the platform' },
  'admin.manage_users':{ label: 'Manage Users',        description: 'Access admin panel and update subscriptions' },
  'org.manage':        { label: 'Manage Organisation', description: 'Create org, add/remove members' },
  'org.view':          { label: 'View Organisation',   description: 'View the organisation they belong to' },
}

const ROLE_META: Record<string, { label: string; accent: string; bg: string; border: string }> = {
  Customer:         { label: 'Customer',          accent: '#6366f1', bg: '#EEF2FF', border: '#C7D2FE' },
  ProviderAdmin:    { label: 'Provider Admin',    accent: '#10b981', bg: '#ECFDF5', border: '#A7F3D0' },
  ProviderEmployee: { label: 'Provider Employee', accent: '#f59e0b', bg: '#FFFBEB', border: '#FDE68A' },
}

// Admin is always unrestricted — it is shown as a read-only locked column.
const EDITABLE_ROLES = ['Customer', 'ProviderAdmin', 'ProviderEmployee']

// ── Types ─────────────────────────────────────────────────────────────────────

interface PermissionDto   { id: number; name: string }
interface RolePermissionsDto {
  permissions:     PermissionDto[]
  roleAssignments: Record<string, string[]>
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminRoles() {
  const queryClient = useQueryClient()
  // Track which cell is in-flight as "role:permissionName"
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const { data, isLoading } = useQuery<RolePermissionsDto>({
    queryKey: ['admin-role-permissions'],
    queryFn:  () => api.get('/admin/roles/permissions').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ role, permissionName, granted }: { role: string; permissionName: string; granted: boolean }) =>
      api.patch(`/admin/roles/${role}/permissions`, { permissionName, granted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-role-permissions'] })
      toast.success('Permission updated.')
    },
    onError:   () => toast.error('Failed to update permission.'),
    onSettled: () => setUpdatingKey(null),
  })

  const toggle = (role: string, permissionName: string, currentlyGranted: boolean) => {
    if (updatingKey !== null) return // one in-flight at a time
    setUpdatingKey(`${role}:${permissionName}`)
    mutation.mutate({ role, permissionName, granted: !currentlyGranted })
  }

  const permissions = data?.permissions     ?? []
  const assignments = data?.roleAssignments ?? {}

  return (
    <AppLayout title="Roles & Permissions">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Roles &amp; Permissions</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Check a cell to grant a permission to a role; uncheck to revoke it.
          Changes propagate to active sessions within 5 minutes.
        </p>
      </div>

      {/* Admin notice */}
      <div
        className="mb-5 flex items-start gap-3 px-4 py-3.5 rounded-xl"
        style={{ background: '#F0F4FF', border: '1px solid #C7D2FE' }}
      >
        <Lock size={14} className="shrink-0 mt-0.5" style={{ color: '#4F46E5' }} />
        <p className="text-[12px] text-indigo-700 leading-relaxed">
          <span className="font-semibold">Admin</span> is not listed — Admin accounts always have
          unrestricted access regardless of this matrix.
        </p>
      </div>

      <Card padding={false}>
        <div className="px-6 py-5 border-b border-gray-100">
          <CardHeader
            title="Permission Matrix"
            description="Rows are permissions, columns are roles."
          />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {/* Permission column */}
                  <th
                    className="px-6 py-4 text-left sticky left-0 z-10 bg-slate-50"
                    style={{ minWidth: 260, borderBottom: '1px solid #E2E8F0' }}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-slate-400" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Permission
                      </span>
                    </div>
                  </th>

                  {/* Editable role columns */}
                  {EDITABLE_ROLES.map(role => {
                    const m = ROLE_META[role]
                    return (
                      <th
                        key={role}
                        className="px-6 py-4 text-center"
                        style={{ minWidth: 160, borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}
                      >
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: m.bg, color: m.accent, border: `1px solid ${m.border}` }}
                        >
                          {m.label}
                        </span>
                      </th>
                    )
                  })}

                  {/* Admin — read-only */}
                  <th
                    className="px-6 py-4 text-center"
                    style={{ minWidth: 130, borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}
                  >
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1' }}
                    >
                      <Lock size={10} />
                      Admin
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {permissions.map((perm, idx) => {
                  const meta   = PERMISSION_META[perm.name]
                  const isLast = idx === permissions.length - 1

                  return (
                    <tr
                      key={perm.name}
                      className="hover:bg-slate-50/60 transition-colors"
                      style={{ borderBottom: isLast ? 'none' : '1px solid #F1F5F9' }}
                    >
                      {/* Permission label */}
                      <td className="px-6 py-4 sticky left-0 bg-white hover:bg-slate-50/60 z-10">
                        <p className="text-[13px] font-semibold text-slate-800">
                          {meta?.label ?? perm.name}
                        </p>
                        {meta?.description && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{meta.description}</p>
                        )}
                        <p className="text-[10px] font-mono text-slate-300 mt-1">{perm.name}</p>
                      </td>

                      {/* Editable cells */}
                      {EDITABLE_ROLES.map(role => {
                        const granted    = (assignments[role] ?? []).includes(perm.name)
                        const key        = `${role}:${perm.name}`
                        const isUpdating = updatingKey === key
                        const m          = ROLE_META[role]

                        return (
                          <td key={role} className="px-6 py-4 text-center">
                            <button
                              type="button"
                              disabled={updatingKey !== null}
                              onClick={() => toggle(role, perm.name, granted)}
                              className={`w-9 h-9 rounded-xl border-2 inline-flex items-center justify-center transition-all
                                ${isUpdating ? 'opacity-50 cursor-wait' : 'hover:scale-105 cursor-pointer'}
                                ${granted ? 'border-transparent' : 'border-slate-200 bg-white hover:border-slate-300'}
                              `}
                              style={granted ? { background: m.bg, borderColor: m.border } : {}}
                              title={`${granted ? 'Revoke' : 'Grant'} "${meta?.label ?? perm.name}" from ${m.label}`}
                            >
                              {isUpdating ? (
                                <span
                                  className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin block"
                                  style={{ borderColor: `${m.accent} transparent transparent transparent` }}
                                />
                              ) : granted ? (
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                  <path d="M2.5 7L5.5 10L11.5 4" stroke={m.accent} strokeWidth="2"
                                    strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : (
                                <span className="w-3 h-3 rounded border border-slate-300 block" />
                              )}
                            </button>
                          </td>
                        )
                      })}

                      {/* Admin — always locked */}
                      <td className="px-6 py-4 text-center">
                        <div
                          className="w-9 h-9 rounded-xl inline-flex items-center justify-center"
                          style={{ background: '#F1F5F9', border: '2px solid #CBD5E1' }}
                          title="Admin always has this permission"
                        >
                          <Lock size={12} className="text-slate-400" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppLayout>
  )
}
