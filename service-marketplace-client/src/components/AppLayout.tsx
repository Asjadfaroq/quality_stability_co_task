import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, MapPin, Users, Building2, Menu, X,
  LogOut, ChevronRight, Briefcase,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getDashboardPath } from '../utils/auth'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  Customer: [
    { label: 'My Requests', to: '/customer', icon: <LayoutDashboard size={18} /> },
  ],
  ProviderEmployee: [
    { label: 'Available Jobs',  to: '/provider', icon: <Briefcase   size={18} /> },
  ],
  ProviderAdmin: [
    { label: 'Available Jobs',  to: '/provider', icon: <Briefcase   size={18} /> },
    { label: 'Organization',    to: '/org',      icon: <Building2   size={18} /> },
  ],
  Admin: [
    { label: 'User Management', to: '/admin',    icon: <Users       size={18} /> },
  ],
}

function UserAvatar({ email }: { email: string }) {
  const initials = email.slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
      {initials}
    </div>
  )
}

interface SidebarContentProps {
  onNavigate?: () => void
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const { email, role, logout } = useAuthStore()
  const navigate = useNavigate()
  const items = (role && NAV_ITEMS[role]) ?? []

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <MapPin size={16} className="text-white" />
          </div>
          <span className="text-[15px] font-semibold text-gray-900 tracking-tight">
            ServiceMarket
          </span>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-4 pt-4 pb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
          {role}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-2 pb-4 space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>
                  {item.icon}
                </span>
                {item.label}
                {isActive && <ChevronRight size={14} className="ml-auto text-blue-500" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 mb-3">
          <UserAvatar email={email ?? ''} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{email}</p>
            <p className="text-xs text-gray-400">{getDashboardPath(role).slice(1)}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors duration-150"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  )
}

interface Props {
  children: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
}

export default function AppLayout({ children, title, description, actions }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-gray-200">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-50 flex flex-col w-72 bg-white shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-900">ServiceMarket</span>
          <div className="w-9" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

            {/* Page header */}
            <div className="flex items-start justify-between mb-6 sm:mb-8 gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
                {description && (
                  <p className="text-sm text-gray-500 mt-1">{description}</p>
                )}
              </div>
              {actions && <div className="shrink-0">{actions}</div>}
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
