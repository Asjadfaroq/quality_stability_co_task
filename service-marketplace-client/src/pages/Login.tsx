import axios from 'axios'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import { getDashboardPath, AUTH_REDIRECT_KEY } from '../utils/auth'
import { Input } from '../components/ui'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

function getLoginError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Incorrect email or password.'
  }
  return 'Something went wrong. Please try again.'
}

// Floating shape definitions — position, size, shape type, animation delay
const SHAPES = [
  { type: 'circle',  top: '8%',  left: '6%',  size: 72,  delay: '0s',    duration: '6s'  },
  { type: 'square',  top: '18%', left: '34%', size: 42,  delay: '1.2s',  duration: '7s'  },
  { type: 'circle',  top: '42%', left: '41%', size: 52,  delay: '0.6s',  duration: '8s'  },
  { type: 'diamond', top: '68%', left: '29%', size: 54,  delay: '2s',    duration: '6.5s'},
  { type: 'circle',  top: '78%', left: '5%',  size: 38,  delay: '1.5s',  duration: '7.5s'},
  { type: 'square',  top: '55%', left: '55%', size: 30,  delay: '0.3s',  duration: '9s'  },
  { type: 'diamond', top: '88%', left: '48%', size: 44,  delay: '1s',    duration: '7s'  },
]

function FloatingShape({ type, top, left, size, delay, duration }: typeof SHAPES[0]) {
  const base = `absolute opacity-40 border-2 border-indigo-400`
  const style = {
    top, left, width: size, height: size,
    animationDelay: delay,
    animationDuration: duration,
  }

  if (type === 'circle') {
    return (
      <div
        className={`${base} rounded-full animate-float`}
        style={style}
      />
    )
  }
  if (type === 'diamond') {
    return (
      <div
        className={`${base} animate-float`}
        style={{ ...style, transform: 'rotate(45deg)' }}
      />
    )
  }
  // square
  return (
    <div
      className={`${base} rounded-sm animate-float`}
      style={style}
    />
  )
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login    = useAuthStore((s) => s.login)

  const stateFrom = (location.state as { from?: string } | null)?.from ?? null

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/auth/login', data).then((r) => r.data),
    onSuccess: (data) => {
      login(data)
      toast.success(`Welcome back, ${data.email?.split('@')[0]}!`)
      const sessionFrom = sessionStorage.getItem(AUTH_REDIRECT_KEY)
      sessionStorage.removeItem(AUTH_REDIRECT_KEY)
      navigate(stateFrom ?? sessionFrom ?? getDashboardPath(data.role), { replace: true })
    },
  })

  const showBanner = mutation.isError && (mutation.error as any)?.response?.status !== 429

  return (
    <>
      {/* Inject float keyframes globally once */}
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

          {/* Floating shapes */}
          {SHAPES.map((s, i) => (
            <FloatingShape key={i} {...s} />
          ))}

          {/* Logo / brand mark */}
          <div className="relative z-10 flex flex-col items-center select-none">
            {/* Icon mark */}
            <div className="mb-6">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <rect x="10" y="30" width="22" height="22" rx="4" fill="#3b6fd4" opacity="0.9" />
                <rect x="28" y="14" width="22" height="22" rx="4" fill="#5a8ee8" opacity="0.8" />
                <rect x="46" y="30" width="22" height="22" rx="4" fill="#7aaaf0" opacity="0.7" />
                <rect x="28" y="46" width="22" height="22" rx="4" fill="#4e7dd4" opacity="0.75" />
              </svg>
            </div>
            <h1
              className="text-5xl font-black tracking-tight"
              style={{ color: '#1a2e5a', letterSpacing: '-1px' }}
            >
              ServiceMarket
            </h1>
            <p className="mt-3 text-base font-medium" style={{ color: '#4a6090' }}>
              Professional services, on demand
            </p>
          </div>

          {/* Bottom tagline */}
          <p
            className="absolute bottom-8 text-xs text-center px-12"
            style={{ color: '#8099c0' }}
          >
            Connecting skilled professionals with people who need them
          </p>
        </div>

        {/* ── Right panel — form ── */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="w-full max-w-sm">

              {/* Mobile logo */}
              <div className="flex flex-col items-center mb-10 lg:hidden">
                <svg width="48" height="48" viewBox="0 0 80 80" fill="none" className="mb-2">
                  <rect x="10" y="30" width="22" height="22" rx="4" fill="#3b6fd4" opacity="0.9" />
                  <rect x="28" y="14" width="22" height="22" rx="4" fill="#5a8ee8" opacity="0.8" />
                  <rect x="46" y="30" width="22" height="22" rx="4" fill="#7aaaf0" opacity="0.7" />
                  <rect x="28" y="46" width="22" height="22" rx="4" fill="#4e7dd4" opacity="0.75" />
                </svg>
                <span className="text-xl font-black text-gray-900">ServiceMarket</span>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Login with your Account
              </h2>
              <p className="text-sm text-gray-500 mb-8">
                Enter your credentials to access your account
              </p>

              {showBanner && (
                <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl mb-5">
                  <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{getLoginError(mutation.error)}</p>
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
                  placeholder="Enter your password"
                  error={errors.password?.message}
                  {...register('password')}
                />

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
                        Signing in…
                      </span>
                    ) : (
                      'Login'
                    )}
                  </button>
                </div>
              </form>

              <p className="text-sm text-gray-500 text-center mt-6">
                Don't have an account?{' '}
                <Link to="/register" className="font-semibold hover:underline" style={{ color: '#3b6fd4' }}>
                  Create one
                </Link>
              </p>

              {/* Admin credentials notice */}
              <div
                className="mt-6 rounded-xl px-4 py-3 flex gap-3"
                style={{ background: '#f8faff', border: '1px solid #dce8fb' }}
              >
                <ShieldCheck size={15} className="shrink-0 mt-0.5" style={{ color: '#3b6fd4' }} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#3b6fd4' }}>
                    Admin Access
                  </p>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 w-14">Email</span>
                      <span className="text-[11px] font-medium text-slate-700 font-mono select-all">
                        admin@qualitco.com
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 w-14">Password</span>
                      <span className="text-[11px] font-medium text-slate-700 font-mono select-all">
                        Quality123!
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 py-5">
            © {new Date().getFullYear()} ServiceMarket. All rights reserved.
          </p>
        </div>

      </div>
    </>
  )
}
