import type { ServiceRequest } from '../types'

/** Chat is available for customer and provider while the job is in progress (not Pending, not Completed). */
export function isRequestChatOpen(status: ServiceRequest['status']): boolean {
  return status === 'Accepted' || status === 'PendingConfirmation'
}
