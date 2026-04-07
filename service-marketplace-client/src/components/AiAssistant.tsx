import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Sparkles, X, ChevronDown, Send, Trash2, Bot, User, Loader2,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useAiChat } from '../hooks/useAiChat'
import type { UserRole } from '../types'

// ── Role-aware suggested questions ───────────────────────────────────────────

const SUGGESTED_QUESTIONS: Record<UserRole, string[]> = {
  Customer: [
    'How do I create a service request?',
    'What do the request statuses mean?',
    'How do I confirm a completed job?',
    'How does the subscription work?',
  ],
  ProviderEmployee: [
    'How do I accept a job?',
    'How does the chat work?',
    'Where can I see my completed jobs?',
    'How do I mark a job as done?',
  ],
  ProviderAdmin: [
    'How do I add team members?',
    'How do I manage my organisation?',
    'Can I remove an employee from my team?',
    'What can ProviderAdmins do differently?',
  ],
  Admin: [
    'How do I manage users?',
    'How do I change a user\'s role?',
    'What roles exist on the platform?',
    'How do I oversee service requests?',
  ],
}

// ── Keyframes ─────────────────────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes ai-spin    { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
  @keyframes ai-msg-in  { from { opacity:0; transform:translateY(6px) scale(0.98) } to { opacity:1; transform:translateY(0) scale(1) } }
  @keyframes ai-dot     { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-4px) } }
`

// ── Shared input style ────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: 8,
  padding: '8px 10px', fontSize: 13, color: '#1e293b', background: '#fff',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  lineHeight: 1.55, transition: 'border-color 0.15s, box-shadow 0.15s',
}
const focusField = (el: HTMLElement) => {
  el.style.borderColor = '#6366f1'
  el.style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.12)'
}
const blurField = (el: HTMLElement) => {
  el.style.borderColor = '#e2e8f0'
  el.style.boxShadow   = 'none'
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiAssistant() {
  const { role } = useAuthStore()
  const { messages, sending, send, clearHistory } = useAiChat()

  const [open, setOpen]     = useState(false)
  const [visible, setVisible] = useState(false)
  const [input, setInput]   = useState('')

  const panelRef   = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)

  // Animate panel in / out
  useEffect(() => {
    if (open) {
      setVisible(true)
      setTimeout(() => inputRef.current?.focus(), 120)
    } else {
      const t = setTimeout(() => setVisible(false), 250)
      return () => clearTimeout(t)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [open])

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return
    setInput('')
    await send(trimmed)
    inputRef.current?.focus()
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!role) return null

  const suggestions = SUGGESTED_QUESTIONS[role]
  const isEntering  = open && visible

  return createPortal(
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Floating trigger ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        title="AI Assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 40,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
          boxShadow: open
            ? '0 2px 12px rgba(79,70,229,0.5)'
            : '0 4px 24px rgba(99,102,241,0.45), 0 2px 8px rgba(0,0,0,0.12)',
          color: '#fff',
          transition: 'box-shadow 0.2s ease, transform 0.15s ease',
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.transform = 'scale(1)' }}
      >
        {open ? <ChevronDown size={20} /> : <Sparkles size={20} />}
      </button>

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      {visible && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="AI Assistant"
          aria-modal="false"
          style={{
            position: 'fixed', bottom: 88, right: 24, zIndex: 40,
            width: 'min(400px, calc(100vw - 32px))',
            height: 'min(540px, calc(100vh - 112px))',
            background: '#fff', borderRadius: 20,
            border: '1px solid #E2E8F0',
            boxShadow: '0 20px 60px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08)',
            opacity:   isEntering ? 1 : 0,
            transform: isEntering ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(16px)',
            transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.2,0.64,1)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
            padding: '14px 16px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={17} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                  ServiceMarket Assistant
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', margin: 0, marginTop: 2 }}>
                  Ask me anything about the platform
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {messages.length > 0 && (
                <button
                  onClick={clearHistory}
                  title="Clear conversation"
                  aria-label="Clear conversation"
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.15)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Message area */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 14px 8px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 ? (
              /* Welcome / empty state */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 18, margin: '0 auto 12px',
                    background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(79,70,229,0.18))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Bot size={24} style={{ color: '#6366f1' }} />
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', margin: '0 0 6px' }}>
                    Hi! I'm your ServiceMarket Assistant
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                    Ask me how features work, what statuses mean,<br />
                    or anything else about the platform.
                  </p>
                </div>

                <div>
                  <p style={{
                    fontSize: 10.5, fontWeight: 600, color: '#94a3b8',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
                  }}>
                    Try asking…
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {suggestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        style={{
                          textAlign: 'left', padding: '8px 12px', borderRadius: 9,
                          border: '1px solid #e2e8f0', background: '#f8fafc',
                          color: '#334155', fontSize: 12.5, cursor: 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#c7d2fe'
                          e.currentTarget.style.background  = 'rgba(99,102,241,0.05)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.background  = '#f8fafc'
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Conversation */
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-end', gap: 8,
                      animation: 'ai-msg-in 0.22s ease',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg,#1E3A5F,#3B82F6)'
                        : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {msg.role === 'user'
                        ? <User size={13} color="#fff" />
                        : <Bot  size={13} color="#fff" />}
                    </div>

                    {/* Bubble */}
                    <div style={{
                      maxWidth: '78%', padding: '9px 12px',
                      borderRadius: msg.role === 'user'
                        ? '14px 14px 4px 14px'
                        : '14px 14px 14px 4px',
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
                        : '#f1f5f9',
                      color:    msg.role === 'user' ? '#fff' : '#1e293b',
                      fontSize:  12.5, lineHeight: 1.65,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {sending && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, animation: 'ai-msg-in 0.2s ease' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Bot size={13} color="#fff" />
                    </div>
                    <div style={{
                      padding: '11px 14px', borderRadius: '14px 14px 14px 4px',
                      background: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      {[0, 0.18, 0.36].map((delay, i) => (
                        <div key={i} style={{
                          width: 6, height: 6, borderRadius: '50%', background: '#94a3b8',
                          animation: `ai-dot 0.9s ease ${delay}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid #f1f5f9',
            display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about ServiceMarket…"
              rows={1}
              maxLength={1000}
              style={{ ...inputBase, resize: 'none', flexGrow: 1, maxHeight: 96, overflowY: 'auto' }}
              onFocus={(e) => focusField(e.target)}
              onBlur={(e)  => blurField(e.target)}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 96)}px`
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              aria-label="Send message"
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
                cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                background: input.trim() && !sending
                  ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
                  : '#f1f5f9',
                color: input.trim() && !sending ? '#fff' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              {sending
                ? <Loader2 size={15} style={{ animation: 'ai-spin 1s linear infinite' }} />
                : <Send size={15} />}
            </button>
          </div>

          {/* Footer */}
          <div style={{
            padding: '7px 16px', borderTop: '1px solid #f1f5f9', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <Sparkles size={10} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              Responses are limited to ServiceMarket context only
            </span>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
