/**
 * Shared layout for the Login and Register pages.
 *
 * Encapsulates the two-column split (animated left panel + right form panel)
 * so that neither page needs to duplicate the brand mark, floating shapes,
 * gradient background, or copyright footer.
 */

type ShapeType = 'circle' | 'square' | 'diamond'

export interface FloatingShapeConfig {
  type:     ShapeType
  top:      string
  left:     string
  size:     number
  delay:    string
  duration: string
}

function FloatingShape({ type, top, left, size, delay, duration }: FloatingShapeConfig) {
  const base  = 'absolute opacity-40 border-2 border-indigo-400'
  const style = { top, left, width: size, height: size, animationDelay: delay, animationDuration: duration }

  if (type === 'circle')
    return <div className={`${base} rounded-full animate-float`} style={style} />
  if (type === 'diamond')
    return <div className={`${base} animate-float`} style={{ ...style, transform: 'rotate(45deg)' }} />
  return <div className={`${base} rounded-sm animate-float`} style={style} />
}

function BrandMark({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <rect x="10" y="30" width="22" height="22" rx="4" fill="#3b6fd4" opacity="0.9" />
      <rect x="28" y="14" width="22" height="22" rx="4" fill="#5a8ee8" opacity="0.8" />
      <rect x="46" y="30" width="22" height="22" rx="4" fill="#7aaaf0" opacity="0.7" />
      <rect x="28" y="46" width="22" height="22" rx="4" fill="#4e7dd4" opacity="0.75" />
    </svg>
  )
}

interface AuthPageLayoutProps {
  /** Form content rendered inside the right panel's centred container. */
  children: React.ReactNode
  /** Floating shapes unique to each page — Login and Register use different layouts. */
  shapes:   FloatingShapeConfig[]
  /** Bottom tagline shown only on the left decorative panel. */
  tagline:  string
}

export function AuthPageLayout({ children, shapes, tagline }: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen flex">

      {/* ── Left decorative panel (desktop only) ── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #dbeafe 0%, #f0f5fd 28%, #f7f9fe 60%, #eef2fb 100%)' }}
      >
        {/* Corner accent glow */}
        <div
          className="absolute top-0 left-0 w-72 h-72 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top left, rgba(99,138,255,0.18) 0%, rgba(147,197,253,0.10) 50%, transparent 75%)',
            filter: 'blur(18px)',
          }}
        />

        {shapes.map((s, i) => <FloatingShape key={i} {...s} />)}

        <div className="relative z-10 flex flex-col items-center select-none">
          <div className="mb-6">
            <BrandMark />
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

        <p
          className="absolute bottom-8 text-xs text-center px-12"
          style={{ color: '#8099c0' }}
        >
          {tagline}
        </p>
      </div>

      {/* ── Right panel — form + footer ── */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="w-full max-w-sm">

            {/* Mobile brand mark — hidden on desktop where the left panel shows it */}
            <div className="flex flex-col items-center mb-10 lg:hidden">
              <BrandMark size={48} />
              <span className="text-xl font-black text-gray-900 mt-2">ServiceMarket</span>
            </div>

            {children}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 py-5">
          © {new Date().getFullYear()} ServiceMarket. All rights reserved.
        </p>
      </div>

    </div>
  )
}
