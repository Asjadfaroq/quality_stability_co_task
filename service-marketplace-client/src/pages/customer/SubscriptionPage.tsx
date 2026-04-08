import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CreditCard, CheckCircle2, AlertCircle, Loader2,
  Copy, Check, Zap, Shield, Sparkles, Lock, ArrowRight,
} from 'lucide-react'
import axios from 'axios'
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

const TEST_CARD = {
  number: '4242 4242 4242 4242',
  expiry: '12/29',
  cvc:    '123',
  zip:    '10001',
}

const PAID_FEATURES = [
  { icon: Zap,      text: 'Unlimited service requests' },
  { icon: Sparkles, text: 'AI-enhanced request descriptions' },
  { icon: Shield,   text: 'Priority provider matching' },
  { icon: CheckCircle2, text: 'Real-time chat with providers' },
]

const FREE_FEATURES = [
  { text: 'Up to 3 service requests' },
  { text: 'Standard provider matching' },
  { text: 'Basic request management' },
]

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors"
      style={{
        background:  copied ? 'rgba(220,252,231,0.6)' : 'rgba(255,255,255,0.6)',
        borderColor: copied ? '#86efac' : 'rgba(199,210,254,0.7)',
      }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-0.5">
          {label}
        </p>
        <p className="text-[13px] font-mono font-semibold text-slate-700 tracking-wider truncate">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        title={`Copy ${label}`}
        className="flex items-center justify-center w-7 h-7 rounded-lg border transition-all duration-200 shrink-0"
        style={{
          background:  copied ? '#dcfce7' : 'rgba(255,255,255,0.8)',
          borderColor: copied ? '#86efac' : 'rgba(199,210,254,0.8)',
          transform:   copied ? 'scale(0.88)' : 'scale(1)',
        }}
      >
        {copied
          ? <Check size={12} style={{ color: '#16a34a' }} />
          : <Copy size={12} className="text-indigo-400" />
        }
      </button>
    </div>
  )
}

export default function SubscriptionPage() {
  const getErrorMessage = (error: unknown, fallback: string) =>
    axios.isAxiosError<{ message?: string }>(error)
      ? (error.response?.data?.message ?? fallback)
      : fallback

  const { data, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['subscription-status'],
    queryFn: () => api.get('/billing/status').then((r) => r.data),
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const checkoutMutation = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>('/billing/checkout').then((r) => r.data),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, 'Failed to start checkout.'))
    },
  })

  const portalMutation = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>('/billing/portal').then((r) => r.data),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, 'Failed to open billing portal.'))
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
      <div className="max-w-xl mx-auto py-6 space-y-6">

        {/* Page header */}
        <div>
          <h2 className="text-xl font-bold text-slate-900">Subscription & Billing</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your plan and payment details.
          </p>
        </div>

        {/* ── Test-mode card ──────────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden border border-indigo-200"
          style={{
            background: 'linear-gradient(135deg,#eef2ff 0%,#ede9fe 100%)',
            boxShadow: '0 2px 12px rgba(99,102,241,0.1)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-indigo-200/60">
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-indigo-700">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse inline-block" />
              Stripe Test Mode
            </span>
            <span className="text-[11px] font-medium text-indigo-400">
              No real charge will be made
            </span>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <p className="text-[12px] text-indigo-500 mb-3.5 leading-relaxed">
              Use these test credentials at checkout. Click the copy icon next to any field.
            </p>

            <div className="space-y-2">
              <CopyField label="Card Number" value={TEST_CARD.number} />
              <div className="grid grid-cols-3 gap-2">
                <CopyField label="Expiry" value={TEST_CARD.expiry} />
                <CopyField label="CVC"    value={TEST_CARD.cvc} />
                <CopyField label="ZIP"    value={TEST_CARD.zip} />
              </div>
            </div>

            <p className="text-[11px] text-indigo-400 mt-3 flex items-center gap-1.5">
              <Lock size={10} className="shrink-0" />
              Any future expiry date and any 3-digit CVC also work.
            </p>
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="animate-spin text-slate-300" size={28} />
          </div>
        ) : (
          <>
            {/* ── Plan comparison ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Free tier */}
              <div
                className="rounded-2xl p-5 border transition-all"
                style={{
                  borderColor: !isPaid ? '#6366f1' : '#e2e8f0',
                  background:  !isPaid ? '#fafafe' : '#f8fafc',
                  boxShadow:   !isPaid ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Free</p>
                  {!isPaid && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-slate-800 mb-3">$0</p>
                <ul className="space-y-2">
                  {FREE_FEATURES.map((f) => (
                    <li key={f.text} className="flex items-start gap-2 text-[12.5px] text-slate-500">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-slate-300" />
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Paid tier */}
              <div
                className="rounded-2xl p-5 border relative overflow-hidden transition-all"
                style={{
                  borderColor: isPaid ? '#16a34a' : '#6366f1',
                  background: isPaid
                    ? 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)'
                    : 'linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%)',
                  boxShadow: isPaid
                    ? '0 0 0 3px rgba(22,163,74,0.1)'
                    : '0 0 0 3px rgba(99,102,241,0.12)',
                }}
              >
                {!isPaid && (
                  <div
                    className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                    style={{ background: 'linear-gradient(90deg,#6366f1,#818cf8)' }}
                  >
                    Recommended
                  </div>
                )}
                {isPaid && (
                  <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Active
                  </div>
                )}
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Pro</p>
                <p className="text-2xl font-bold text-slate-800 mb-0.5">
                  $5
                  <span className="text-sm font-medium text-slate-400">/mo</span>
                </p>
                {isPaid && periodEnd && (
                  <p className="text-[11.5px] text-slate-500 mb-3">
                    Renews <span className="font-medium text-slate-700">{periodEnd}</span>
                  </p>
                )}
                {!isPaid && <div className="mb-3" />}
                <ul className="space-y-2">
                  {PAID_FEATURES.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-2 text-[12.5px] text-slate-600">
                      <Icon
                        size={13}
                        className="mt-0.5 shrink-0"
                        style={{ color: isPaid ? '#16a34a' : '#6366f1' }}
                      />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── Status banner (paid / overdue) ───────────────────────────── */}
            {isPaid && statusLabel && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm"
                style={
                  data?.status === 'past_due'
                    ? { background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }
                    : { background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' }
                }
              >
                {data?.status === 'past_due'
                  ? <AlertCircle size={15} className="shrink-0" />
                  : <CheckCircle2 size={15} className="shrink-0" />
                }
                <span className="font-medium">
                  {data?.status === 'past_due'
                    ? 'Your payment is overdue — update your card in the billing portal.'
                    : `Subscription ${statusLabel.toLowerCase()} — all features unlocked.`
                  }
                </span>
              </div>
            )}

            {/* ── CTA ──────────────────────────────────────────────────────── */}
            {!isPaid ? (
              <button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                }}
              >
                {checkoutMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Redirecting to Stripe…</>
                ) : (
                  <><CreditCard size={15} /> Upgrade to Pro — $5/month <ArrowRight size={14} /></>
                )}
              </button>
            ) : (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 border"
                style={{
                  background: '#f8fafc',
                  borderColor: '#e2e8f0',
                  color: '#475569',
                }}
              >
                {portalMutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Opening portal…</>
                ) : (
                  <><CreditCard size={15} /> Manage Billing / Cancel Subscription</>
                )}
              </button>
            )}

            {/* Stripe trust line */}
            <p className="text-center text-[11.5px] text-slate-400 flex items-center justify-center gap-1.5">
              <Lock size={10} />
              Payments secured by Stripe · No card stored on our servers
            </p>
          </>
        )}
      </div>
    </AppLayout>
  )
}
