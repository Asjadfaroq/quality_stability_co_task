import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Users, ChevronDown, ChevronUp, ShieldCheck, CreditCard } from 'lucide-react'

import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Card, CardHeader, Badge, Button, EmptyState, SkeletonCard } from '../../components/ui'

const PERMISSIONS = [
  { key: 'request.create',   label: 'Create Requests' },
  { key: 'request.accept',   label: 'Accept Requests' },
  { key: 'request.complete', label: 'Complete Requests' },
  { key: 'request.view_all', label: 'View All Requests' },
]

interface UserDto {
  id: string
  email: string
  role: string
  subTier: string
  permissions: string[]
}

export default function AdminPanel() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: users = [], isLoading } = useQuery<UserDto[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  })

  const subMutation = useMutation({
    mutationFn: ({ id, subTier }: { id: string; subTier: string }) =>
      api.patch(`/admin/users/${id}/subscription`, { subTier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Subscription updated.')
    },
    onError: () => toast.error('Failed to update subscription.'),
  })

  const permMutation = useMutation({
    mutationFn: ({ id, permission, granted }: { id: string; permission: string; granted: boolean }) =>
      api.patch(`/admin/users/${id}/permissions`, {
        overrides: [{ permissionName: permission, granted }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Permission updated.')
    },
    onError: () => toast.error('Failed to update permission.'),
  })

  const toggleSub  = (user: UserDto) =>
    subMutation.mutate({ id: user.id, subTier: user.subTier === 'Free' ? 'Paid' : 'Free' })

  const togglePerm = (user: UserDto, permission: string) =>
    permMutation.mutate({ id: user.id, permission, granted: !user.permissions.includes(permission) })

  return (
    <AppLayout title="User Management">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">User Management</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage subscriptions and permissions for all platform users</p>
      </div>

      <Card padding={false}>
        <div className="px-6 py-5 border-b border-gray-100">
          <CardHeader
            title="All Users"
            description={`${users.length} registered user${users.length !== 1 ? 's' : ''}`}
          />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No users found"
            description="Users will appear here once they register."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map((user) => {
              const isOpen = expanded === user.id
              return (
                <li key={user.id}>
                  {/* User row */}
                  <div className="px-6 py-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-semibold shrink-0">
                      {user.email.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge label={user.role}   variant={user.role.toLowerCase() as any} />
                        <Badge label={user.subTier} variant={user.subTier.toLowerCase() as any} />
                        <span className="text-xs text-gray-400">
                          {user.permissions.length} permission{user.permissions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={subMutation.isPending}
                        icon={<CreditCard size={13} />}
                        onClick={() => toggleSub(user)}
                      >
                        {user.subTier === 'Paid' ? 'Downgrade' : 'Upgrade'}
                      </Button>

                      <button
                        onClick={() => setExpanded(isOpen ? null : user.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Permissions panel */}
                  {isOpen && (
                    <div className="px-6 pb-5 bg-gray-50/50 border-t border-gray-100">
                      <div className="pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldCheck size={14} className="text-gray-400" />
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Permissions
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {PERMISSIONS.map(({ key, label }) => {
                            const granted = user.permissions.includes(key)
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
                                  onChange={() => togglePerm(user, key)}
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
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </AppLayout>
  )
}
