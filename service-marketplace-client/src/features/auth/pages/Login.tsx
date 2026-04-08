import axios from 'axios'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../shared/api/axios'
import { useAuthStore } from '../../../shared/store/authStore'
import { getDashboardPath, AUTH_REDIRECT_KEY } from '../../../shared/utils/auth'
import { Input } from '../../../shared/components/ui'
import { AuthPageLayout, type FloatingShapeConfig } from '../../../shared/components/auth/AuthPageLayout'
import { ROUTES } from '../../../shared/constants/routes'

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

function hasHttpStatus(error: unknown, status: number): boolean {
  return axios.isAxiosError(error) && error.response?.status === status
}

const SHAPES: FloatingShapeConfig[] = [
  { type: 'circle',  top: '8%',  left: '6%',  size: 72,  delay: '0s',   duration: '6s'   },
  { type: 'square',  top: '18%', left: '34%', size: 42,  delay: '1.2s', duration: '7s'   },
  { type: 'circle',  top: '42%', left: '41%', size: 52,  delay: '0.6s', duration: '8s'   },
  { type: 'diamond', top: '68%', left: '29%', size: 54,  delay: '2s',   duration: '6.5s' },
  { type: 'circle',  top: '78%', left: '5%',  size: 38,  delay: '1.5s', duration: '7.5s' },
  { type: 'square',  top: '55%', left: '55%', size: 30,  delay: '0.3s', duration: '9s'   },
  { type: 'diamond', top: '88%', left: '48%', size: 44,  delay: '1s',   duration: '7s'   },
]

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

  const showBanner = mutation.isError && !hasHttpStatus(mutation.error, 429)

  return (
    <AuthPageLayout
      shapes={SHAPES}
      tagline="Connecting skilled professionals with people who need them"
    >
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
        <Link to={ROUTES.REGISTER} className="font-semibold hover:underline" style={{ color: '#3b6fd4' }}>
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
    </AuthPageLayout>
  )
}
