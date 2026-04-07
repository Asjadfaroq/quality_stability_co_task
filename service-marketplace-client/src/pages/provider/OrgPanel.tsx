import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Users, Building2, UserPlus, UserMinus, ChevronDown, ChevronUp, Minus } from 'lucide-react'

import api, { isRateLimited } from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Card, CardHeader, Badge, Button, Input, EmptyState, Pagination, SkeletonCard } from '../../components/ui'
import type { PagedResult } from '../../types'

const DEFAULT_PAGE_SIZE = 20

// ── Types ─────────────────────────────────────────────────────────────────────

interface Org {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

interface OrgMember {
  id: string
  email: string
  role: string
}

interface UserPermissionOverride {
  permissionName: string
  granted: boolean
}

interface PermissionDto {
  id: number
  name: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as { response?: { data?: { message?: string } } }
    return e.response?.data?.message ?? fallback
  }
  return fallback
}

// 3-state override cycle: null → true → false → null
type OverrideState = true | false | null
function nextOverrideState(current: OverrideState): OverrideState {
  if (current === null) return true
  if (current === true) return false
  return null
}

const PERMISSION_LABELS: Record<string, string> = {
  'request.create':     'Create Requests',
  'request.accept':     'Accept Requests',
  'request.complete':   'Complete Requests',
  'request.view_all':   'View All Requests',
  'admin.manage_users': 'Manage Users',
  'org.manage':         'Manage Organisation',
  'org.view':           'View Organisation',
}

// ── MemberPermissionsPanel ────────────────────────────────────────────────────

function MemberPermissionsPanel({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient()
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const { data: allPermissions = [] } = useQuery<PermissionDto[]>({
    queryKey: ['org-permissions'],
    queryFn:  () => api.get('/org/permissions').then(r => r.data),
    staleTime: 60_000,
  })

  const { data: overrides = [], isLoading } = useQuery<UserPermissionOverride[]>({
    queryKey: ['org-member-permissions', memberId],
    queryFn:  () => api.get(`/org/members/${memberId}/permissions`).then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ permissionName, granted }: { permissionName: string; granted: boolean | null }) =>
      api.patch(`/org/members/${memberId}/permissions`, { permissionName, granted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-member-permissions', memberId] })
      toast.success('Permission updated.')
    },
    onError: err => {
      if (!isRateLimited(err)) toast.error(apiErrorMessage(err, 'Failed to update permission.'))
    },
    onSettled: () => setUpdatingKey(null),
  })

  const permissions  = allPermissions
  const overrideMap  = new Map<string, boolean>(overrides.map(o => [o.permissionName, o.granted]))

  const toggle = (permName: string) => {
    if (updatingKey !== null) return
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
          — overrides take precedence over the member's role
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        {permissions.map(perm => {
          const override   = overrideMap.has(perm.name) ? overrideMap.get(perm.name)! : null
          const isUpdating = updatingKey === perm.name
          const label      = PERMISSION_LABELS[perm.name] ?? perm.name

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
              disabled={updatingKey !== null}
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

// ── Root component ────────────────────────────────────────────────────────────

export default function OrgPanel() {
  const { data: org, isLoading } = useQuery<Org | null>({
    queryKey: ['my-org'],
    queryFn:  () => api.get<Org | null>('/org').then(r => r.data),
  })

  if (isLoading) {
    return (
      <AppLayout title="Organization">
        <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Organization">
      {org ? <OrgDashboard org={org} /> : <CreateOrgForm />}
    </AppLayout>
  )
}

// ── CreateOrgForm ─────────────────────────────────────────────────────────────

function CreateOrgForm() {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<{ name: string }>()

  const mutation = useMutation({
    mutationFn: ({ name }: { name: string }) =>
      api.post<Org>('/org', { name }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-org'] })
      toast.success('Organization created.')
    },
    onError: err => {
      if (!isRateLimited(err)) toast.error(apiErrorMessage(err, 'Failed to create organization.'))
    },
  })

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <div className="p-8">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
              <Building2 size={22} className="text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Create Your Organization</h2>
            <p className="text-sm text-gray-500 mt-1">
              Give your team a home. You can add members after creating it.
            </p>
          </div>

          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <Input
              label="Organization Name"
              placeholder="e.g. Acme Services"
              error={errors.name?.message}
              {...register('name', {
                required:  'Organization name is required.',
                maxLength: { value: 200, message: 'Name must be 200 characters or fewer.' },
              })}
            />
            <Button type="submit" fullWidth loading={mutation.isPending} icon={<Building2 size={15} />}>
              Create Organization
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}

// ── OrgDashboard ──────────────────────────────────────────────────────────────

function OrgDashboard({ org }: { org: Org }) {
  const queryClient               = useQueryClient()
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(DEFAULT_PAGE_SIZE)
  const [removingId, setRemovingId]       = useState<string | null>(null)
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)

  const { data, isLoading: membersLoading } = useQuery<PagedResult<OrgMember>>({
    queryKey: ['org-members', page, pageSize],
    queryFn:  () => api.get('/org/members', { params: { page, pageSize } }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const members    = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ['org-members'] })

  // ── Add member ──────────────────────────────────────────────────────────────

  const { register: regAdd, handleSubmit: handleAdd, reset: resetAdd, formState: { errors: addErrors } } =
    useForm<{ email: string }>()

  const addMutation = useMutation({
    mutationFn: ({ email }: { email: string }) => api.post('/org/members', { email }),
    onSuccess: () => { resetAdd(); invalidateMembers(); toast.success('Member added.') },
    onError:   err => {
      if (!isRateLimited(err)) toast.error(apiErrorMessage(err, 'Failed to add member.'))
    },
  })

  // ── Remove member ───────────────────────────────────────────────────────────

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/org/members/${id}`),
    onSuccess: () => { setRemovingId(null); invalidateMembers(); toast.success('Member removed.') },
    onError:   err => {
      setRemovingId(null)
      if (!isRateLimited(err)) toast.error(apiErrorMessage(err, 'Failed to remove member.'))
    },
  })

  const toggleExpand = (id: string) =>
    setExpandedMemberId(prev => (prev === id ? null : id))

  return (
    <div className="space-y-6">
      {/* Org header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <Building2 size={18} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{org.name}</h2>
          <p className="text-sm text-gray-500">
            Created {new Date(org.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Add member */}
      <Card>
        <div className="p-5">
          <CardHeader
            title="Add Team Member"
            description="Enter the email address of a registered ProviderEmployee."
          />
          <form onSubmit={handleAdd(d => addMutation.mutate(d))} className="flex gap-3 mt-4">
            <div className="flex-1">
              <Input
                placeholder="employee@example.com"
                error={addErrors.email?.message}
                {...regAdd('email', {
                  required: 'Email is required.',
                  pattern:  { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
                })}
              />
            </div>
            <Button type="submit" loading={addMutation.isPending} icon={<UserPlus size={15} />} className="self-start">
              Add
            </Button>
          </form>
        </div>
      </Card>

      {/* Members list */}
      <Card padding={false}>
        <div className="px-6 py-5 border-b border-gray-100">
          <CardHeader
            title="Team Members"
            description={`${totalCount} member${totalCount !== 1 ? 's' : ''} in your organization`}
          />
        </div>

        {membersLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No team members yet"
            description="Add a ProviderEmployee above to get started."
          />
        ) : (
          <>
            <div className="px-6 py-2.5 flex items-center gap-4 bg-slate-50 border-b border-slate-100">
              <div className="w-9 shrink-0" />
              <div className="flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Member / Role
                </span>
              </div>
              <div className="w-28 shrink-0" />
              <div className="w-8 shrink-0" />
            </div>

            <ul className="divide-y divide-gray-100">
              {members.map(member => {
                const isExpanded = expandedMemberId === member.id
                return (
                  <li key={member.id}>
                    {/* Main row */}
                    <div className="px-6 py-3.5 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                        {member.email.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{member.email}</p>
                        <div className="mt-1">
                          <Badge label={member.role} variant={member.role.toLowerCase() as any} />
                        </div>
                      </div>

                      <Button
                        variant="danger"
                        size="sm"
                        icon={<UserMinus size={13} />}
                        loading={removingId === member.id}
                        disabled={removingId !== null}
                        onClick={() => { setRemovingId(member.id); removeMutation.mutate(member.id) }}
                      >
                        Remove
                      </Button>

                      {/* Expand toggle */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(member.id)}
                        title={isExpanded ? 'Hide permissions' : 'Manage permissions'}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>

                    {/* Permission overrides panel */}
                    {isExpanded && <MemberPermissionsPanel memberId={member.id} />}
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
              pageSizeOptions={[5, 10, 20, 50]}
              onPageSizeChange={s => { setPageSize(s); setPage(1) }}
            />
          </>
        )}
      </Card>
    </div>
  )
}
