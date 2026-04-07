import { useQuery } from '@tanstack/react-query'
import { Building2, Users, CalendarDays, ShieldOff } from 'lucide-react'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'
import { Card, CardHeader, Badge, SkeletonCard } from '../../components/ui'

interface Org {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

const getMyOrgAsMember = () =>
  api.get<Org | null>('/org/mine').then(r => r.data)

export default function ProviderOrgStatus() {
  const { data: org, isLoading } = useQuery<Org | null>({
    queryKey: ['my-org-member'],
    queryFn: getMyOrgAsMember,
  })

  return (
    <AppLayout title="My Organization">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">My Organization</h2>
        <p className="text-sm text-gray-500 mt-0.5">Your current team membership</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : !org ? (
        <NoOrgCard />
      ) : (
        <OrgCard org={org} />
      )}
    </AppLayout>
  )
}

// ── No org state ──────────────────────────────────────────────────────────────

function NoOrgCard() {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <ShieldOff size={24} className="text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Not part of any organization</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            You haven't been added to an organization yet. Ask your team administrator to add you by your email address.
          </p>
        </div>
        <div className="mt-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
          <p className="text-xs text-amber-700 font-medium">
            Your admin needs your registered email to add you.
          </p>
        </div>
      </div>
    </Card>
  )
}

// ── Has org state ─────────────────────────────────────────────────────────────

function OrgCard({ org }: { org: Org }) {
  const joined = new Date(org.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* Main org card */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <Building2 size={22} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{org.name}</h3>
              <Badge label="ProviderEmployee" variant="provideremployee" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Org since */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <CalendarDays size={14} className="text-slate-400" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Organization Since
                </p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{joined}</p>
              </div>
            </div>

            {/* Role in org */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <Users size={14} className="text-slate-400" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Your Role
                </p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">Provider Employee</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Info banner */}
      <div className="px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
        <Building2 size={14} className="text-indigo-500 mt-0.5 shrink-0" />
        <p className="text-xs text-indigo-700">
          You are a member of <span className="font-semibold">{org.name}</span>. Your organization administrator manages your permissions and team membership.
        </p>
      </div>
    </div>
  )
}
