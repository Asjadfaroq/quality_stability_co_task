import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Clock, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react'
import api from '../../shared/api/axios'
import AppLayout from '../../shared/components/AppLayout'
import ChatPanel from '../../shared/components/ChatPanel'
import { EmptyState, Pagination, SkeletonCard } from '../../shared/components/ui'
import { timeAgo } from '../../shared/utils/format'
import { useAuthStore } from '../../shared/store/authStore'
import type { PagedResult } from '../../shared/types/index'

interface Conversation {
  requestId:              string
  requestTitle:           string
  requestStatus:          string
  otherPartyEmail:        string
  lastMessage:            string | null
  lastMessageAt:          string | null
  lastMessageSenderEmail: string | null
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  Accepted:           { label: 'Active',      color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  PendingConfirmation:{ label: 'Confirming',  color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
  Completed:          { label: 'Completed',   color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  Pending:            { label: 'Pending',     color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
}

const DEFAULT_PAGE_SIZE = 20

export default function Chats() {
  const { email: myEmail } = useAuthStore()
  const [activeChat, setActiveChat] = useState<{ id: string; title: string } | null>(null)
  const [page, setPage]             = useState(1)
  const [pageSize, setPageSize]     = useState(DEFAULT_PAGE_SIZE)

  const { data, isLoading, isError, refetch } = useQuery<PagedResult<Conversation>>({
    queryKey: ['conversations', page, pageSize],
    queryFn: () =>
      api.get('/chat/conversations', { params: { page, pageSize } }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const conversations = data?.items      ?? []
  const totalCount    = data?.totalCount ?? 0
  const totalPages    = data?.totalPages ?? 1

  return (
    <>
      <AppLayout title="Chats">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Chats</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            All your conversations across every job
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-900">
                {isLoading
                  ? 'Loading…'
                  : `${totalCount} conversation${totalCount !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* States */}
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>

          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.08)' }}>
                <AlertCircle size={18} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Failed to load conversations</p>
                <p className="text-xs text-slate-400 mt-0.5">Check your connection and try again</p>
              </div>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'rgba(15,23,42,0.06)', color: '#1e293b' }}
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>

          ) : conversations.length === 0 && totalCount === 0 ? (
            <EmptyState
              icon={<MessageSquare size={22} />}
              title="No conversations yet"
              description="Conversations will appear here once messages have been exchanged."
            />

          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {conversations.map((conv) => {
                  const status = STATUS_STYLE[conv.requestStatus] ?? STATUS_STYLE.Pending
                  const isMe   = conv.lastMessageSenderEmail === myEmail

                  return (
                    <li key={conv.requestId}>
                      <button
                        className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50/70 transition-colors text-left"
                        onClick={() => setActiveChat({ id: conv.requestId, title: conv.requestTitle })}
                      >
                        {/* Avatar */}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 select-none"
                          style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
                        >
                          {conv.otherPartyEmail.slice(0, 2).toUpperCase()}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {conv.requestTitle}
                            </p>
                            <span
                              className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                              style={{ background: status.bg, color: status.color }}
                            >
                              {status.label}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 truncate">
                            <span className="text-slate-400">{conv.otherPartyEmail}</span>
                          </p>

                          {conv.lastMessage ? (
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {isMe ? 'You: ' : ''}{conv.lastMessage}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-300 italic mt-0.5">No messages yet</p>
                          )}
                        </div>

                        {/* Right meta */}
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          {conv.lastMessageAt && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock size={10} />
                              {timeAgo(conv.lastMessageAt)}
                            </span>
                          )}
                          <ChevronRight size={14} className="text-slate-300" />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>

              <Pagination
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setPage}
                pageSizeOptions={[10, 20, 50, 100]}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
              />
            </>
          )}
        </div>
      </AppLayout>

      {activeChat && (
        <ChatPanel
          requestId={activeChat.id}
          requestTitle={activeChat.title}
          onClose={() => setActiveChat(null)}
        />
      )}
    </>
  )
}
