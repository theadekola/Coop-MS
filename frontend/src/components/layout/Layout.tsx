import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import SecondaryPanel from './SecondaryPanel'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/staff': 'Staff Management',
  '/staff/add': 'Add New Staff',
  '/management': 'Management Overview',
  '/accounts': 'Accounts',
  '/trading': 'Trading Account',
  '/trial-balance': 'Trial Balance',
  '/audit': 'Audit Trail',
  '/reports': 'Reports',
  '/chat': 'Chat',
  '/profile': 'My Profile',
  '/settings': 'Settings',
  '/settings/company-profile': 'Company Profile',
  '/admin/company-profile': 'Company Profile',
  '/settings/user-management': 'User Management',
  '/settings/roles-permissions': 'Roles & Permissions',
  '/settings/general': 'General Settings',
  '/settings/financial': 'Financial Settings',
  '/settings/tax': 'Tax Settings',
  '/settings/notifications': 'Notifications',
  '/settings/security': 'Security',
  '/settings/password-reset': 'Password Reset',
  '/settings/system-logs': 'System Logs',
  '/settings/backup-restore': 'Backup & Restore',
  '/settings/integrations': 'Integrations',
  '/admin/dashboard': 'Admin Dashboard',
  '/admin/users': 'User Management',
  '/admin/register-user': 'Register New User',
  '/admin/roles': 'Roles & Permissions',
}

export default function Layout() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] || 'Dashboard'

  return (
    <div className="flex h-screen min-h-[100dvh] overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar title={title} />
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <SecondaryPanel />
          <main className="flex-1 overflow-y-auto min-w-0">
            <div className="animate-fadeIn">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
