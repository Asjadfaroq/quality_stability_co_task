import { LogOut } from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const AVATAR_BG    = 'rgba(147,197,253,0.15)'
const AVATAR_COLOR = '#93C5FD'
const DIVIDER      = '1px solid rgba(255,255,255,0.08)'
const MUTED_COLOR  = 'rgba(255,255,255,0.38)'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SidebarUserProfileProps {
  /** Authenticated user's email address */
  email: string | null
  /** Authenticated user's role label */
  role: string | null
  /** Called when the user confirms sign-out */
  onLogout: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(email: string | null): string {
  return (email ?? 'U').slice(0, 2).toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Sticky footer section rendered at the bottom of the sidebar.
 * Displays the signed-in user's avatar initials, email, role, and a
 * compact sign-out button.
 */
export default function SidebarUserProfile({ email, role, onLogout }: SidebarUserProfileProps) {
  const initials = getInitials(email)

  return (
    <div className="px-4 py-4 shrink-0" style={{ borderTop: DIVIDER }}>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none"
          style={{ background: AVATAR_BG, color: AVATAR_COLOR }}
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Email + role */}
        <div className="min-w-0 flex-1">
          <p
            className="text-[12px] font-semibold text-white truncate leading-tight"
            title={email ?? undefined}
          >
            {email}
          </p>
          <p
            className="text-[10px] mt-0.5 truncate leading-tight"
            style={{ color: MUTED_COLOR }}
          >
            {role}
          </p>
        </div>

        {/* Sign-out button */}
        <button
          type="button"
          onClick={onLogout}
          className="p-1.5 rounded-md shrink-0 transition-colors sidebar-logout-btn"
          style={{ color: MUTED_COLOR }}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
