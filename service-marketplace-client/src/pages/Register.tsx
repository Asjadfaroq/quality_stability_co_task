import axios from 'axios'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { MapPin, AlertCircle, CheckCircle2 } from 'lucide-react'
import api from '../api/axios'
import { Button, Input, Select } from '../components/ui'

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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <MapPin size={18} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">ServiceMarket</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Join thousands of<br />service professionals
          </h1>
          <p className="text-blue-200 text-base leading-relaxed">
            Whether you're looking for help or offering your skills, ServiceMarket connects you with the right people.
          </p>
        </div>

        <div className="space-y-3">
          {[
            'Free to sign up — no credit card required',
            'Verified service providers near you',
            'Secure payments and communication',
          ].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <CheckCircle2 size={16} className="text-blue-300 shrink-0" />
              <span className="text-sm text-blue-100">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
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
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="text-sm text-gray-500 mt-1">Get started in less than a minute</p>
          </div>

          {showBanner && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{getRegisterError(mutation.error)}</p>
            </div>
          )}

          {mutation.isSuccess && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-6">
              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-sm text-emerald-700">Account created! Redirecting to sign in...</p>
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
              placeholder="Min. 6 characters"
              error={errors.password?.message}
              {...register('password')}
            />

            <Select
              label="I want to..."
              error={errors.role?.message}
              {...register('role')}
            >
              <option value="Customer">Hire professionals (Customer)</option>
              <option value="ProviderEmployee">Offer my services (Provider)</option>
              <option value="ProviderAdmin">Manage a service team (Provider Admin)</option>
            </Select>

            {/* Role description */}
            {selectedRole && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                {roleDescriptions[selectedRole]}
              </p>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={mutation.isPending}
              className="mt-2"
            >
              Create account
            </Button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
