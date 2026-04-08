import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Briefcase, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../../shared/store/authStore'
import api from '../../../shared/api/axios'
import { formatDate } from '../../../shared/utils/format'
import { StatusBadge } from '../../../shared/utils/status'
import { ROUTES } from '../../../shared/constants/routes'
import AppLayout from '../../../shared/components/AppLayout'
import { Button, StatsBar, SkeletonCard } from '../../../shared/components/ui'
import type { PagedResult, ServiceRequest, StatItem } from '../../../shared/types/index'

export default function ProviderDashboard() {
  const { email, role } = useAuthStore()

  const { data, isLoading } = useQuery<PagedResult<ServiceRequest>>({
    queryKey: ['requests'],
    queryFn: () => api.get('/requests', { params: { pageSize: 200 } }).then((r) => r.data),
  })

  const allRequests = data?.items ?? []

  const available    = allRequests.filter((r) => r.status === 'Pending')
  const active       = allRequests.filter((r) => r.status === 'Accepted' || r.status === 'PendingConfirmation')
  const completed    = allRequests.filter((r) => r.status === 'Completed')
  const recentActive = [...active].slice(0, 5)

  const stats: StatItem[] = [
    { label: 'Available Jobs', value: available.length, icon: <Briefcase    size={16} />, color: 'indigo'  },
    { label: 'Active Jobs',    value: active.length,    icon: <Loader2      size={16} />, color: 'amber'   },
    { label: 'Completed',      value: completed.length, icon: <CheckCircle2 size={16} />, color: 'emerald' },
  ]

  return (
    <AppLayout title="Dashboard">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Welcome back, {email?.split('@')[0]} 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{role} account</p>
        </div>
        <Link to={ROUTES.PROVIDER_JOBS}>
          <Button icon={<Briefcase size={15} />}>Browse Jobs</Button>
        </Link>
      </div>

      {/* Stats */}
      {isLoading
        ? <div className="h-[72px] bg-white rounded-xl border border-slate-200 animate-pulse mb-6" />
        : <StatsBar items={stats} />
      }

      {/* Active jobs summary */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Active Jobs</h3>
          <Link
            to={ROUTES.PROVIDER_JOBS}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">{[1,2].map((i) => <SkeletonCard key={i} />)}</div>
        ) : recentActive.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Briefcase size={28} className="text-slate-200" />
            <p className="text-sm text-slate-500 font-medium">No active jobs</p>
            <p className="text-xs text-slate-400">Browse available jobs to get started</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentActive.map((req) => (
              <li key={req.id} className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {req.category} · {formatDate(req.createdAt)}
                  </p>
                </div>
                <StatusBadge status={req.status} perspective="provider" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
