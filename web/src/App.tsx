import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

// Eager load - HomePage is included in initial bundle
import HomePage from './pages/HomePage'

// Lazy load - Load on demand
const MembershipsPage = lazy(() => import('./pages/MembershipsPage'))
const ConversationPage = lazy(() => import('./pages/ConversationPage'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminMembershipTypes = lazy(() => import('./pages/admin/AdminMembershipTypes'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'))

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">로딩 중...</div>
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* User Pages */}
        <Route path="/" element={<HomePage />} />
        <Route path="/memberships" element={<MembershipsPage />} />
        <Route path="/conversation" element={<ConversationPage />} />

        {/* Admin Pages */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/membership-types" element={<AdminMembershipTypes />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/users/:id" element={<AdminUserDetail />} />
      </Routes>
    </Suspense>
  )
}

export default App
