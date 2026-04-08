import { useRef, useEffect } from 'react'
import { LogOut } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfileDropdownProps {
  /** Authenticated user's email address */
  email: string | null
  /** Authenticated user's role label */
  role: string | null
  /** Whether the dropdown is currently open (controlled by parent) */
  isOpen: boolean
  /** Called when the avatar button is clicked */
  onToggle: () => void
  /** Called when the dropdown should close (outside click, etc.) */
  onClose: () => void
  /** Called when the user confirms sign-out */
  onLogout: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(email: string | null): string {
  return (email ?? 'U').slice(0, 2).toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Top-right user avatar button with a dropdown that shows the signed-in
 * user's email, role, and a sign-out action.
 *
 * Open/close state is controlled by the parent so the parent can coordinate
 * mutual exclusivity with other panels (e.g. the notification bell).
 */
export default function UserProfileDropdown({
  email,
  role,
  isOpen,
  onToggle,
  onClose,
  onLogout,
}: UserProfileDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initials = getInitials(email)

  // Close when the user clicks anywhere outside this component.
  useEffect(() => {
    if (!isOpen) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen, onClose])

  return (
    <div className="relative" ref={containerRef}>
      {/* Avatar trigger button */}
      <button
        type="button"
        onClick={onToggle}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white select-none transition-opacity hover:opacity-85"
        style={{
          background: 'linear-gradient(135deg,#1E3A5F,#3B82F6)',
          outline: isOpen ? '2px solid #93C5FD' : 'none',
          outlineOffset: 2,
        }}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {initials}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-56 bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{
            border: '1px solid #E2E8F0',
            animation: 'userProfileSlideIn 0.18s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <style>{`
            @keyframes userProfileSlideIn {
              from { opacity: 0; transform: translateY(-8px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)   scale(1);     }
            }
          `}</style>

          {/* User info section */}
          <div className="px-4 py-3.5" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold text-white shrink-0 select-none"
                style={{ background: 'linear-gradient(135deg,#1E3A5F,#3B82F6)' }}
                aria-hidden="true"
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p
                  className="text-[13px] font-semibold text-slate-900 truncate leading-tight"
                  title={email ?? undefined}
                >
                  {email}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{role}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
