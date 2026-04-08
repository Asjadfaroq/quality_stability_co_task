import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import api from '../../../shared/api/axios'

export default function SubscriptionSuccess() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    let stopped = false
    let attempts = 0
    const MAX_ATTEMPTS = 20
    const INTERVAL_MS  = 1000

    const poll = async () => {
      try {
        const { data } = await api.get('/billing/status')
        if (data?.tier === 'Paid') {
          if (!stopped) {
            // Write the confirmed Paid data directly into the React Query cache
            // so SubscriptionPage renders Paid immediately without a loading flash
            queryClient.setQueryData(['subscription-status'], data)
            setConfirmed(true)
            setTimeout(() => {
              if (!stopped) navigate('/customer/subscription', { replace: true })
            }, 1800)
          }
          return
        }
      } catch {
        // ignore transient errors and keep polling
      }

      attempts++
      if (!stopped && attempts < MAX_ATTEMPTS) {
        setTimeout(poll, INTERVAL_MS)
      } else if (!stopped) {
        // Webhook too slow — invalidate and redirect; subscription page will refetch
        queryClient.invalidateQueries({ queryKey: ['subscription-status'] })
        navigate('/customer/subscription', { replace: true })
      }
    }

    poll()
    return () => { stopped = true }
  }, [navigate, queryClient])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F8' }}>
      <div className="bg-white rounded-2xl shadow-md p-10 text-center max-w-sm w-full mx-4">
        {confirmed ? (
          <>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: '#DCFCE7' }}
            >
              <CheckCircle2 size={32} style={{ color: '#16A34A' }} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Subscription Active!</h1>
            <p className="text-sm text-slate-500">Your plan has been upgraded. Redirecting you back…</p>
          </>
        ) : (
          <>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: '#EFF6FF' }}
            >
              <Loader2 size={32} className="animate-spin" style={{ color: '#3B82F6' }} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Confirming your plan…</h1>
            <p className="text-sm text-slate-500">Please wait while we verify your subscription.</p>
          </>
        )}
      </div>
    </div>
  )
}
