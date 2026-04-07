import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Users, ChevronDown, ChevronUp, ShieldCheck, Building2, UserPlus, UserMinus } from 'lucide-react'
import api, { isRateLimited } from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Card, CardHeader, Badge, Button, Input, EmptyState, Pagination, SkeletonCard } from '../../components/ui'
import type { PagedResult } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PERMISSIONS = [
  { key: 'request.create',   label: 'Create Requests' },
  { key: 'request.accept',   label: 'Accept Requests' },
  { key: 'request.complete', label: 'Complete Requests' },
  { key: 'request.view_all', label: 'View All Requests' },
]

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
  permissions: string[]
}

// ── API helpers ───────────────────────────────────────────────────────────────

const getMyOrg    = () => api.get<Org | null>('/org').then(r => r.data)
const createOrg   = (name: string) => api.post<Org>('/org', { name }).then(r => r.data)
const addMember   = (email: string) => api.post('/org/members', { email })
const removeMember = (id: string) => api.delete(`/org/members/${id}`)

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as { response?: { data?: { message?: string } } }
    return e.response?.data?.message ?? fallback
  }
  return fallback
}

// ── Root component ────────────────────────────────────────────────────────────

export default function OrgPanel() {
  const { data: org, isLoading } = useQuery<Org | null>({
    queryKey: ['my-org'],
    queryFn: getMyOrg,
  })

  if (isLoading) {
    return (
      <AppLayout title="Organization">
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      </AppLayout>
    )
  }

  if (!org) {
    return (
      <AppLayout title="Organization">
        <CreateOrgForm />
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Organization">
      <OrgDashboard org={org} />
    </AppLayout>
  )
}

// ── CreateOrgForm ─────────────────────────────────────────────────────────────

function CreateOrgForm() {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<{ name: string }>()

  const mutation = useMutation({
    mutationFn: ({ name }: { name: string }) => createOrg(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-org'] })
      toast.success('Organization created.')
    },
    onError: (err) => {
      if (!isRateLimited(err))
        toast.error(apiErrorMessage(err, 'Failed to create organization.'))
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

          <form onSubmit={handleSubmit(data => mutation.mutate(data))} className="space-y-4">
            <Input
              label="Organization Name"
              placeholder="e.g. Acme Services"
              error={errors.name?.message}
              {...register('name', {
                required: 'Organization name is required.',
                maxLength: { value: 200, message: 'Name must be 200 characters or fewer.' },
              })}
            />
            <Button
              type="submit"
              fullWidth
              loading={mutation.isPending}
              icon={<Building2 size={15} />}
            >
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
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const { data, isLoading: membersLoading } = useQuery<PagedResult<OrgMember>>({
    queryKey: ['org-members', page, pageSize],
    queryFn: () =>
      api.get('/org/members', { params: { page, pageSize } }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const members    = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: ['org-members'] })

  // ── Add member ──
  const { register: regAdd, handleSubmit: handleAdd, reset: resetAdd, formState: { errors: addErrors } } =
    useForm<{ email: string }>()

  const addMutation = useMutation({
    mutationFn: ({ email }: { email: string }) => addMember(email),
    onSuccess: () => {
      resetAdd()
      invalidateMembers()
      toast.success('Member added.')
    },
    onError: (err) => {
      if (!isRateLimited(err))
        toast.error(apiErrorMessage(err, 'Failed to add member.'))
    },
  })

  // ── Remove member ──
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeMember(id),
    onSuccess: () => {
      setExpanded(null)
      invalidateMembers()
      toast.success('Member removed.')
    },
    onError: (err) => {
      if (!isRateLimited(err))
        toast.error(apiErrorMessage(err, 'Failed to remove member.'))
    },
  })

  // ── Toggle permission ──
  const permMutation = useMutation({
    mutationFn: ({ id, permission, granted }: { id: string; permission: string; granted: boolean }) =>
      api.patch(`/org/members/${id}/permissions`, {
        overrides: [{ permissionName: permission, granted }],
      }),
    onSuccess: () => {
      invalidateMembers()
      toast.success('Permission updated.')
    },
    onError: (err) => {
      if (!isRateLimited(err))
        toast.error(apiErrorMessage(err, 'Failed to update permission.'))
    },
  })

  const togglePerm = (member: OrgMember, permission: string) => {
    permMutation.mutate({
      id: member.id,
      permission,
      granted: !member.permissions.includes(permission),
    })
  }

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

      {/* Add member form */}
      <Card>
        <div className="p-5">
          <CardHeader
            title="Add Team Member"
            description="Enter the email address of a registered ProviderEmployee."
          />
          <form
            onSubmit={handleAdd(data => addMutation.mutate(data))}
            className="flex gap-3 mt-4"
          >
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
              className="self-start mt-0"
            >
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
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
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
              <div className="w-6 shrink-0" />
            </div>

            <ul className="divide-y divide-gray-100">
              {members.map(member => {
                const isOpen = expanded === member.id
                return (
                  <li key={member.id}>
                    <button
                      className="w-full px-6 py-3.5 flex items-center justify-between hover:bg-gray-50/60 transition-colors text-left"
                      onClick={() => setExpanded(isOpen ? null : member.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                          {member.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge label={member.role} variant={member.role.toLowerCase() as any} />
                            <span className="text-xs text-slate-400">
                              {member.permissions.length} permission{member.permissions.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400 shrink-0">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-5 bg-gray-50/50 border-t border-gray-100">
                        <div className="pt-4 space-y-4">
                          {/* Permissions */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <ShieldCheck size={14} className="text-slate-400" />
                              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                Permissions
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {PERMISSIONS.map(({ key, label }) => {
                                const granted = member.permissions.includes(key)
                                return (
                                  <label
                                    key={key}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                                      granted
                                        ? 'bg-indigo-50 border-indigo-200'
                                        : 'bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={granted}
                                      onChange={() => togglePerm(member, key)}
                                      disabled={permMutation.isPending}
                                      className="w-3.5 h-3.5 accent-indigo-600 shrink-0"
                                    />
                                    <div>
                                      <p className={`text-xs font-medium ${granted ? 'text-indigo-700' : 'text-slate-700'}`}>
                                        {label}
                                      </p>
                                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{key}</p>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </div>

                          {/* Remove member */}
                          <div className="flex justify-end pt-1">
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<UserMinus size={13} />}
                              loading={removeMutation.isPending}
                              onClick={() => removeMutation.mutate(member.id)}
                            >
                              Remove from Organization
                            </Button>
                          </div>
                        </div>
                      </div>
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
              onPageChange={p => { setPage(p); setExpanded(null) }}
              pageSizeOptions={[5, 10, 20, 50]}
              onPageSizeChange={s => { setPageSize(s); setPage(1); setExpanded(null) }}
            />
          </>
        )}
      </Card>
    </div>
  )
}
