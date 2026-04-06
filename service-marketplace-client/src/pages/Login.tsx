import axios from 'axios'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { MapPin, AlertCircle } from 'lucide-react'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import { getDashboardPath, AUTH_REDIRECT_KEY } from '../utils/auth'
import { Button, Input } from '../components/ui'

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
      const sessionFrom = sessionStorage.getItem(AUTH_REDIRECT_KEY)
      sessionStorage.removeItem(AUTH_REDIRECT_KEY)
      navigate(stateFrom ?? sessionFrom ?? getDashboardPath(data.role), { replace: true })
    },
  })

  const showBanner = mutation.isError && (mutation.error as any)?.response?.status !== 429

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <MapPin size={18} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">ServiceMarket</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Connect with skilled<br />service professionals
          </h1>
          <p className="text-blue-200 text-base leading-relaxed">
            Post a job, get matched with verified providers, and get things done — all in one place.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { value: '2,400+', label: 'Active providers' },
            { value: '98%',    label: 'Satisfaction rate' },
            { value: '< 2h',   label: 'Average response' },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl p-4">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <MapPin size={16} className="text-white" />
            </div>
            <span className="text-base font-semibold text-gray-900">ServiceMarket</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1">Sign in to your account to continue</p>
          </div>

          {showBanner && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{getLoginError(mutation.error)}</p>
            </div>
          )}

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={mutation.isPending}
              className="mt-2"
            >
              Sign in
            </Button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
