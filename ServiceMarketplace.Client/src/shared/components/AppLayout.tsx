import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MapPin, Users, Building2,
  Menu, X, Briefcase, Bell, CheckCircle2,
  MessageSquare, BriefcaseBusiness, Clock, Trash2,
  UserPlus, UserMinus, CreditCard, ShieldCheck,
  Activity, ScrollText,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore, type AppNotification } from '../store/notificationStore'
import { usePermissions } from '../hooks/usePermissions'
import { timeAgo } from '../utils/format'
import { ROUTES } from '../constants/routes'
import { PERMISSIONS } from '../constants/permissions'
import AiAssistant from './AiAssistant'
import UserProfileDropdown from './UserProfileDropdown'
import SidebarUserProfile from './SidebarUserProfile'

interface NavItem {
  label:       string
  to:          string
  icon:        React.ReactNode
  /** If set, the item is only shown when the user holds this permission. */
  permission?: string
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  Customer: [
    { label: 'Dashboard',       to: ROUTES.CUSTOMER,              icon: <LayoutDashboard size={16} /> },
    { label: 'My Requests',     to: ROUTES.CUSTOMER_REQUESTS,     icon: <Briefcase       size={16} /> },
    { label: 'Chats',           to: ROUTES.CHATS,                 icon: <MessageSquare   size={16} /> },
    { label: 'Subscription',    to: ROUTES.CUSTOMER_SUBSCRIPTION, icon: <CreditCard      size={16} /> },
    { label: 'My Organization', to: ROUTES.CUSTOMER_ORG,          icon: <Building2       size={16} />, permission: PERMISSIONS.ORG_VIEW },
    { label: 'My Activity',     to: ROUTES.ACTIVITY,              icon: <Activity        size={16} /> },
  ],
  ProviderEmployee: [
    { label: 'Dashboard',       to: ROUTES.PROVIDER,      icon: <LayoutDashboard size={16} /> },
    { label: 'My Jobs',         to: ROUTES.PROVIDER_JOBS, icon: <Briefcase       size={16} /> },
    { label: 'Jobs Map',        to: ROUTES.PROVIDER_MAP,  icon: <MapPin          size={16} /> },
    { label: 'Chats',           to: ROUTES.CHATS,         icon: <MessageSquare   size={16} /> },
    { label: 'My Organization', to: ROUTES.PROVIDER_ORG,  icon: <Building2       size={16} />, permission: PERMISSIONS.ORG_VIEW },
    { label: 'My Activity',     to: ROUTES.ACTIVITY,      icon: <Activity        size={16} /> },
  ],
  ProviderAdmin: [
    { label: 'Dashboard',    to: ROUTES.PROVIDER,      icon: <LayoutDashboard size={16} /> },
    { label: 'My Jobs',      to: ROUTES.PROVIDER_JOBS, icon: <Briefcase       size={16} /> },
    { label: 'Jobs Map',     to: ROUTES.PROVIDER_MAP,  icon: <MapPin          size={16} /> },
    { label: 'Chats',        to: ROUTES.CHATS,         icon: <MessageSquare   size={16} /> },
    { label: 'Organization', to: ROUTES.ORG,           icon: <Building2       size={16} />, permission: PERMISSIONS.ORG_VIEW },
    { label: 'My Activity',  to: ROUTES.ACTIVITY,      icon: <Activity        size={16} /> },
  ],
  Admin: [
    { label: 'User Management',     to: ROUTES.ADMIN,       icon: <Users       size={16} />, permission: PERMISSIONS.ADMIN_MANAGE_USERS },
    { label: 'All Jobs',            to: ROUTES.ADMIN_JOBS,  icon: <Briefcase   size={16} />, permission: PERMISSIONS.ADMIN_MANAGE_USERS },
    { label: 'Organisations',       to: ROUTES.ADMIN_ORGS,  icon: <Building2   size={16} />, permission: PERMISSIONS.ADMIN_MANAGE_USERS },
    { label: 'Roles & Permissions', to: ROUTES.ADMIN_ROLES, icon: <ShieldCheck size={16} />, permission: PERMISSIONS.ADMIN_MANAGE_USERS },
    { label: 'System Logs',         to: ROUTES.ADMIN_LOGS,  icon: <ScrollText  size={16} />, permission: PERMISSIONS.ADMIN_MANAGE_USERS },
  ],
}

const SIDEBAR_GRADIENT = 'linear-gradient(180deg, #1E3A5F 0%, #0A1628 100%)'
const DIVIDER           = '1px solid rgba(255,255,255,0.08)'
const INACTIVE_COLOR    = 'rgba(255,255,255,0.5)'
const ACTIVE_BG         = 'rgba(59,130,246,0.18)'
const ACTIVE_COLOR      = '#93C5FD'
const AVATAR_BG         = 'rgba(147,197,253,0.15)'

// ── Notification helpers ──────────────────────────────────────────────────────

const NOTIF_ICON: Record<AppNotification['type'], { icon: React.ReactNode; bg: string; color: string }> = {
  new_job:          { icon: <BriefcaseBusiness size={14} />, bg: 'rgba(99,102,241,0.1)',  color: '#6366f1' },
  job_accepted:     { icon: <CheckCircle2      size={14} />, bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  job_confirmed:    { icon: <CheckCircle2      size={14} />, bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
  message:          { icon: <MessageSquare     size={14} />, bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  confirm_needed:   { icon: <Clock             size={14} />, bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  org_added:            { icon: <UserPlus   size={14} />, bg: 'rgba(16,185,129,0.1)',  color: '#10b981' },
  org_removed:          { icon: <UserMinus  size={14} />, bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' },
  subscription_changed: { icon: <CreditCard size={14} />, bg: 'rgba(99,102,241,0.1)',  color: '#6366f1' },
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { email, role, logout } = useAuthStore()
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()

  // Keep only items whose permission is either absent (always visible)
  // or currently held by the user. hasPermission() short-circuits to true
  // for Admin and to false while the permissions fetch is in-flight.
  const items = (role ? NAV_ITEMS[role] ?? [] : []).filter(
    (item) => !item.permission || hasPermission(item.permission),
  )

  return (
    <div className="flex flex-col h-full w-full" style={{ background: SIDEBAR_GRADIENT }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 shrink-0" style={{ borderBottom: DIVIDER }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: AVATAR_BG }}>
          <MapPin size={15} style={{ color: ACTIVE_COLOR }} />
        </div>
        <span className="font-bold text-[13px] tracking-tight text-white select-none">ServiceMarket</span>
      </div>

      {/* Section label */}
      <p className="px-5 pt-6 pb-2 text-[10px] font-semibold uppercase tracking-widest select-none"
        style={{ color: 'rgba(255,255,255,0.28)' }}>
        Main Menu
      </p>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-[3px]">
        {items.map((item) => (
          <NavLink
            key={item.to} to={item.to} end onClick={onNavigate}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 sidebar-nav-item"
            style={({ isActive }) =>
              isActive ? { background: ACTIVE_BG, color: ACTIVE_COLOR } : { color: INACTIVE_COLOR }
            }
          >
            {item.icon}{item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer / Profile */}
      <SidebarUserProfile
        email={email}
        role={role}
        onLogout={() => { logout(); navigate('/login', { replace: true }) }}
      />
    </div>
  )
}

// ── Notification panel ────────────────────────────────────────────────────────

interface NotificationPanelProps {
  onClose:   () => void
  onNavigate: (path: string) => void
}

function NotificationPanel({ onClose, onNavigate }: NotificationPanelProps) {
  const { items, markRead, markAllRead, clear } = useNotificationStore()
  const unread = items.filter((n) => !n.read).length

  const handleItemClick = (n: AppNotification) => {
    // Mark this specific notification as read on explicit interaction.
    // The markRead action also broadcasts the change to all other open tabs
    // via BroadcastChannel so their unread counts stay accurate.
    if (!n.read) markRead(n.id)
    if (n.link) {
      onNavigate(n.link)
      onClose()
    }
  }

  return (
    <div
      className="absolute right-0 top-11 z-50 w-[min(340px,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl overflow-hidden"
      style={{
        border: '1px solid #E2E8F0',
        animation: 'notifSlideIn 0.18s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);     }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          {unread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ background: '#6366f1' }}>
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button onClick={markAllRead}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              Mark all read
            </button>
          )}
          {items.length > 0 && (
            <button onClick={clear}
              className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Clear all">
              <Trash2 size={13} />
            </button>
          )}
          <button onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Bell size={20} className="text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">All caught up</p>
              <p className="text-xs text-slate-400 mt-0.5">No notifications yet</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((n) => {
              const meta = NOTIF_ICON[n.type]
              return (
                <li key={n.id}>
                  {/* Each notification is a button so keyboard users can interact.
                      Clicking marks it as read (explicit user action) and navigates
                      to the relevant section if a link is provided. */}
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/80"
                    style={{ background: n.read ? 'transparent' : 'rgba(99,102,241,0.025)' }}
                  >
                    {/* Type icon */}
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: meta.bg, color: meta.color }}>
                      {meta.icon}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${n.read ? 'text-slate-600' : 'text-slate-900'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">{timeAgo(n.at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: '#6366f1' }} />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-4 py-2.5 text-center" style={{ borderTop: '1px solid #F1F5F9' }}>
          <p className="text-[11px] text-slate-400">
            {items.length} notification{items.length !== 1 ? 's' : ''}
            {unread > 0 ? ` · ${unread} unread` : ' · all read'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── AppLayout ─────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode
  title?: string
}

export default function AppLayout({ children, title }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen]     = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { email, role, logout } = useAuthStore()
  const { items } = useNotificationStore()
  const unreadCount = items.filter((n) => !n.read).length

  // Close notification dropdown when clicking outside.
  useEffect(() => {
    if (!notifOpen) return
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  // Toggle the notification panel — intentionally does NOT mark anything as
  // read. Read state is only updated by explicit user actions: clicking an
  // individual notification item or pressing "Mark all read".
  const handleBellClick = () => { setNotifOpen((prev) => !prev); setProfileOpen(false) }

  const handleProfileToggle = () => { setProfileOpen((prev) => !prev); setNotifOpen(false) }

  const handleLogout = () => { logout(); navigate('/login', { replace: true }) }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F0F4F8' }}>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col shrink-0" style={{ width: 215 }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col shadow-2xl" style={{ width: 215 }}>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg z-10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <X size={16} />
            </button>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="flex items-center justify-between px-4 sm:px-6 shrink-0"
          style={{ height: 56, background: '#ffffff', borderBottom: '1px solid #E8EDF3' }}
        >
          {/* Mobile hamburger */}
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: '#64748B' }}>
            <Menu size={20} />
          </button>

          {/* Page title */}
          {title && (
            <h1 className="hidden lg:block text-[15px] font-semibold" style={{ color: '#1E293B' }}>
              {title}
            </h1>
          )}
          <div className="lg:hidden" />

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">

            {/* Bell with badge + dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={handleBellClick}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative"
                style={{
                  background: notifOpen ? '#EEF2FF' : '#F8FAFC',
                  border: `1px solid ${notifOpen ? '#C7D2FE' : '#E2E8F0'}`,
                  color: notifOpen ? '#6366f1' : '#64748B',
                }}
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-white font-bold"
                    style={{ fontSize: 9, background: '#ef4444', boxShadow: '0 0 0 2px #fff' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <NotificationPanel
                  onClose={() => setNotifOpen(false)}
                  onNavigate={(path) => navigate(path)}
                />
              )}
            </div>

            {/* Avatar + profile dropdown */}
            <UserProfileDropdown
              email={email}
              role={role}
              isOpen={profileOpen}
              onToggle={handleProfileToggle}
              onClose={() => setProfileOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6">
          {children}
        </main>
      </div>

      {/* Global AI Writing Assistant — available to all authenticated users on every page */}
      <AiAssistant />
    </div>
  )
}
