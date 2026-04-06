import axios from 'axios'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import { getDashboardPath, AUTH_REDIRECT_KEY } from '../utils/auth'

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

function getLoginError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Invalid email or password.'
  }
  return 'Something went wrong. Please try again.'
}

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const login     = useAuthStore((s) => s.login)

  // Resolve the post-login destination:
  // 1. Path passed via React Router state (e.g. from ProtectedRoute)
  // 2. Path stored in sessionStorage (e.g. from a mid-session 401)
  // 3. Role-based default dashboard
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

      const destination = stateFrom ?? sessionFrom ?? getDashboardPath(data.role)
      navigate(destination, { replace: true })
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Sign in</h1>

        {mutation.isError && (mutation.error as any)?.response?.status !== 429 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {getLoginError(mutation.error)}
          </div>
        )}

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              {...register('email')}
              type="email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              {...register('password')}
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-60 transition"
          >
            {mutation.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  )
}
