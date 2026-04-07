import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MapPin, Users, Building2,
  Menu, X, LogOut, Briefcase, Bell, CheckCircle2,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

interface NavItem { label: string; to: string; icon: React.ReactNode }

const NAV_ITEMS: Record<string, NavItem[]> = {
  Customer:        [{ label: 'Dashboard',      to: '/customer',           icon: <LayoutDashboard size={16} /> }],
  ProviderEmployee:[
    { label: 'Jobs',           to: '/provider',           icon: <Briefcase     size={16} /> },
    { label: 'Completed Jobs', to: '/provider/completed', icon: <CheckCircle2  size={16} /> },
  ],
  ProviderAdmin:   [
    { label: 'Jobs',           to: '/provider',           icon: <Briefcase     size={16} /> },
    { label: 'Completed Jobs', to: '/provider/completed', icon: <CheckCircle2  size={16} /> },
    { label: 'Organization',   to: '/org',                icon: <Building2     size={16} /> },
  ],
  Admin:           [{ label: 'User Management', to: '/admin',   icon: <Users           size={16} /> }],
}

const SIDEBAR_GRADIENT = 'linear-gradient(180deg, #1E3A5F 0%, #0A1628 100%)'
const DIVIDER           = '1px solid rgba(255,255,255,0.08)'
const INACTIVE_COLOR    = 'rgba(255,255,255,0.5)'
const ACTIVE_BG         = 'rgba(59,130,246,0.18)'
const ACTIVE_COLOR      = '#93C5FD'
const AVATAR_BG         = 'rgba(147,197,253,0.15)'

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { email, role, logout } = useAuthStore()
  const navigate = useNavigate()
  const items    = (role && NAV_ITEMS[role]) ?? []
  const initials = (email ?? 'U').slice(0, 2).toUpperCase()

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ background: SIDEBAR_GRADIENT }}
    >
      {/* ── Logo ─────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 py-5 shrink-0"
        style={{ borderBottom: DIVIDER }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: AVATAR_BG }}
        >
          <MapPin size={15} style={{ color: ACTIVE_COLOR }} />
        </div>
        <span className="font-bold text-[13px] tracking-tight text-white select-none">
          ServiceMarket
        </span>
      </div>

      {/* ── Section label ────────────────────────────── */}
      <p
        className="px-5 pt-6 pb-2 text-[10px] font-semibold uppercase tracking-widest select-none"
        style={{ color: 'rgba(255,255,255,0.28)' }}
      >
        Main Menu
      </p>

      {/* ── Navigation ───────────────────────────────── */}
      <nav className="flex-1 px-3 space-y-[3px]">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            onClick={onNavigate}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 sidebar-nav-item"
            style={({ isActive }) =>
              isActive
                ? { background: ACTIVE_BG, color: ACTIVE_COLOR }
                : { color: INACTIVE_COLOR }
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer / Profile ─────────────────────────── */}
      <div
        className="px-4 py-4 shrink-0"
        style={{ borderTop: DIVIDER }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none"
            style={{ background: AVATAR_BG, color: ACTIVE_COLOR }}
          >
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate leading-tight">
              {email}
            </p>
            <p
              className="text-[10px] mt-0.5 truncate leading-tight"
              style={{ color: 'rgba(255,255,255,0.38)' }}
            >
              {role}
            </p>
          </div>

          <button
            onClick={() => { logout(); navigate('/login', { replace: true }) }}
            className="p-1.5 rounded-md shrink-0 transition-colors sidebar-logout-btn"
            style={{ color: 'rgba(255,255,255,0.38)' }}
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  children: React.ReactNode
  title?: string
}

export default function AppLayout({ children, title }: Props) {
  const [open, setOpen] = useState(false)
  const { email } = useAuthStore()
  const initials = (email ?? 'U').slice(0, 2).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F0F4F8' }}>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col shrink-0"
        style={{ width: 215 }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative z-50 flex flex-col shadow-2xl" style={{ width: 215 }}>
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg z-10 transition-colors"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <X size={16} />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 shrink-0"
          style={{
            height: 56,
            background: '#ffffff',
            borderBottom: '1px solid #E8EDF3',
          }}
        >
          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: '#64748B' }}
          >
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
          <div className="flex items-center gap-2.5">
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}
            >
              <Bell size={15} />
            </button>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white select-none"
              style={{ background: 'linear-gradient(135deg,#1E3A5F,#3B82F6)' }}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-5 sm:px-7 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
