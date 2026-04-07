import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'

export default function SubscriptionSuccess() {
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()

  useEffect(() => {
    // Invalidate cached status so the subscription page reflects the new tier immediately
    queryClient.invalidateQueries({ queryKey: ['subscription-status'] })

    const timer = setTimeout(() => navigate('/customer/subscription', { replace: true }), 3500)
    return () => clearTimeout(timer)
  }, [navigate, queryClient])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F8' }}>
      <div className="bg-white rounded-2xl shadow-md p-10 text-center max-w-sm w-full mx-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: '#DCFCE7' }}
        >
          <CheckCircle2 size={32} style={{ color: '#16A34A' }} />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Subscription Active!</h1>
        <p className="text-sm text-slate-500">
          Your plan has been upgraded. Redirecting you back…
        </p>
      </div>
    </div>
  )
}
