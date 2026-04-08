/**
 * PermissionToggleGrid — shared UI for the 3-state permission override toggles
 * used in both AdminPanel (per-user overrides) and OrgPanel (per-member overrides).
 *
 * State machine: null (inherit from role) → true (grant) → false (revoke) → null
 *
 * The parent component owns data fetching and the mutation; this component is
 * purely presentational, accepting the derived state and calling `onToggle`
 * when the user clicks a button.
 */

import { Minus } from 'lucide-react'
import { PERMISSIONS } from '../constants/permissions'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PermissionDto {
  id: number
  name: string
}

export interface PermissionOverride {
  permissionName: string
  granted: boolean
}

/** null = inheriting from role, true = explicitly granted, false = explicitly revoked */
export type OverrideState = true | false | null

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cycles through the three override states: null → true → false → null */
// eslint-disable-next-line react-refresh/only-export-components
export function nextOverrideState(current: OverrideState): OverrideState {
  if (current === null) return true
  if (current === true) return false
  return null
}

// eslint-disable-next-line react-refresh/only-export-components
export const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.REQUEST_CREATE]:     'Create Requests',
  [PERMISSIONS.REQUEST_ACCEPT]:     'Accept Requests',
  [PERMISSIONS.REQUEST_COMPLETE]:   'Complete Requests',
  [PERMISSIONS.REQUEST_VIEW_ALL]:   'View All Requests',
  [PERMISSIONS.ADMIN_MANAGE_USERS]: 'Manage Users',
  [PERMISSIONS.ORG_MANAGE]:         'Manage Organisation',
  [PERMISSIONS.ORG_VIEW]:           'View Organisation',
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Full list of permissions that exist on the platform. */
  permissions: PermissionDto[]
  /** Current user/member overrides from the API. */
  overrides: PermissionOverride[]
  /** Key of the permission currently being saved, or null when idle. */
  updatingKey: string | null
  /** When true, all buttons are disabled and `disabledReason` is shown. */
  disabled?: boolean
  disabledReason?: string
  onToggle: (permName: string) => void
}

export function PermissionToggleGrid({
  permissions,
  overrides,
  updatingKey,
  disabled = false,
  disabledReason,
  onToggle,
}: Props) {
  const overrideMap = new Map<string, boolean>(
    overrides.map((o) => [o.permissionName, o.granted]),
  )

  return (
    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Permission Overrides
        <span className="ml-2 font-normal normal-case text-slate-400">
          — overrides take precedence over the member's role
        </span>
      </p>

      {disabled && disabledReason && (
        <p className="text-xs text-amber-600 mb-3">{disabledReason}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {permissions.map((perm) => {
          const override: OverrideState = overrideMap.has(perm.name)
            ? (overrideMap.get(perm.name) as boolean)
            : null
          const isUpdating = updatingKey === perm.name
          const label      = PERMISSION_LABELS[perm.name] ?? perm.name

          let btnStyle = 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          let icon: React.ReactNode = <Minus size={11} className="text-slate-300" />

          if (override === true) {
            btnStyle = 'bg-emerald-50 border-emerald-300 text-emerald-700'
            icon = (
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2.5 7L5.5 10L11.5 4"
                  stroke="#059669"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          } else if (override === false) {
            btnStyle = 'bg-red-50 border-red-300 text-red-700'
            icon = (
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 3L11 11M11 3L3 11"
                  stroke="#dc2626"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            )
          }

          const title =
            override === null
              ? `${label}: inheriting from role (click to grant)`
              : override
              ? `${label}: explicitly granted (click to revoke)`
              : `${label}: explicitly revoked (click to remove override)`

          return (
            <button
              key={perm.name}
              type="button"
              disabled={disabled || updatingKey !== null}
              onClick={() => onToggle(perm.name)}
              title={title}
              className={[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border',
                'text-[11px] font-medium transition-all cursor-pointer',
                'disabled:cursor-not-allowed disabled:opacity-60',
                isUpdating ? 'opacity-50' : 'hover:scale-105',
                btnStyle,
              ].join(' ')}
            >
              {isUpdating ? (
                <span className="w-2.5 h-2.5 rounded-full border-2 border-t-transparent border-current animate-spin block" />
              ) : (
                icon
              )}
              {label}
            </button>
          )
        })}
      </div>

      <p className="text-[10px] text-slate-400 mt-3">
        <span className="inline-flex items-center gap-1 mr-3">
          <Minus size={9} className="text-slate-300" /> inherits from role
        </span>
        <span className="text-emerald-600 mr-3">✓ explicitly granted</span>
        <span className="text-red-500">✕ explicitly revoked</span>
        <span className="ml-1 text-slate-400">— click to cycle</span>
      </p>
    </div>
  )
}
