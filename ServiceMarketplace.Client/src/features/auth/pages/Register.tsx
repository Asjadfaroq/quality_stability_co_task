import axios from 'axios'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import api from '../../../shared/api/axios'
import { Input, Select } from '../../../shared/components/ui'
import { AuthPageLayout, type FloatingShapeConfig } from '../../../shared/components/auth/AuthPageLayout'
import { ROUTES } from '../../../shared/constants/routes'

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

function hasHttpStatus(error: unknown, status: number): boolean {
  return axios.isAxiosError(error) && error.response?.status === status
}

const SHAPES: FloatingShapeConfig[] = [
  { type: 'circle',  top: '10%', left: '8%',  size: 64,  delay: '0s',   duration: '7s'   },
  { type: 'diamond', top: '22%', left: '36%', size: 44,  delay: '1s',   duration: '6s'   },
  { type: 'square',  top: '45%', left: '44%', size: 34,  delay: '0.5s', duration: '8s'   },
  { type: 'circle',  top: '62%', left: '7%',  size: 44,  delay: '1.8s', duration: '7.5s' },
  { type: 'diamond', top: '78%', left: '32%', size: 52,  delay: '0.8s', duration: '6.5s' },
  { type: 'square',  top: '88%', left: '50%', size: 38,  delay: '2s',   duration: '9s'   },
  { type: 'circle',  top: '35%', left: '55%', size: 28,  delay: '1.4s', duration: '7s'   },
]

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Customer:         'Post service requests and hire professionals',
  ProviderEmployee: 'Browse and accept service jobs',
  ProviderAdmin:    'Manage your team and service operations',
}

export default function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'Customer' },
  })

  const selectedRole = useWatch({ control, name: 'role' })

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/auth/register', data).then((r) => r.data),
    onSuccess: () => navigate(ROUTES.LOGIN, { state: { registered: true } }),
  })

  const showBanner = mutation.isError && !hasHttpStatus(mutation.error, 429)

  return (
    <AuthPageLayout
      shapes={SHAPES}
      tagline="Join thousands of professionals and customers on our platform"
    >
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
          autoComplete="email"
          placeholder="Enter your email"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Min. 6 characters"
          error={errors.password?.message}
          {...register('password')}
          suffix={
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          }
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
            {ROLE_DESCRIPTIONS[selectedRole]}
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
        <Link to={ROUTES.LOGIN} className="font-semibold hover:underline" style={{ color: '#3b6fd4' }}>
          Sign in
        </Link>
      </p>
    </AuthPageLayout>
  )
}
