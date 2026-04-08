import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ClipboardList, CheckCircle2, Loader2, Clock,
  ArrowRight, Plus,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/axios'
import { formatDate } from '../../utils/format'
import { StatusBadge } from '../../utils/status'
import { ROUTES } from '../../constants/routes'
import AppLayout from '../../components/AppLayout'
import { Button, StatsBar, SkeletonCard } from '../../components/ui'
import type { PagedResult, ServiceRequest, StatItem } from '../../types'

export default function CustomerDashboard() {
  const { email } = useAuthStore()

  const { data, isLoading } = useQuery<PagedResult<ServiceRequest>>({
    queryKey: ['requests'],
    queryFn: () => api.get('/requests', { params: { pageSize: 200 } }).then((r) => r.data),
  })

  const requests   = data?.items      ?? []
  const totalCount = data?.totalCount ?? 0

  const pending   = requests.filter((r) => r.status === 'Pending').length
  const active    = requests.filter((r) => r.status === 'Accepted' || r.status === 'PendingConfirmation').length
  const completed = requests.filter((r) => r.status === 'Completed').length
  const recent    = [...requests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const stats: StatItem[] = [
    { label: 'Total Requests', value: totalCount, icon: <ClipboardList size={16} />, color: 'indigo'  },
    { label: 'Pending',        value: pending,    icon: <Clock         size={16} />, color: 'amber'   },
    { label: 'Active',         value: active,     icon: <Loader2       size={16} />, color: 'sky'     },
    { label: 'Completed',      value: completed,  icon: <CheckCircle2  size={16} />, color: 'emerald' },
  ]

  return (
    <AppLayout title="Dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Welcome back, {email?.split('@')[0]} 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Here's an overview of your service requests
          </p>
        </div>
        <Link to={ROUTES.CUSTOMER_REQUESTS}>
          <Button icon={<Plus size={16} />}>New Request</Button>
        </Link>
      </div>

      {/* Stats */}
      {isLoading
        ? <div className="h-[72px] bg-white rounded-xl border border-slate-200 animate-pulse mb-6" />
        : <StatsBar items={stats} />
      }

      {/* Recent activity */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Recent Requests</h3>
          <Link
            to={ROUTES.CUSTOMER_REQUESTS}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">{[1,2,3].map((i) => <SkeletonCard key={i} />)}</div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <ClipboardList size={28} className="text-slate-200" />
            <p className="text-sm text-slate-500 font-medium">No requests yet</p>
            <p className="text-xs text-slate-400">Go to My Requests to submit your first one</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((req) => (
              <li key={req.id} className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{req.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {req.category} · {formatDate(req.createdAt)}
                  </p>
                </div>
                <StatusBadge status={req.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
