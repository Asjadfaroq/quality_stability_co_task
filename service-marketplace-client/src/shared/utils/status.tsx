/**
 * Centralised request-status display utilities.
 *
 * Single source of truth for how each `ServiceRequest['status']` value maps
 * to a Badge variant (colour).  Label text is perspective-aware because the
 * same status reads differently to a customer ("Awaiting Confirmation") vs a
 * provider ("Confirming") vs an admin ("In Progress").
 */

import { Badge } from '../components/ui'
import type { BadgeVariant } from '../components/ui'
import type { ServiceRequest } from '../types/index'

/** Badge variant key for each request status — drives colour only. */
// eslint-disable-next-line react-refresh/only-export-components
export const STATUS_BADGE_VARIANTS: Record<ServiceRequest['status'], BadgeVariant> = {
  Pending:             'pending',
  Accepted:            'accepted',
  PendingConfirmation: 'pendingconfirmation',
  Completed:           'completed',
}

/**
 * Default display labels per status, grouped by user perspective so that
 * copy matches the role's mental model without duplicating logic in each page.
 */
const STATUS_LABELS: Record<'customer' | 'provider' | 'admin', Record<ServiceRequest['status'], string>> = {
  customer: {
    Pending:             'Pending',
    Accepted:            'Accepted',
    PendingConfirmation: 'Awaiting Confirmation',
    Completed:           'Completed',
  },
  provider: {
    Pending:             'Pending',
    Accepted:            'Accepted',
    PendingConfirmation: 'Confirming',
    Completed:           'Completed',
  },
  admin: {
    Pending:             'Pending',
    Accepted:            'Accepted',
    PendingConfirmation: 'In Progress',
    Completed:           'Completed',
  },
}

interface StatusBadgeProps {
  status: ServiceRequest['status']
  /** Controls which label set to use. Defaults to 'customer'. */
  perspective?: keyof typeof STATUS_LABELS
}

/**
 * Renders the appropriate coloured Badge for a request status.
 *
 * Usage:
 *   <StatusBadge status={req.status} />                       // customer view
 *   <StatusBadge status={req.status} perspective="provider" /> // provider view
 *   <StatusBadge status={req.status} perspective="admin" />    // admin view
 */
export function StatusBadge({ status, perspective = 'customer' }: StatusBadgeProps) {
  const label   = STATUS_LABELS[perspective][status]
  const variant = STATUS_BADGE_VARIANTS[status]
  return <Badge label={label} variant={variant} />
}
