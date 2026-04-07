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
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },

    RequestTaken: () => {
      if (!isProvider) return
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },

    RequestConfirmed: (data: { requestId: string; title: string }) => {
      if (!isProvider) return
      add({
        type:  'job_confirmed',
        title: 'Job Confirmed Complete',
        body:  `"${data.title}" was confirmed by the customer`,
        link:  '/provider/completed',
      })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['provider-completed'] })
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
