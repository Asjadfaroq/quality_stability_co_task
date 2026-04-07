import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Briefcase, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Badge, StatsBar, SkeletonCard } from '../../components/ui'
import type { ServiceRequest, StatItem } from '../../types'

function statusBadge(status: ServiceRequest['status']) {
  const map: Record<ServiceRequest['status'], { label: string; variant: string }> = {
    Pending:            { label: 'Pending',    variant: 'pending' },
    Accepted:           { label: 'Accepted',   variant: 'accepted' },
    PendingConfirmation:{ label: 'Confirming', variant: 'pendingconfirmation' },
    Completed:          { label: 'Completed',  variant: 'completed' },
  }
  const { label, variant } = map[status]
  return <Badge label={label} variant={variant as any} />
}

export default function ProviderDashboard() {
  const { email, role } = useAuthStore()

  const { data: allRequests = [], isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ['requests'],
    queryFn: () => api.get('/requests').then((r) => r.data),
  })

  const available = allRequests.filter((r) => r.status === 'Pending')
  const active    = allRequests.filter((r) => r.status === 'Accepted' || r.status === 'PendingConfirmation')
  const completed = allRequests.filter((r) => r.status === 'Completed')
  const recentActive = [...active].slice(0, 5)

  const stats: StatItem[] = [
    { label: 'Available Jobs', value: available.length, icon: <Briefcase size={16} />,    color: 'indigo'  },
    { label: 'Active Jobs',    value: active.length,    icon: <Loader2 size={16} />,      color: 'amber'   },
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
        <Link to="/provider/jobs">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)' }}
          >
            <Briefcase size={15} /> Browse Jobs
          </button>
        </Link>
      </div>

      {/* Compact stats */}
      {isLoading
        ? <div className="h-[72px] bg-white rounded-xl border border-slate-200 animate-pulse mb-6" />
        : <StatsBar items={stats} />
      }

      {/* Active jobs summary */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Active Jobs</h3>
          <Link
            to="/provider/active"
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
                    {req.category} · {new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                {statusBadge(req.status)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  )
}
