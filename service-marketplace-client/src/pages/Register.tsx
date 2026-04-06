import axios from 'axios'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import api from '../api/axios'
import { Input, Select } from '../components/ui'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Minimum 6 characters'),
  role:     z.enum(['Customer', 'ProviderEmployee', 'ProviderAdmin']),
})

type FormData = z.infer<typeof schema>

function getRegisterError(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    return error.response.data?.message ?? 'Registration failed. Email may already be in use.'
  }
  return 'Something went wrong. Please try again.'
}

const SHAPES = [
  { type: 'circle',  top: '10%', left: '8%',  size: 64,  delay: '0s',   duration: '7s'  },
  { type: 'diamond', top: '22%', left: '36%', size: 44,  delay: '1s',   duration: '6s'  },
  { type: 'square',  top: '45%', left: '44%', size: 34,  delay: '0.5s', duration: '8s'  },
  { type: 'circle',  top: '62%', left: '7%',  size: 44,  delay: '1.8s', duration: '7.5s'},
  { type: 'diamond', top: '78%', left: '32%', size: 52,  delay: '0.8s', duration: '6.5s'},
  { type: 'square',  top: '88%', left: '50%', size: 38,  delay: '2s',   duration: '9s'  },
  { type: 'circle',  top: '35%', left: '55%', size: 28,  delay: '1.4s', duration: '7s'  },
]

function FloatingShape({ type, top, left, size, delay, duration }: typeof SHAPES[0]) {
  const base = 'absolute opacity-40 border-2 border-indigo-400'
  const style = { top, left, width: size, height: size, animationDelay: delay, animationDuration: duration }
  if (type === 'circle')  return <div className={`${base} rounded-full animate-float`} style={style} />
  if (type === 'diamond') return <div className={`${base} animate-float`} style={{ ...style, transform: 'rotate(45deg)' }} />
  return <div className={`${base} rounded-sm animate-float`} style={style} />
}

const roleDescriptions: Record<string, string> = {
  Customer:         'Post service requests and hire professionals',
  ProviderEmployee: 'Browse and accept service jobs',
  ProviderAdmin:    'Manage your team and service operations',
}

export default function Register() {
  const navigate = useNavigate()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'Customer' },
  })

  const selectedRole = watch('role')

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/auth/register', data).then((r) => r.data),
    onSuccess: () => navigate('/login', { state: { registered: true } }),
  })

  const showBanner = mutation.isError && (mutation.error as any)?.response?.status !== 429

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(var(--r, 0deg)); }
          50%       { transform: translateY(-18px) rotate(var(--r, 0deg)); }
        }
        .animate-float {
          animation-name: float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>

      <div className="min-h-screen flex">

        {/* ── Left panel ── */}
        <div
          className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #dbeafe 0%, #f0f5fd 28%, #f7f9fe 60%, #eef2fb 100%)' }}
        >
          {/* Top-left corner accent glow */}
          <div
            className="absolute top-0 left-0 w-72 h-72 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle at top left, rgba(99,138,255,0.18) 0%, rgba(147,197,253,0.10) 50%, transparent 75%)',
              filter: 'blur(18px)',
            }}
          />

          {SHAPES.map((s, i) => <FloatingShape key={i} {...s} />)}

          <div className="relative z-10 flex flex-col items-center select-none">
            <div className="mb-6">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <rect x="10" y="30" width="22" height="22" rx="4" fill="#3b6fd4" opacity="0.9" />
                <rect x="28" y="14" width="22" height="22" rx="4" fill="#5a8ee8" opacity="0.8" />
                <rect x="46" y="30" width="22" height="22" rx="4" fill="#7aaaf0" opacity="0.7" />
                <rect x="28" y="46" width="22" height="22" rx="4" fill="#4e7dd4" opacity="0.75" />
              </svg>
            </div>
            <h1 className="text-5xl font-black tracking-tight" style={{ color: '#1a2e5a', letterSpacing: '-1px' }}>
              ServiceMarket
            </h1>
            <p className="mt-3 text-base font-medium" style={{ color: '#4a6090' }}>
              Professional services, on demand
            </p>
          </div>

          <p className="absolute bottom-8 text-xs text-center px-12" style={{ color: '#8099c0' }}>
            Join thousands of professionals and customers on our platform
          </p>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="w-full max-w-sm">

              {/* Mobile logo */}
              <div className="flex flex-col items-center mb-8 lg:hidden">
                <svg width="48" height="48" viewBox="0 0 80 80" fill="none" className="mb-2">
                  <rect x="10" y="30" width="22" height="22" rx="4" fill="#3b6fd4" opacity="0.9" />
                  <rect x="28" y="14" width="22" height="22" rx="4" fill="#5a8ee8" opacity="0.8" />
                  <rect x="46" y="30" width="22" height="22" rx="4" fill="#7aaaf0" opacity="0.7" />
                  <rect x="28" y="46" width="22" height="22" rx="4" fill="#4e7dd4" opacity="0.75" />
                </svg>
                <span className="text-xl font-black text-gray-900">ServiceMarket</span>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h2>
              <p className="text-sm text-gray-500 mb-8">Get started in less than a minute</p>

              {showBanner && (
                <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl mb-5">
                  <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{getRegisterError(mutation.error)}</p>
                </div>
              )}

              {mutation.isSuccess && (
                <div className="flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl mb-5">
                  <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-emerald-700">Account created! Redirecting to sign in…</p>
                </div>
              )}

              <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="Enter your email"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="Min. 6 characters"
                  error={errors.password?.message}
                  {...register('password')}
                />

                <Select
                  label="I want to…"
                  error={errors.role?.message}
                  {...register('role')}
                >
                  <option value="Customer">Hire professionals (Customer)</option>
                  <option value="ProviderEmployee">Offer my services (Provider)</option>
                  <option value="ProviderAdmin">Manage a service team (Provider Admin)</option>
                </Select>

                {selectedRole && (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                    {roleDescriptions[selectedRole]}
                  </p>
                )}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: mutation.isPending
                        ? '#6b9de8'
                        : 'linear-gradient(135deg, #3b6fd4 0%, #5a8ee8 100%)',
                      boxShadow: '0 4px 14px rgba(59, 111, 212, 0.35)',
                    }}
                  >
                    {mutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating account…
                      </span>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </div>
              </form>

              <p className="text-sm text-gray-500 text-center mt-6">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold hover:underline" style={{ color: '#3b6fd4' }}>
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 py-5">
            © {new Date().getFullYear()} ServiceMarket. All rights reserved.
          </p>
        </div>

      </div>
    </>
  )
}
