import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import Register from './pages/Register'
import CustomerDashboard from './pages/customer/CustomerDashboard'
import ProviderDashboard from './pages/provider/ProviderDashboard'
import OrgPanel from './pages/provider/OrgPanel'
import AdminPanel from './pages/admin/AdminPanel'
import ProtectedRoute from './components/ProtectedRoute'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/customer"
            element={
              <ProtectedRoute roles={['Customer']}>
                <CustomerDashboard />
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
            path="/org"
            element={
              <ProtectedRoute roles={['ProviderAdmin']}>
                <OrgPanel />
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

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
