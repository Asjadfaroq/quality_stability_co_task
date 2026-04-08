import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '../shared/store/authStore'
import { ROUTES } from '../shared/constants/routes'
import SignalRProvider from '../shared/components/SignalRProvider'
import Login from '../features/auth/pages/Login'
import Register from '../features/auth/pages/Register'
import CustomerDashboard from '../features/customer/pages/CustomerDashboard'
import CustomerRequests from '../features/customer/pages/CustomerRequests'
import SubscriptionPage from '../features/customer/pages/SubscriptionPage'
import SubscriptionSuccess from '../features/customer/pages/SubscriptionSuccess'
import Chats from '../features/chat/Chats'
import ProviderDashboard from '../features/provider/pages/ProviderDashboard'
import ProviderJobs from '../features/provider/pages/ProviderJobs'
import OrgPanel from '../features/provider/pages/OrgPanel'
import ProviderOrgStatus from '../features/provider/pages/ProviderOrgStatus'
import ProviderMapPage from '../features/provider/pages/ProviderMapPage'
import CustomerOrgView from '../features/customer/pages/CustomerOrgView'
import AdminPanel from '../features/admin/pages/AdminPanel'
import AdminRoles from '../features/admin/pages/AdminRoles'
import AdminJobs from '../features/admin/pages/AdminJobs'
import AdminOrgs from '../features/admin/pages/AdminOrgs'
import ProtectedRoute from '../shared/components/ProtectedRoute'
import PublicRoute from '../shared/components/PublicRoute'
import ErrorBoundary from '../shared/components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

function AppRoutes() {
  const initialize    = useAuthStore((s) => s.initialize)
  const isInitialized = useAuthStore((s) => s.isInitialized)

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {/* Single SignalR connection for the entire session — must not live inside
          AppLayout, which remounts on every navigation. */}
      <SignalRProvider />
      <Routes>
        <Route path={ROUTES.LOGIN} element={<PublicRoute><Login /></PublicRoute>} />
        <Route path={ROUTES.REGISTER} element={<PublicRoute><Register /></PublicRoute>} />

        {/* Customer */}
        <Route path={ROUTES.CUSTOMER} element={<ProtectedRoute roles={['Customer']}><CustomerDashboard /></ProtectedRoute>} />
        <Route path={ROUTES.CUSTOMER_REQUESTS} element={<ProtectedRoute roles={['Customer']}><CustomerRequests /></ProtectedRoute>} />
        <Route path={ROUTES.CUSTOMER_SUBSCRIPTION} element={<ProtectedRoute roles={['Customer']}><SubscriptionPage /></ProtectedRoute>} />
        <Route path={ROUTES.CUSTOMER_SUBSCRIPTION_SUCCESS} element={<ProtectedRoute roles={['Customer']}><SubscriptionSuccess /></ProtectedRoute>} />
        <Route path={ROUTES.CUSTOMER_ORG} element={<ProtectedRoute roles={['Customer']}><CustomerOrgView /></ProtectedRoute>} />

        {/* Provider */}
        <Route path={ROUTES.PROVIDER} element={<ProtectedRoute roles={['ProviderEmployee', 'ProviderAdmin']}><ProviderDashboard /></ProtectedRoute>} />
        <Route path={ROUTES.PROVIDER_JOBS} element={<ProtectedRoute roles={['ProviderEmployee', 'ProviderAdmin']}><ProviderJobs /></ProtectedRoute>} />
        <Route path={ROUTES.PROVIDER_MAP} element={<ProtectedRoute roles={['ProviderEmployee', 'ProviderAdmin']}><ProviderMapPage /></ProtectedRoute>} />
        <Route path={ROUTES.ORG} element={<ProtectedRoute roles={['ProviderAdmin']}><OrgPanel /></ProtectedRoute>} />
        <Route path={ROUTES.PROVIDER_ORG} element={<ProtectedRoute roles={['ProviderEmployee']}><ProviderOrgStatus /></ProtectedRoute>} />

        {/* Admin */}
        <Route path={ROUTES.ADMIN} element={<ProtectedRoute roles={['Admin']}><AdminPanel /></ProtectedRoute>} />
        <Route path={ROUTES.ADMIN_JOBS} element={<ProtectedRoute roles={['Admin']}><AdminJobs /></ProtectedRoute>} />
        <Route path={ROUTES.ADMIN_ORGS} element={<ProtectedRoute roles={['Admin']}><AdminOrgs /></ProtectedRoute>} />
        <Route path={ROUTES.ADMIN_ROLES} element={<ProtectedRoute roles={['Admin']}><AdminRoles /></ProtectedRoute>} />

        {/* Shared */}
        <Route path={ROUTES.CHATS} element={<ProtectedRoute roles={['Customer', 'ProviderEmployee', 'ProviderAdmin']}><Chats /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to={ROUTES.LOGIN} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Toaster
          position="top-right"
          gutter={10}
          containerStyle={{ top: 20, right: 20 }}
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '13.5px',
              fontWeight: 500,
              lineHeight: '1.45',
              padding: '11px 14px',
              boxShadow: '0 4px 24px rgba(15,23,42,0.08), 0 1px 6px rgba(15,23,42,0.04)',
              border: '1px solid #f1f5f9',
              maxWidth: '340px',
            },
            success: {
              iconTheme: { primary: '#16a34a', secondary: '#dcfce7' },
              style: { borderLeft: '3.5px solid #16a34a' },
            },
            error: {
              iconTheme: { primary: '#dc2626', secondary: '#fee2e2' },
              style: { borderLeft: '3.5px solid #dc2626' },
            },
            loading: {
              iconTheme: { primary: '#6366f1', secondary: '#e0e7ff' },
              style: { borderLeft: '3.5px solid #6366f1' },
            },
          }}
        />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
