import { Routes, Route } from 'react-router-dom'

// Pages
import HomePage from './pages/HomePage'
import MembershipsPage from './pages/MembershipsPage'
import ConversationPage from './pages/ConversationPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminMembershipTypes from './pages/admin/AdminMembershipTypes'
import AdminUsers from './pages/admin/AdminUsers'
import AdminUserDetail from './pages/admin/AdminUserDetail'

function App() {
  return (
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
  )
}

export default App
