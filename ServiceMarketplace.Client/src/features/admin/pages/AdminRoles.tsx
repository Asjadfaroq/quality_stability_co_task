import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldCheck, Lock, Loader2 } from 'lucide-react'

import api from '../../../shared/api/axios'
import { PERMISSIONS } from '../../../shared/constants/permissions'
import AppLayout from '../../../shared/components/AppLayout'

// ── Static display metadata ───────────────────────────────────────────────────

const PERMISSION_META: Record<string, { label: string; description: string }> = {
  [PERMISSIONS.REQUEST_CREATE]:     { label: 'Create Requests',     description: 'Submit new service requests' },
  [PERMISSIONS.REQUEST_ACCEPT]:     { label: 'Accept Requests',     description: 'Accept pending requests from customers' },
  [PERMISSIONS.REQUEST_COMPLETE]:   { label: 'Complete Requests',   description: 'Mark requests as done and view history' },
  [PERMISSIONS.REQUEST_VIEW_ALL]:   { label: 'View All Requests',   description: 'Browse every request on the platform' },
  [PERMISSIONS.ADMIN_MANAGE_USERS]: { label: 'Manage Users',        description: 'Access admin panel and update subscriptions' },
  [PERMISSIONS.ORG_MANAGE]:         { label: 'Manage Organisation', description: 'Create org, add/remove members' },
  [PERMISSIONS.ORG_VIEW]:           { label: 'View Organisation',   description: 'View the organisation they belong to' },
}

const ROLE_META: Record<string, { label: string; accent: string; bg: string; border: string; track: string }> = {
  Customer:         { label: 'Customer',          accent: '#6366f1', bg: '#EEF2FF', border: '#C7D2FE', track: '#6366f1' },
  ProviderAdmin:    { label: 'Provider Admin',    accent: '#10b981', bg: '#ECFDF5', border: '#A7F3D0', track: '#10b981' },
  ProviderEmployee: { label: 'Provider Employee', accent: '#f59e0b', bg: '#FFFBEB', border: '#FDE68A', track: '#f59e0b' },
}

const EDITABLE_ROLES = ['Customer', 'ProviderAdmin', 'ProviderEmployee']

// ── Types ─────────────────────────────────────────────────────────────────────

interface PermissionDto      { id: number; name: string }
interface RolePermissionsDto {
  permissions:     PermissionDto[]
  roleAssignments: Record<string, string[]>
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

interface ToggleProps {
  checked:   boolean
  loading:   boolean
  disabled:  boolean
  color:     string
  onToggle:  () => void
  title?:    string
}

function Toggle({ checked, loading, disabled, color, onToggle, title }: ToggleProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onToggle}
      className="relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none"
      style={{
        width: 36, height: 20,
        background:  checked ? color : '#cbd5e1',
        opacity:     disabled && !loading ? 0.5 : 1,
        cursor:      disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="absolute flex items-center justify-center bg-white rounded-full shadow transition-transform duration-200"
        style={{
          width: 16, height: 16,
          transform: checked ? 'translateX(18px)' : 'translateX(2px)',
        }}
      >
        {loading && (
          <Loader2
            size={9}
            className="animate-spin"
            style={{ color }}
          />
        )}
      </span>
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminRoles() {
  const queryClient = useQueryClient()
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
    if (updatingKey !== null) return
    setUpdatingKey(`${role}:${permissionName}`)
    mutation.mutate({ role, permissionName, granted: !currentlyGranted })
  }

  const permissions = data?.permissions     ?? []
  const assignments = data?.roleAssignments ?? {}

  return (
    <AppLayout title="Roles & Permissions">
      {/* Full-height no-scroll layout */}
      <div className="h-full flex flex-col gap-4">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Roles &amp; Permissions</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Toggle a cell to grant or revoke a permission. Changes propagate within 5 minutes.
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium text-indigo-700 border border-indigo-200 self-start"
            style={{ background: '#eef2ff' }}
          >
            <Lock size={12} className="shrink-0" />
            Admin always has unrestricted access
          </div>
        </div>

        {/* ── Matrix card ──────────────────────────────────────────────────── */}
        <div
          className="flex-1 min-h-0 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden"
          style={{ boxShadow: '0 1px 8px rgba(15,23,42,0.06)' }}
        >
          {/* Mobile card layout */}
          <div className="sm:hidden flex-1 overflow-y-auto p-3 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={24} className="animate-spin text-slate-300" />
              </div>
            ) : (
              permissions.map((perm) => {
                const meta = PERMISSION_META[perm.name]
                return (
                  <div key={perm.name} className="rounded-xl border border-slate-200 p-3.5">
                    <p className="text-[13px] font-semibold text-slate-800 leading-tight">
                      {meta?.label ?? perm.name}
                    </p>
                    {meta?.description && (
                      <p className="text-[11.5px] text-slate-400 mt-0.5 leading-snug">
                        {meta.description}
                      </p>
                    )}
                    <div className="mt-3 space-y-2">
                      {EDITABLE_ROLES.map(role => {
                        const granted = (assignments[role] ?? []).includes(perm.name)
                        const key = `${role}:${perm.name}`
                        const isUpdating = updatingKey === key
                        const m = ROLE_META[role]
                        return (
                          <div key={role} className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: m.accent }}>{m.label}</span>
                            <Toggle
                              checked={granted}
                              loading={isUpdating}
                              disabled={updatingKey !== null}
                              color={m.track}
                              onToggle={() => toggle(role, perm.name, granted)}
                              title={`${granted ? 'Revoke' : 'Grant'} "${meta?.label ?? perm.name}" for ${m.label}`}
                            />
                          </div>
                        )
                      })}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Admin</span>
                        <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Always allowed</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Column header row */}
          <div
            className="hidden sm:grid shrink-0 border-b border-slate-100"
            style={{ gridTemplateColumns: '1fr 120px 132px 148px 100px' }}
          >
            {/* Permission column */}
            <div className="flex items-center gap-2 px-6 py-3.5">
              <ShieldCheck size={13} className="text-slate-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Permission
              </span>
            </div>

            {/* Editable role columns */}
            {EDITABLE_ROLES.map(role => {
              const m = ROLE_META[role]
              return (
                <div key={role} className="flex items-center justify-center px-3 py-3.5" style={{ background: '#fafbfc' }}>
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                    style={{ background: m.bg, color: m.accent, border: `1px solid ${m.border}` }}
                  >
                    {m.label}
                  </span>
                </div>
              )
            })}

            {/* Admin column */}
            <div className="flex items-center justify-center px-3 py-3.5" style={{ background: '#fafbfc' }}>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }}
              >
                <Lock size={9} />
                Admin
              </span>
            </div>
          </div>

          {/* Table body */}
          <div className="hidden sm:block flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-slate-300" />
              </div>
            ) : (
              permissions.map((perm, idx) => {
                const meta   = PERMISSION_META[perm.name]
                const isLast = idx === permissions.length - 1

                return (
                  <div
                    key={perm.name}
                    className="grid items-center hover:bg-slate-50/70 transition-colors"
                    style={{
                      gridTemplateColumns: '1fr 120px 132px 148px 100px',
                      borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                    }}
                  >
                    {/* Permission info */}
                    <div className="px-6 py-4">
                      <p className="text-[13px] font-semibold text-slate-800 leading-tight">
                        {meta?.label ?? perm.name}
                      </p>
                      {meta?.description && (
                        <p className="text-[11.5px] text-slate-400 mt-0.5 leading-snug">
                          {meta.description}
                        </p>
                      )}
                    </div>

                    {/* Editable role toggles */}
                    {EDITABLE_ROLES.map(role => {
                      const granted    = (assignments[role] ?? []).includes(perm.name)
                      const key        = `${role}:${perm.name}`
                      const isUpdating = updatingKey === key
                      const m          = ROLE_META[role]

                      return (
                        <div key={role} className="flex items-center justify-center px-3 py-4">
                          <Toggle
                            checked={granted}
                            loading={isUpdating}
                            disabled={updatingKey !== null}
                            color={m.track}
                            onToggle={() => toggle(role, perm.name, granted)}
                            title={`${granted ? 'Revoke' : 'Grant'} "${meta?.label ?? perm.name}" for ${m.label}`}
                          />
                        </div>
                      )
                    })}

                    {/* Admin — always locked */}
                    <div className="flex items-center justify-center px-3 py-4">
                      <div
                        className="inline-flex items-center justify-center rounded-full"
                        style={{
                          width: 36, height: 20,
                          background: '#6366f1',
                        }}
                        title="Admin always has this permission"
                      >
                        <span
                          className="bg-white rounded-full shadow"
                          style={{ width: 16, height: 16, transform: 'translateX(9px)' }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5"
               style={{ background: '#fafbfc' }}>
            <p className="text-[11px] text-slate-400">
              {permissions.length} permissions · {EDITABLE_ROLES.length + 1} roles
            </p>
            <p className="text-[11px] text-slate-400">
              Changes propagate to active sessions within 5 minutes
            </p>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}
