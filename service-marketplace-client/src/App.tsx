import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import SignalRProvider from './components/SignalRProvider'
import Login from './pages/Login'
import Register from './pages/Register'
import CustomerDashboard from './pages/customer/CustomerDashboard'
import CustomerRequests from './pages/customer/CustomerRequests'
import SubscriptionPage from './pages/customer/SubscriptionPage'
import SubscriptionSuccess from './pages/customer/SubscriptionSuccess'
import Chats from './pages/Chats'
import ProviderDashboard from './pages/provider/ProviderDashboard'
import ProviderJobs from './pages/provider/ProviderJobs'
import CompletedJobs from './pages/provider/CompletedJobs'
import ActiveJobs from './pages/provider/ActiveJobs'
import OrgPanel from './pages/provider/OrgPanel'
import ProviderOrgStatus from './pages/provider/ProviderOrgStatus'
import CustomerOrgView from './pages/customer/CustomerOrgView'
import AdminPanel from './pages/admin/AdminPanel'
import AdminRoles from './pages/admin/AdminRoles'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import ErrorBoundary from './components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // switching tabs won't trigger redundant API calls
    },
  },
})

function AppRoutes() {
  const initialize = useAuthStore((s) => s.initialize)
  const isInitialized = useAuthStore((s) => s.isInitialized)

  useEffect(() => {
    initialize()
  }, [initialize])

  // Hold all rendering until the stored token has been validated.
  // This prevents a single-frame flash where ProtectedRoute redirects to /login
  // before the store hydration + expiry check is complete.
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
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      <Route
        path="/customer"
        element={
          <ProtectedRoute roles={['Customer']}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/customer/requests"
        element={
          <ProtectedRoute roles={['Customer']}>
            <CustomerRequests />
          </ProtectedRoute>
        }
      />

      <Route
        path="/customer/subscription"
        element={
          <ProtectedRoute roles={['Customer']}>
            <SubscriptionPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/customer/subscription/success"
        element={
          <ProtectedRoute roles={['Customer']}>
            <SubscriptionSuccess />
          </ProtectedRoute>
        }
      />

      <Route
        path="/customer/org"
        element={
          <ProtectedRoute roles={['Customer']}>
            <CustomerOrgView />
          </ProtectedRoute>
        }
      />

      <Route
        path="/provider"
        element={
          <ProtectedRoute roles={['ProviderEmployee', 'ProviderAdmin']}>
            <ProviderDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/provider/jobs"
        element={
          <ProtectedRoute roles={['ProviderEmployee', 'ProviderAdmin']}>
            <ProviderJobs />
          </ProtectedRoute>
        }
      />

      <Route
        path="/provider/active"
        element={
          <ProtectedRoute roles={['ProviderEmployee', 'ProviderAdmin']}>
            <ActiveJobs />
          </ProtectedRoute>
        }
      />

      <Route
        path="/provider/completed"
        element={
          <ProtectedRoute roles={['ProviderEmployee', 'ProviderAdmin']}>
            <CompletedJobs />
          </ProtectedRoute>
        }
      />

      <Route
        path="/org"
        element={
          <ProtectedRoute roles={['ProviderAdmin']}>
            <OrgPanel />
          </ProtectedRoute>
        }
      />

      <Route
        path="/provider/org"
        element={
          <ProtectedRoute roles={['ProviderEmployee']}>
            <ProviderOrgStatus />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['Admin']}>
            <AdminPanel />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/roles"
        element={
          <ProtectedRoute roles={['Admin']}>
            <AdminRoles />
          </ProtectedRoute>
        }
      />

      <Route
        path="/chats"
        element={
          <ProtectedRoute roles={['Customer', 'ProviderEmployee', 'ProviderAdmin']}>
            <Chats />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Toaster position="top-right" />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
