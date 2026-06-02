import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import BookLease from './pages/BookLease'
import MyLeases from './pages/MyLeases'
import Finance from './pages/Finance'
import Projects from './pages/Projects'
import People from './pages/People'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="laptops" element={<Inventory assetType="laptop" />} />
              <Route path="pdas" element={<Inventory assetType="pda" />} />
              <Route path="book" element={<BookLease />} />
              <Route path="my-leases" element={<MyLeases />} />
              <Route
                path="finance"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'finance']}>
                    <Finance />
                  </ProtectedRoute>
                }
              />
              <Route path="projects" element={<Projects />} />
              <Route
                path="people"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <People />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'finance', 'project_manager']}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Settings />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
