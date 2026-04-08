import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Users, Building2, UserPlus, UserMinus, ChevronDown, ChevronUp } from 'lucide-react'

import api, { isRateLimited } from '../../../shared/api/axios'
import AppLayout from '../../../shared/components/AppLayout'
import { Card, CardHeader, Badge, Button, Input, EmptyState, Pagination, SkeletonCard } from '../../../shared/components/ui'
import type { BadgeVariant } from '../../../shared/components/ui'
import {
  PermissionToggleGrid,
  nextOverrideState,
  type PermissionDto,
  type PermissionOverride,
  type OverrideState,
} from '../../../shared/components/PermissionToggleGrid'
import { apiErrorMessage } from '../../../shared/utils/format'
import { usePermissions } from '../../../shared/hooks/usePermissions'
import { PERMISSIONS } from '../../../shared/constants/permissions'
import type { PagedResult } from '../../../shared/types/index'

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

const toBadgeVariant = (value: string): BadgeVariant => {
  const normalized = value.toLowerCase().replace(/\s/g, '')
  return normalized as BadgeVariant
}

// ── MemberPermissionsPanel ────────────────────────────────────────────────────

function MemberPermissionsPanel({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient()
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)

  const { data: allPermissions = [] } = useQuery<PermissionDto[]>({
    queryKey: ['org-permissions'],
    queryFn:  () => api.get('/org/permissions').then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: overrides = [], isLoading } = useQuery<PermissionOverride[]>({
    queryKey: ['org-member-permissions', memberId],
    queryFn:  () => api.get(`/org/members/${memberId}/permissions`).then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ permissionName, granted }: { permissionName: string; granted: boolean | null }) =>
      api.patch(`/org/members/${memberId}/permissions`, { permissionName, granted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-member-permissions', memberId] })
      toast.success('Permission updated.')
    },
    onError: (err) => {
      if (!isRateLimited(err)) toast.error(apiErrorMessage(err, 'Failed to update permission.'))
    },
    onSettled: () => setUpdatingKey(null),
  })

  const handleToggle = (permName: string) => {
    if (updatingKey !== null) return
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
      permissions={allPermissions}
      overrides={overrides}
      updatingKey={updatingKey}
      onToggle={handleToggle}
    />
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export default function OrgPanel() {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission(PERMISSIONS.ORG_MANAGE)

  const { data: org, isLoading } = useQuery<Org | null>({
    queryKey: ['my-org'],
    queryFn:  () => api.get<Org | null>('/org').then((r) => r.data),
  })

  if (isLoading) {
    return (
      <AppLayout title="Organization">
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Organization">
      {org
        ? <OrgDashboard org={org} canManage={canManage} />
        : canManage
        ? <CreateOrgForm />
        : <NoManagePermissionCard />}
    </AppLayout>
  )
}

// ── NoManagePermissionCard ────────────────────────────────────────────────────

function NoManagePermissionCard() {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Building2 size={24} className="text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">No organization yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            You can view your organization once one is created, but you need the
            <span className="font-medium text-slate-600"> Manage Organisation </span>
            permission to create one.
          </p>
        </div>
      </div>
    </Card>
  )
}

// ── CreateOrgForm ─────────────────────────────────────────────────────────────

function CreateOrgForm() {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<{ name: string }>()

  const mutation = useMutation({
    mutationFn: ({ name }: { name: string }) => api.post<Org>('/org', { name }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-org'] })
      toast.success('Organization created.')
    },
    onError: (err) => {
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

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
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

function OrgDashboard({ org, canManage }: { org: Org; canManage: boolean }) {
  const queryClient                   = useQueryClient()
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(DEFAULT_PAGE_SIZE)
  const [removingId, setRemovingId]           = useState<string | null>(null)
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)

  const { data, isLoading: membersLoading } = useQuery<PagedResult<OrgMember>>({
    queryKey: ['org-members', page, pageSize],
    queryFn:  () => api.get('/org/members', { params: { page, pageSize } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const members    = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ['org-members'] })

  // ── Add member ──────────────────────────────────────────────────────────────

  const {
    register: regAdd,
    handleSubmit: handleAdd,
    reset: resetAdd,
    formState: { errors: addErrors },
  } = useForm<{ email: string }>()

  const addMutation = useMutation({
    mutationFn: ({ email }: { email: string }) => api.post('/org/members', { email }),
    onSuccess: () => { resetAdd(); invalidateMembers(); toast.success('Member added.') },
    onError:   (err) => {
      if (!isRateLimited(err)) toast.error(apiErrorMessage(err, 'Failed to add member.'))
    },
  })

  // ── Remove member ───────────────────────────────────────────────────────────

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/org/members/${id}`),
    onSuccess: (_, removedId) => {
      setRemovingId(null)
      invalidateMembers()
      setExpandedMemberId((prev) => (prev === removedId ? null : prev))
      toast.success('Member removed.')
    },
    onError: (err) => {
      setRemovingId(null)
      if (!isRateLimited(err)) toast.error(apiErrorMessage(err, 'Failed to remove member.'))
    },
  })

  const toggleExpand = (id: string) =>
    setExpandedMemberId((prev) => (prev === id ? null : id))

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

      {/* Add member — only shown when user can manage the org */}
      {canManage && (
        <Card>
          <div className="p-5">
            <CardHeader
              title="Add Team Member"
              description="Enter the email address of a registered ProviderEmployee."
            />
            <form onSubmit={handleAdd((d) => addMutation.mutate(d))} className="flex gap-3 mt-4">
              <div className="flex-1">
                <Input
                  placeholder="employee@example.com"
                  error={addErrors.email?.message}
                  {...regAdd('email', {
                    required: 'Email is required.',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address.',
                    },
                  })}
                />
              </div>
              <Button
                type="submit"
                loading={addMutation.isPending}
                icon={<UserPlus size={15} />}
                className="self-start"
              >
                Add
              </Button>
            </form>
          </div>
        </Card>
      )}

      {/* Members list */}
      <Card padding={false}>
        <div className="px-6 py-5 border-b border-gray-100">
          <CardHeader
            title="Team Members"
            description={`${totalCount} member${totalCount !== 1 ? 's' : ''} in your organization`}
          />
        </div>

        {membersLoading ? (
          <div className="p-4 space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No team members yet"
            description={
              canManage
                ? 'Add a ProviderEmployee above to get started.'
                : 'No members have been added to this organization yet.'
            }
          />
        ) : (
          <>
            {/* Column headers */}
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
              {members.map((member) => {
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
                          <Badge label={member.role} variant={toBadgeVariant(member.role)} />
                        </div>
                      </div>

                      {canManage && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<UserMinus size={13} />}
                          loading={removingId === member.id}
                          disabled={removingId !== null}
                          onClick={() => {
                            setRemovingId(member.id)
                            removeMutation.mutate(member.id)
                          }}
                        >
                          Remove
                        </Button>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(member.id)}
                          title={isExpanded ? 'Hide permissions' : 'Manage permissions'}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      )}
                    </div>

                    {canManage && isExpanded && <MemberPermissionsPanel memberId={member.id} />}
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
              pageSizeOptions={[5, 10, 20, 50]}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            />
          </>
        )}
      </Card>
    </div>
  )
}
