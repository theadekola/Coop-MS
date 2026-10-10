import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StaffManagement from './pages/StaffManagement'
import AddStaff from './pages/AddStaff'
import Management from './pages/Management'
import Accounts from './pages/Accounts'
import ChartOfAccounts from './pages/ChartOfAccounts'
import TradingAccount from './pages/TradingAccount'
import TrialBalance from './pages/TrialBalance'
import Audit from './pages/Audit'
import Reports from './pages/Reports'
import ReportBuilder from './pages/ReportBuilder'
import Chat from './pages/Chat'
import Settings from './pages/Settings'
import Profile from './pages/Profile'

// Settings sub-pages
import UserManagement from './pages/settings/UserManagement'
import RolesPermissions from './pages/settings/RolesPermissions'
import GeneralSettings from './pages/settings/GeneralSettings'
import FinancialSettings from './pages/settings/FinancialSettings'
import TaxSettings from './pages/settings/TaxSettings'
import Notifications from './pages/settings/Notifications'
import Security from './pages/settings/Security'
import PasswordReset from './pages/settings/PasswordReset'
import SystemLogs from './pages/settings/SystemLogs'
import BackupRestore from './pages/settings/BackupRestore'
import Integrations from './pages/settings/Integrations'
import CompanyProfile from './pages/settings/CompanyProfile'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminStaffManagement from './pages/admin/StaffManagement'
import AdminUserManagement from './pages/admin/UserManagementAdmin'
import RolesPermissionsEdit from './pages/admin/RolesPermissionsEdit'
import RegisterNewUser from './pages/admin/RegisterNewUser'
import AdminRegistration from './pages/admin/AdminRegistration'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius: '10px', fontSize: '13px', fontFamily: 'Inter, sans-serif' },
        success: { iconTheme: { primary: '#16A34A', secondary: 'white' } },
        error: { iconTheme: { primary: '#DC2626', secondary: 'white' } },
      }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<PasswordReset />} />
        <Route path="/admin/register" element={<AdminRegistration />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<ProtectedRoute module="dashboard"><Dashboard /></ProtectedRoute>} />
          <Route path="staff" element={<ProtectedRoute module="staff"><StaffManagement /></ProtectedRoute>} />
          <Route path="staff/add" element={<ProtectedRoute module="staff"><AddStaff /></ProtectedRoute>} />
          <Route path="management" element={<ProtectedRoute module="management"><Management /></ProtectedRoute>} />
          <Route path="accounts" element={<ProtectedRoute module="accounts"><Accounts /></ProtectedRoute>} />
          <Route path="chart-of-accounts" element={<ProtectedRoute module="accounts"><ChartOfAccounts /></ProtectedRoute>} />
          <Route path="trading" element={<ProtectedRoute module="trading"><TradingAccount /></ProtectedRoute>} />
          <Route path="trial-balance" element={<ProtectedRoute module="trial-balance"><TrialBalance /></ProtectedRoute>} />
          <Route path="audit" element={<ProtectedRoute module="audit"><Audit /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute module="reports"><Reports /></ProtectedRoute>} />
          <Route path="reports/new" element={<ProtectedRoute module="reports"><ReportBuilder /></ProtectedRoute>} />
          <Route path="reports/schedule" element={<ProtectedRoute module="reports"><ReportBuilder /></ProtectedRoute>} />
          <Route path="chat" element={<ProtectedRoute module="chat"><Chat /></ProtectedRoute>} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<ProtectedRoute module="settings"><Settings /></ProtectedRoute>} />

          {/* Settings sub-pages */}
          <Route path="settings/user-management" element={<ProtectedRoute module="user-management"><UserManagement /></ProtectedRoute>} />
          <Route path="settings/roles-permissions" element={<ProtectedRoute module="roles-permissions"><RolesPermissions /></ProtectedRoute>} />
          <Route path="settings/general" element={<ProtectedRoute module="settings"><GeneralSettings /></ProtectedRoute>} />
          <Route path="settings/financial" element={<ProtectedRoute module="settings"><FinancialSettings /></ProtectedRoute>} />
          <Route path="settings/tax" element={<ProtectedRoute module="settings"><TaxSettings /></ProtectedRoute>} />
          <Route path="settings/notifications" element={<ProtectedRoute module="settings"><Notifications /></ProtectedRoute>} />
          <Route path="settings/security" element={<Security />} />
          <Route path="settings/password-reset" element={<ProtectedRoute module="settings"><PasswordReset /></ProtectedRoute>} />
          <Route path="settings/system-logs" element={<ProtectedRoute module="settings"><SystemLogs /></ProtectedRoute>} />
          <Route path="settings/backup-restore" element={<ProtectedRoute module="settings"><BackupRestore /></ProtectedRoute>} />
          <Route path="settings/integrations" element={<ProtectedRoute module="settings"><Integrations /></ProtectedRoute>} />
          <Route path="settings/company-profile" element={<ProtectedRoute module="settings"><CompanyProfile /></ProtectedRoute>} />

          {/* Admin section */}
          <Route path="admin/dashboard" element={<ProtectedRoute module="settings"><AdminDashboard /></ProtectedRoute>} />
          <Route path="admin/staff" element={<ProtectedRoute module="staff"><AdminStaffManagement /></ProtectedRoute>} />
          <Route path="admin/users" element={<ProtectedRoute module="user-management"><AdminUserManagement /></ProtectedRoute>} />
          <Route path="admin/roles" element={<ProtectedRoute module="roles-permissions"><RolesPermissionsEdit /></ProtectedRoute>} />
          <Route path="admin/register-user" element={<ProtectedRoute module="user-management"><RegisterNewUser /></ProtectedRoute>} />
          <Route path="admin/company-profile" element={<ProtectedRoute module="settings"><CompanyProfile /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
