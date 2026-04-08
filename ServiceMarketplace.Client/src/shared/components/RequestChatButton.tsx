import { MessageSquare } from 'lucide-react'

interface RequestChatButtonProps {
  unreadCount: number
  onClick: () => void
  /** Tighter padding for dashboard summary rows */
  compact?: boolean
}

/**
 * Chat entry control with unread badge — shared by My Jobs / My Requests and dashboards.
 */
export function RequestChatButton({ unreadCount, onClick, compact = false }: RequestChatButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 rounded-lg font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors ${
        compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-1.5 text-[12.5px]'
      }`}
    >
      <MessageSquare size={13} />
      Chat
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
