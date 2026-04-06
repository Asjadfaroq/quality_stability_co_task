import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/axios'

const PERMISSIONS = ['request.create', 'request.accept', 'request.complete', 'request.view_all']

interface UserDto {
  id: string
  email: string
  role: string
  subscriptionTier: string
  permissions: string[]
}

export default function AdminPanel() {
  const { email, logout } = useAuthStore()
  const queryClient = useQueryClient()
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const { data: users = [], isLoading } = useQuery<UserDto[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  })

  const subMutation = useMutation({
    mutationFn: ({ id, tier }: { id: string; tier: string }) =>
      api.patch(`/admin/users/${id}/subscription`, { subscriptionTier: tier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Subscription updated.')
    },
    onError: () => toast.error('Failed to update subscription.'),
  })

  const permMutation = useMutation({
    mutationFn: ({ id, permission, granted }: { id: string; permission: string; granted: boolean }) =>
      api.patch(`/admin/users/${id}/permissions`, { permission, granted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Permission updated.')
    },
    onError: () => toast.error('Failed to update permission.'),
  })

  const toggleSub = (user: UserDto) => {
    const newTier = user.subscriptionTier === 'Free' ? 'Paid' : 'Free'
    subMutation.mutate({ id: user.id, tier: newTier })
  }

  const togglePerm = (user: UserDto, permission: string) => {
    const granted = !user.permissions.includes(permission)
    permMutation.mutate({ id: user.id, permission, granted })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">Admin Panel</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{email}</span>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Users</h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No users found.</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* User row */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{user.email}</p>
                        <p className="text-xs text-gray-500">{user.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        user.subscriptionTier === 'Paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user.subscriptionTier}
                      </span>
                      <button
                        onClick={() => toggleSub(user)}
                        disabled={subMutation.isPending}
                        className="text-xs border border-gray-300 hover:border-blue-400 hover:text-blue-600 px-3 py-1 rounded-lg transition disabled:opacity-50"
                      >
                        Toggle Tier
                      </button>
                      <button
                        onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {expandedUser === user.id ? 'Hide' : 'Permissions'}
                      </button>
                    </div>
                  </div>

                  {/* Permissions editor */}
                  {expandedUser === user.id && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">Permissions</p>
                      <div className="grid grid-cols-2 gap-2">
                        {PERMISSIONS.map((perm) => (
                          <label key={perm} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={user.permissions.includes(perm)}
                              onChange={() => togglePerm(user, perm)}
                              disabled={permMutation.isPending}
                              className="accent-blue-600"
                            />
                            <span className="text-xs text-gray-700">{perm}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
