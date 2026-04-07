import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import api from '../../api/axios'
import AppLayout from '../../components/AppLayout'

interface SubscriptionStatus {
  tier: 'Free' | 'Paid'
  status: string | null
  currentPeriodEnd: string | null
}

const STATUS_LABEL: Record<string, string> = {
  active:   'Active',
  trialing: 'Trial',
  past_due: 'Payment overdue',
  canceled: 'Canceled',
  unpaid:   'Unpaid',
}

export default function SubscriptionPage() {
  const { data, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['subscription-status'],
    queryFn: () => api.get('/billing/status').then((r) => r.data),
    // Always re-fetch from the database on every mount so the plan status
    // is never served from a stale cache (e.g. after returning from Stripe checkout)
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const checkoutMutation = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>('/billing/checkout').then((r) => r.data),
    onSuccess: ({ url }) => {
      window.location.href = url
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Failed to start checkout.')
    },
  })

  const portalMutation = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>('/billing/portal').then((r) => r.data),
    onSuccess: ({ url }) => {
      window.location.href = url
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Failed to open billing portal.')
    },
  })

  const isPaid      = data?.tier === 'Paid'
  const statusLabel = data?.status ? (STATUS_LABEL[data.status] ?? data.status) : null
  const periodEnd   = data?.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <AppLayout title="Subscription">
      <div className="max-w-xl mx-auto py-6">

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Your Plan</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your subscription and billing details.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-slate-400" size={28} />
          </div>
        ) : (
          <>
            {/* Plan card */}
            <div
              className="rounded-2xl p-6 mb-5 border"
              style={{
                background: isPaid ? '#F0FDF4' : '#F8FAFC',
                borderColor: isPaid ? '#BBF7D0' : '#E2E8F0',
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    Current Plan
                  </p>
                  <p
                    className="text-3xl font-bold"
                    style={{ color: isPaid ? '#16A34A' : '#1E293B' }}
                  >
                    {isPaid ? 'Paid' : 'Free'}
                  </p>

                  {isPaid && statusLabel && (
                    <span
                      className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: data?.status === 'past_due' ? '#FEF2F2' : '#DCFCE7',
                        color:      data?.status === 'past_due' ? '#DC2626'  : '#15803D',
                      }}
                    >
                      {data?.status === 'past_due'
                        ? <AlertCircle size={11} />
                        : <CheckCircle2 size={11} />}
                      {statusLabel}
                    </span>
                  )}
                </div>

                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: isPaid ? '#DCFCE7' : '#EFF6FF' }}
                >
                  <CreditCard
                    size={20}
                    style={{ color: isPaid ? '#16A34A' : '#3B82F6' }}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                {isPaid ? (
                  <>
                    <p className="text-sm text-slate-600">
                      Unlimited service requests
                    </p>
                    {periodEnd && (
                      <p className="text-sm text-slate-500">
                        Renews on <span className="font-medium text-slate-700">{periodEnd}</span>
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">
                      Up to <span className="font-semibold">3 service requests</span>
                    </p>
                    <p className="text-sm text-slate-500">
                      Upgrade for <span className="font-semibold text-slate-700">$5/month</span> to create unlimited requests.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Action button */}
            {!isPaid ? (
              <button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#1E3A5F,#3B82F6)' }}
              >
                {checkoutMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Redirecting to checkout...</>
                ) : (
                  <><CreditCard size={15} /> Upgrade to Paid — $5/month · Unlimited Requests</>
                )}
              </button>
            ) : (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                style={{
                  background: '#F1F5F9',
                  color: '#475569',
                  border: '1px solid #E2E8F0',
                }}
              >
                {portalMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Opening portal...</>
                ) : (
                  'Manage Billing / Cancel Subscription'
                )}
              </button>
            )}

            {/* Test mode notice */}
            <p className="text-center text-xs text-slate-400 mt-5">
              Test mode — use card <span className="font-mono font-semibold">4242 4242 4242 4242</span>
            </p>
          </>
        )}
      </div>
    </AppLayout>
  )
}
