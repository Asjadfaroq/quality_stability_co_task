import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/axios'

const PERMISSIONS = ['request.create', 'request.accept', 'request.complete', 'request.view_all']

interface OrgMember {
  id: string
  email: string
  role: string
  permissions: string[]
}

export default function OrgPanel() {
  const { email, logout } = useAuthStore()
  const queryClient = useQueryClient()
  const [expandedMember, setExpandedMember] = useState<string | null>(null)

  const { data: members = [], isLoading } = useQuery<OrgMember[]>({
    queryKey: ['org-members'],
    queryFn: () => api.get('/org/members').then((r) => r.data),
  })

  const permMutation = useMutation({
    mutationFn: ({ id, permission, granted }: { id: string; permission: string; granted: boolean }) =>
      api.patch(`/org/members/${id}/permissions`, { permission, granted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-members'] })
      toast.success('Permission updated.')
    },
    onError: () => toast.error('Failed to update permission.'),
  })

  const togglePerm = (member: OrgMember, permission: string) => {
    const granted = !member.permissions.includes(permission)
    permMutation.mutate({ id: member.id, permission, granted })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-800">Organization Panel</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">ProviderAdmin</span>
          <span className="text-sm text-gray-500">{email}</span>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 transition">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Provider Dashboard link */}
        <div className="flex gap-3">
          <a
            href="/provider"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Provider Dashboard
          </a>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Organization Members</h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : members.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No members in your organization.</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{member.email}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                    </div>
                    <button
                      onClick={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {expandedMember === member.id ? 'Hide' : 'Permissions'}
                    </button>
                  </div>

                  {expandedMember === member.id && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">Permissions</p>
                      <div className="grid grid-cols-2 gap-2">
                        {PERMISSIONS.map((perm) => (
                          <label key={perm} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={member.permissions.includes(perm)}
                              onChange={() => togglePerm(member, perm)}
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
