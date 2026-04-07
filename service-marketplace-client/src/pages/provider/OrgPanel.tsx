import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Users, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Card, CardHeader, Badge, EmptyState, SkeletonCard } from '../../components/ui'

const PERMISSIONS = [
  { key: 'request.create',   label: 'Create Requests' },
  { key: 'request.accept',   label: 'Accept Requests' },
  { key: 'request.complete', label: 'Complete Requests' },
  { key: 'request.view_all', label: 'View All Requests' },
]

interface OrgMember {
  id: string
  email: string
  role: string
  permissions: string[]
}

export default function OrgPanel() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)

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
    permMutation.mutate({ id: member.id, permission, granted: !member.permissions.includes(permission) })
  }

  return (
    <AppLayout title="Organization">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Organization</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your team members and their permissions</p>
      </div>

      <Card padding={false}>
        <div className="px-6 py-5 border-b border-gray-100">
          <CardHeader
            title="Team Members"
            description={`${members.length} member${members.length !== 1 ? 's' : ''} in your organization`}
          />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No team members yet"
            description="Invite provider employees to join your organization."
          />
        ) : (
          <>
            {/* Column headers */}
            <div className="px-6 py-2.5 flex items-center gap-4 bg-slate-50 border-b border-slate-100">
              <div className="w-9 shrink-0" />
              <div className="flex-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Member / Role</span>
              </div>
              <div className="w-6 shrink-0" />
            </div>

            <ul className="divide-y divide-gray-100">
              {members.map((member) => {
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
                        <div className="pt-4">
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
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>
    </AppLayout>
  )
}
