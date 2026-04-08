import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Sparkles, MapPin, Clock, Loader2, X } from 'lucide-react'
import axios from 'axios'

import api, { isRateLimited } from '../../../../shared/api/axios'
import { ROUTES } from '../../../../shared/constants/routes'
import { apiErrorCode, apiErrorMessage } from '../../../../shared/utils/format'
import { useAiEnhance } from '../../../../shared/hooks/useAiEnhance'
import { useGeolocation } from '../../../../shared/hooks/useGeolocation'
import { useServiceCategories } from '../../../../shared/hooks/useServiceCategories'
import { Button, Input, Textarea, Select } from '../../../../shared/components/ui'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().min(10, 'Min 10 characters').max(2000),
  category:    z.string().min(1, 'Select a category'),
  latitude:    z.number({ error: 'Required' }).min(-90).max(90),
  longitude:   z.number({ error: 'Required' }).min(-180).max(180),
})

type FormData = z.infer<typeof schema>

function isLegacyFreeTierLimitError(err: unknown): boolean {
  if (!axios.isAxiosError(err) || err.response?.status !== 422) return false
  const msg = apiErrorMessage(err, '')
  return /free tier limit|upgrade to (create|pro)/i.test(msg)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface NewRequestModalProps {
  open: boolean
  onClose: () => void
}

export function NewRequestModal({ open, onClose }: NewRequestModalProps) {
  const queryClient   = useQueryClient()
  const { categories } = useServiceCategories()
  const { enhancing, enhance } = useAiEnhance()
  const { latitude: geoLat, longitude: geoLng, loading: geoLoading, error: geoError, detect } = useGeolocation()
  const [freeLimitHit, setFreeLimitHit] = useState(false)
  const [visible, setVisible]           = useState(false)
  const { register, handleSubmit, setValue, watch, reset, setFocus, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: '' },
  })
  const title       = watch('title')
  const description = watch('description')

  // Auto-detect location when the modal opens
  useEffect(() => {
    if (open) detect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Fill coordinates once geolocation resolves
  useEffect(() => {
    if (geoLat !== null && geoLng !== null) {
      setValue('latitude',  geoLat,  { shouldValidate: true })
      setValue('longitude', geoLng, { shouldValidate: true })
    }
  }, [geoLat, geoLng, setValue])

  // Drive enter/leave animation
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setVisible(true), 0)
      setTimeout(() => setFocus('title'), 120)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => setVisible(false), 250)
      return () => clearTimeout(t)
    }
  }, [open, setFocus])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post('/requests', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      setFreeLimitHit(false)
      handleClose()
      toast.success('Request submitted successfully!')
    },
    onError: (err: unknown) => {
      if (isRateLimited(err)) return

      const code = apiErrorCode(err)
      if (code === 'permission_denied') {
        toast.error(
          "You don't have permission to create requests. Contact your administrator if you need access.",
        )
        return
      }

      if (code === 'free_tier_limit' || isLegacyFreeTierLimitError(err)) {
        setFreeLimitHit(true)
        toast.error('Free plan limit reached. Upgrade to Pro for unlimited service requests.', { duration: 6000 })
        return
      }

      toast.error(apiErrorMessage(err, 'Could not submit your request. Please try again.'))
    },
  })

  const handleClose = () => {
    reset()
    setFreeLimitHit(false)
    onClose()
  }

  const handleEnhance = async () => {
    if (!title || !description) return
    const data = await enhance(title, description)
    if (!data) return
    setValue('description', data.enhancedDescription)
    if (!watch('category')) setValue('category', data.suggestedCategory)
    toast.success('Description enhanced!')
  }

  if (!visible && !open) return null

  const isEntering = open && visible

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        transition: 'background 0.25s ease',
        background: isEntering ? 'rgba(15,23,42,0.45)' : 'rgba(15,23,42,0)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        style={{
          transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.2,0.64,1)',
          opacity:    isEntering ? 1 : 0,
          transform:  isEntering ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(12px)',
          width: '100%',
          maxWidth: 540,
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Modal header */}
          <div
            className="flex items-center justify-between px-6 py-5"
            style={{ borderBottom: '1px solid #F1F5F9' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.1)' }}
              >
                <Plus size={18} style={{ color: '#6366f1' }} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">New Service Request</h2>
                <p className="text-xs text-slate-400 mt-0.5">Describe your job and we'll match you with a provider</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal body */}
          <div className="px-6 py-5">
            {freeLimitHit && (
              <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-sm text-amber-900">
                <Clock size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] leading-snug">You&apos;ve used all Free plan requests</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
                    Upgrade to Pro for unlimited requests, or free a slot by deleting a request you no longer need from My Requests.
                  </p>
                  <Link
                    to={ROUTES.CUSTOMER_SUBSCRIPTION}
                    className="mt-2 inline-flex text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline"
                  >
                    View subscription &amp; upgrade →
                  </Link>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <Input
                label="Title"
                placeholder="e.g. Fix leaking kitchen pipe"
                error={errors.title?.message}
                {...register('title')}
              />

              <Textarea
                label="Description"
                placeholder="Describe the issue in detail (min 10 characters)"
                rows={4}
                error={errors.description?.message}
                actions={
                  <Button
                    type="button" variant="ghost" size="sm"
                    icon={enhancing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    onClick={handleEnhance}
                    disabled={enhancing || !title || !description}
                  >
                    {enhancing ? 'Enhancing...' : 'Enhance with AI'}
                  </Button>
                }
                {...register('description')}
              />

              <Select label="Category" error={errors.category?.message} {...register('category')}>
                <option value="">Select a category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>

              {/* Location section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">Location</span>
                  <button
                    type="button"
                    onClick={detect}
                    disabled={geoLoading}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {geoLoading
                      ? <Loader2 size={12} className="animate-spin" />
                      : <MapPin size={12} />
                    }
                    {geoLoading ? 'Detecting…' : 'Detect my location'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Latitude"
                    type="number" step="any" placeholder="e.g. 51.5074"
                    error={errors.latitude?.message}
                    {...register('latitude', { valueAsNumber: true })}
                  />
                  <Input
                    label="Longitude"
                    type="number" step="any" placeholder="e.g. -0.1278"
                    error={errors.longitude?.message}
                    {...register('longitude', { valueAsNumber: true })}
                  />
                </div>

                {geoError && (
                  <p className="flex items-center gap-1.5 text-[11.5px] text-amber-600">
                    <MapPin size={11} className="shrink-0" />
                    {geoError}
                  </p>
                )}
                {!geoError && geoLat !== null && (
                  <p className="flex items-center gap-1.5 text-[11.5px] text-emerald-600">
                    <MapPin size={11} className="shrink-0" />
                    Location detected — you can still edit the values below.
                  </p>
                )}
              </div>

              {freeLimitHit && (
                <p className="text-[11px] leading-relaxed text-amber-700/90 text-center px-1">
                  Submit is disabled until you upgrade or reduce your request count — see the notice above.
                </p>
              )}

              {/* Footer actions */}
              <div
                className="flex items-center justify-end gap-3 pt-2"
                style={{ borderTop: '1px solid #F1F5F9', marginTop: 20, paddingTop: 20 }}
              >
                <Button type="button" variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={createMutation.isPending}
                  disabled={freeLimitHit}
                  icon={<Plus size={15} />}
                >
                  Submit Request
                </Button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>,
    document.body,
  )
}
