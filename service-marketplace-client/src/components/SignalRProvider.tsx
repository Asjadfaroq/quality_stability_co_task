import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { useUnreadStore } from '../store/unreadStore'
import { useSignalR } from '../hooks/useSignalR'

/**
 * Mounts the SignalR connection exactly once for the lifetime of the logged-in
 * session. Placing this at the router level (rather than inside AppLayout)
 * prevents the connection from being torn down and rebuilt on every navigation.
 */
export default function SignalRProvider() {
  const queryClient = useQueryClient()
  const { add } = useNotificationStore()
  const addUnread = useUnreadStore((s) => s.add)
  const role = useAuthStore((s) => s.role)

  const isProvider = role === 'ProviderEmployee' || role === 'ProviderAdmin'
  const isCustomer = role === 'Customer'

  useSignalR({
    // ── Provider events ──
    NewRequestAvailable: (data: { requestId: string; title: string; category: string }) => {
      if (!isProvider) return
      add({
        type:  'new_job',
        title: 'New Job Available',
        body:  `"${data.title}" · ${data.category}`,
        link:  '/provider/jobs',
      })
      queryClient.invalidateQueries({ queryKey: ['requests-pending'] })
    },

    RequestTaken: () => {
      if (!isProvider) return
      // Remove the taken job from other providers' pending list in real time
      queryClient.invalidateQueries({ queryKey: ['requests-pending'] })
      queryClient.invalidateQueries({ queryKey: ['requests-active'] })
    },

    RequestConfirmed: (data: { requestId: string; title: string }) => {
      if (!isProvider) return
      add({
        type:  'job_confirmed',
        title: 'Job Confirmed Complete',
        body:  `"${data.title}" was confirmed by the customer`,
        link:  '/provider/completed',
      })
      queryClient.invalidateQueries({ queryKey: ['requests-active'] })
      queryClient.invalidateQueries({ queryKey: ['provider-completed'] })
    },

    // Fired when a provider accepts the customer's request (Pending → Accepted).
    // Refreshes the customer's list and shows a bell notification.
    RequestAccepted: () => {
      if (!isCustomer) return
      add({
        type:  'job_accepted',
        title: 'Job Accepted!',
        body:  'A provider has accepted your service request.',
        link:  '/customer/requests',
      })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },

    // ── Customer events ──
    RequestNeedsConfirmation: (data: { requestId: string; title: string }) => {
      if (!isCustomer) return
      add({
        type:  'confirm_needed',
        title: 'Awaiting Your Confirmation',
        body:  `"${data.title}" has been marked complete by the provider`,
        link:  '/customer/requests',
      })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },

    // Generic status update — fired when the acting user's own OTHER tabs need
    // to refresh (e.g. provider marks complete in Tab 1, Tab 2 Active Jobs
    // updates; customer confirms in Tab 1, Tab 2 My Requests updates).
    RequestStatusUpdated: (data: { requestId: string }) => {
      void data
      queryClient.invalidateQueries({ queryKey: ['requests-active'] })
      queryClient.invalidateQueries({ queryKey: ['requests-pending'] })
      queryClient.invalidateQueries({ queryKey: ['provider-completed'] })
    },

    // ── Org membership events (ProviderEmployee) ──
    OrgMemberAdded: (data: { organizationId: string; organizationName: string }) => {
      add({
        type:  'org_added',
        title: 'Added to Organization',
        body:  `You've been added to "${data.organizationName}"`,
        link:  '/provider/org',
      })
      queryClient.invalidateQueries({ queryKey: ['my-org-member'] })
    },

    OrgMemberRemoved: (data: { organizationId: string; organizationName: string }) => {
      add({
        type:  'org_removed',
        title: 'Removed from Organization',
        body:  `You've been removed from "${data.organizationName}"`,
        link:  '/provider/org',
      })
      queryClient.invalidateQueries({ queryKey: ['my-org-member'] })
    },

    // ── Both ──
    NewMessageNotification: (data: { requestId: string; senderEmail: string }) => {
      add({
        type:  'message',
        title: 'New Message',
        body:  `${data.senderEmail} sent you a message`,
        link:  '/chats',
      })
      addUnread(String(data.requestId))
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  return null
}
