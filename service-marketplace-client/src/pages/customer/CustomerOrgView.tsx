import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarDays, ShieldOff } from 'lucide-react'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Card, SkeletonCard } from '../../components/ui'

interface Org {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

export default function CustomerOrgView() {
  const { data: org, isLoading } = useQuery<Org | null>({
    queryKey: ['my-org-customer'],
    queryFn: () => api.get<Org | null>('/org/mine').then((r) => r.data),
  })

  return (
    <AppLayout title="My Organization">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">My Organization</h2>
        <p className="text-sm text-gray-500 mt-0.5">Organization you are associated with</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : !org ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <ShieldOff size={24} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">No organization linked</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                You are not currently associated with any organization.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <Building2 size={22} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{org.name}</h3>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <CalendarDays size={14} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Organization Since
                  </p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">
                    {new Date(org.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
            <Building2 size={14} className="text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-700">
              You have view access to <span className="font-semibold">{org.name}</span>.
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
