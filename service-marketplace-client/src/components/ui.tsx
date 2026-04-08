import { forwardRef, useEffect } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

// ── Badge ────────────────────────────────────────────────────────────────────

const badgeVariants = {
  pending:            'bg-amber-50 text-amber-700 border-amber-200',
  accepted:           'bg-blue-50 text-blue-700 border-blue-200',
  pendingconfirmation:'bg-orange-50 text-orange-700 border-orange-200',
  completed:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid:               'bg-emerald-50 text-emerald-700 border-emerald-200',
  free:               'bg-gray-50 text-gray-600 border-gray-200',
  admin:              'bg-purple-50 text-purple-700 border-purple-200',
  provideradmin:      'bg-indigo-50 text-indigo-700 border-indigo-200',
  provideremployee:   'bg-sky-50 text-sky-700 border-sky-200',
  customer:           'bg-teal-50 text-teal-700 border-teal-200',
  default:            'bg-gray-50 text-gray-600 border-gray-200',
}

export type BadgeVariant = keyof typeof badgeVariants

interface BadgeProps {
  label: string
  variant?: BadgeVariant
}

export function Badge({ label, variant }: BadgeProps) {
  const key = (variant ?? label.toLowerCase().replace(/\s/g, '')) as keyof typeof badgeVariants
  const cls = badgeVariants[key] ?? badgeVariants.default
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

// ── Button ───────────────────────────────────────────────────────────────────

const buttonVariants = {
  primary:   'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-sm',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400 shadow-sm',
  danger:    'bg-red-600 hover:bg-red-700 text-white border-transparent shadow-sm',
  ghost:     'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-transparent',
  success:   'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-sm',
}

const buttonSizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants
  size?: keyof typeof buttonSizes
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg border
        transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        ${buttonVariants[variant]} ${buttonSizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...rest}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}

// ── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, id, className = '', ...rest }, ref) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`
          w-full border rounded-lg px-3 py-2.5 text-sm text-slate-900 bg-white
          placeholder:text-slate-400
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
          transition-shadow duration-150
          ${error ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'}
          ${className}
        `}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
})

// ── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  actions?: React.ReactNode
}

export function Textarea({ label, error, hint, actions, id, className = '', ...rest }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')
  return (
    <div className="space-y-1.5">
      {(label || actions) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
              {label}
            </label>
          )}
          {actions}
        </div>
      )}
      <textarea
        id={inputId}
        className={`
          w-full border rounded-lg px-3 py-2.5 text-sm text-slate-900 bg-white
          placeholder:text-slate-400 resize-none
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          transition-shadow duration-150
          ${error ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'}
          ${className}
        `}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

// ── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export function Select({ label, error, id, children, className = '', ...rest }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`
          w-full border rounded-lg px-3 py-2.5 text-sm text-slate-900 bg-white
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          transition-shadow duration-150
          ${error ? 'border-red-400' : 'border-slate-300'}
          ${className}
        `}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function CardHeader({ title, description, actions }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-5 gap-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}

// ── Stats bar (compact horizontal strip) ─────────────────────────────────────

const statBarColors = {
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-500',  val: 'text-indigo-700'  },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', val: 'text-emerald-700' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-500',   val: 'text-amber-700'   },
  violet:  { bg: 'bg-violet-50',  icon: 'text-violet-500',  val: 'text-violet-700'  },
  sky:     { bg: 'bg-sky-50',     icon: 'text-sky-500',     val: 'text-sky-700'     },
  slate:   { bg: 'bg-slate-100',  icon: 'text-slate-500',   val: 'text-slate-700'   },
}

export interface StatItem {
  label: string
  value: number | string
  icon: React.ReactNode
  color?: keyof typeof statBarColors
}

export function StatsBar({ items }: { items: StatItem[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex divide-x divide-slate-100 overflow-hidden">
      {items.map((item, i) => {
        const c = statBarColors[item.color ?? 'indigo']
        return (
          <div key={i} className="flex items-center gap-3 px-5 py-4 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
              <span className={c.icon}>{item.icon}</span>
            </div>
            <div className="min-w-0">
              <p className={`text-[22px] font-bold leading-none ${c.val}`}>{item.value}</p>
              <p className="text-[11px] text-slate-500 mt-1 truncate">{item.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 rounded-lg animate-pulse ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-64" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

// ── Divider ──────────────────────────────────────────────────────────────────

export function Divider() {
  return <hr className="border-gray-100" />
}

// ── Pagination ────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100]

interface PaginationProps {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
  /** When provided, renders a "Rows per page" dropdown. Caller must also reset page to 1. */
  pageSizeOptions?: number[]
  onPageSizeChange?: (size: number) => void
}

/** Builds the visible page-number sequence with at most one ellipsis on each side. */
function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '…')[] = [1]

  if (current > 3) pages.push('…')

  const start = Math.max(2, current - 1)
  const end   = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('…')

  pages.push(total)
  return pages
}

export function Pagination({
  page, totalPages, totalCount, pageSize, onPageChange,
  pageSizeOptions, onPageSizeChange,
}: PaginationProps) {
  const hasPageSizeSelector = !!(onPageSizeChange && pageSizeOptions?.length)

  // When stale placeholder data briefly inflates totalPages, auto-correct back to page 1.
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      onPageChange(1)
    }
  }, [page, totalPages, onPageChange])

  if (totalPages <= 1 && !hasPageSizeSelector) return null

  // Recompute totalPages from live pageSize so stale placeholder data can't show phantom pages.
  const safeTotalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0
  const safePage       = Math.min(page, Math.max(1, safeTotalPages))

  const from  = totalCount === 0 ? 0 : Math.min((safePage - 1) * pageSize + 1, totalCount)
  const to    = Math.min(safePage * pageSize, totalCount)
  const pages = buildPageNumbers(safePage, safeTotalPages)

  return (
    <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
      {/* Left: result count + page-size selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <p className="text-xs text-slate-500 shrink-0">
          {totalCount === 0 ? (
            'No results'
          ) : (
            <>
              Showing <span className="font-medium text-slate-700">{from}–{to}</span> of{' '}
              <span className="font-medium text-slate-700">{totalCount}</span> results
            </>
          )}
        </p>

        {hasPageSizeSelector && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-slate-400">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange!(Number(e.target.value))}
              className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 bg-white
                         hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500
                         cursor-pointer transition-colors"
            >
              {(pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: page navigation */}
      {safeTotalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* Prev */}
          <button
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500
                       hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors text-sm"
            aria-label="Previous page"
          >
            ‹
          </button>

          {/* Page numbers */}
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs select-none">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium
                            transition-colors
                            ${p === safePage
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'}`}
                aria-current={p === safePage ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === safeTotalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500
                       hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors text-sm"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
