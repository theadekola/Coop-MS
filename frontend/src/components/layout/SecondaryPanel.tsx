import { NavLink, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CreditCard,
  Database,
  FileText,
  FolderOpen,
  Globe,
  Hash,
  LayoutDashboard,
  LockKeyhole,
  MessageSquare,
  Percent,
  PieChart,
  Receipt,
  Scale,
  Shield,
  SlidersHorizontal,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { canAccessModule, type PermissionModuleId } from '../../services/permissions'
import { useRolePermissions } from '../../hooks/useRolePermissions'

type PanelItem = {
  label: string
  description: string
  to: string
  icon: LucideIcon
  module?: PermissionModuleId
}

const financialItems: PanelItem[] = [
  { label: 'Currency & General', description: 'Manage currency and basic financial settings', to: '/settings/financial', icon: Globe, module: 'settings' },
  { label: 'Accounting Preferences', description: 'Configure accounting rules and formats', to: '/settings/financial?section=accounting', icon: SlidersHorizontal, module: 'settings' },
  { label: 'Numbering & Codes', description: 'Manage document numbers and codes', to: '/settings/financial?section=numbering', icon: Hash, module: 'settings' },
  { label: 'Bank & Payment Settings', description: 'Manage bank accounts and payment options', to: '/settings/financial?section=payments', icon: CreditCard, module: 'settings' },
  { label: 'Fiscal Year & Periods', description: 'Configure financial year and periods', to: '/settings/financial?section=periods', icon: Calendar, module: 'settings' },
  { label: 'Interest & Charges', description: 'Manage interest rates and charges', to: '/settings/financial?section=interest', icon: Percent, module: 'settings' },
  { label: 'Financial Approval', description: 'Set approval limits and workflows', to: '/settings/financial?section=approval', icon: UserCheck, module: 'settings' },
  { label: 'Budget & Forecasting', description: 'Configure budget and forecasting options', to: '/settings/financial?section=budget', icon: BarChart3, module: 'settings' },
  { label: 'Financial Alerts', description: 'Set financial alert thresholds', to: '/settings/financial?section=alerts', icon: Bell, module: 'settings' },
]

const settingsItems: PanelItem[] = [
  { label: 'Company Profile', description: 'Manage cooperative profile details', to: '/settings/company-profile', icon: Building2, module: 'settings' },
  { label: 'Financial Settings', description: 'Currency, periods and document numbers', to: '/settings/financial', icon: Wallet, module: 'settings' },
  { label: 'Tax Settings', description: 'Tax rates and calculation rules', to: '/settings/tax', icon: Percent, module: 'settings' },
  { label: 'Notifications', description: 'Notification preferences and alerts', to: '/settings/notifications', icon: Bell, module: 'settings' },
  { label: 'Security', description: 'Password, login and 2FA settings', to: '/settings/security', icon: Shield, module: 'settings' },
  { label: 'Password Reset', description: 'Change or recover your account password', to: '/settings/password-reset', icon: LockKeyhole, module: 'settings' },
  { label: 'System Logs', description: 'View all system activity logs', to: '/settings/system-logs', icon: FileText, module: 'settings' },
  { label: 'Backup & Restore', description: 'Manage backups and restore points', to: '/settings/backup-restore', icon: Database, module: 'settings' },
  { label: 'Integrations', description: 'Connect external services', to: '/settings/integrations', icon: FolderOpen, module: 'settings' },
]

const adminItems: PanelItem[] = [
  { label: 'Admin Dashboard', description: 'Overview of users, roles and system health', to: '/admin/dashboard', icon: LayoutDashboard, module: 'settings' },
  { label: 'User Management', description: 'Manage system users and access', to: '/admin/users', icon: Users, module: 'user-management' },
  { label: 'Role & Permissions', description: 'Configure user access permissions', to: '/settings/roles-permissions', icon: Shield, module: 'roles-permissions' },
  { label: 'System Logs', description: 'View all system activity logs', to: '/settings/system-logs', icon: FileText, module: 'settings' },
  { label: 'Backup & Restore', description: 'Manage backups and restore points', to: '/settings/backup-restore', icon: Database, module: 'settings' },
  { label: 'Integrations', description: 'Connect external services', to: '/settings/integrations', icon: FolderOpen, module: 'settings' },
  { label: 'Company Profile', description: 'Manage cooperative profile details', to: '/settings/company-profile', icon: Building2, module: 'settings' },
]

const userItems: PanelItem[] = [
  { label: 'All Users', description: 'View and manage system users', to: '/admin/users', icon: Users, module: 'user-management' },
  { label: 'Add New User', description: 'Create a new user account', to: '/admin/register-user', icon: UserPlus, module: 'user-management' },
  { label: 'Role & Permissions', description: 'Manage access and permissions', to: '/settings/roles-permissions', icon: Shield, module: 'roles-permissions' },
  { label: 'System Logs', description: 'Review login and user activity', to: '/settings/system-logs', icon: FileText, module: 'settings' },
]

const staffItems: PanelItem[] = [
  { label: 'Staff Directory', description: 'View, filter and manage staff records', to: '/staff', icon: Users, module: 'staff' },
  { label: 'Add New Staff', description: 'Create a complete staff profile', to: '/staff/add', icon: UserPlus, module: 'staff' },
  { label: 'Import Staff', description: 'Bulk import staff through the directory', to: '/staff', icon: Upload, module: 'staff' },
  { label: 'Users with Access', description: 'Open system user accounts', to: '/admin/users', icon: UserCheck, module: 'user-management' },
]

const accountItems: PanelItem[] = [
  { label: 'Account Transactions', description: 'View and post transactions', to: '/accounts', icon: Receipt, module: 'accounts' },
  { label: 'Chart of Accounts', description: 'View account structure and export reports', to: '/chart-of-accounts', icon: PieChart, module: 'accounts' },
  { label: 'Trading Account', description: 'View gross profit or loss', to: '/trading', icon: BarChart3, module: 'trading' },
  { label: 'Trial Balance', description: 'Review ledger balances', to: '/trial-balance', icon: Scale, module: 'trial-balance' },
]

const auditItems: PanelItem[] = [
  { label: 'Audit Trail', description: 'Review user activities and changes', to: '/audit', icon: Shield, module: 'audit' },
  { label: 'System Logs', description: 'Monitor system events', to: '/settings/system-logs', icon: FileText, module: 'settings' },
  { label: 'Reports', description: 'Generate audit reports', to: '/reports', icon: BarChart3, module: 'reports' },
]

const reportsItems: PanelItem[] = [
  { label: 'All Reports', description: 'View generated reports', to: '/reports', icon: FileText, module: 'reports' },
  { label: 'Financial Reports', description: 'Financial position and performance', to: '/reports?category=financial', icon: BarChart3, module: 'reports' },
  { label: 'Accounting Reports', description: 'Ledger, cash book and summaries', to: '/reports?category=accounting', icon: Receipt, module: 'reports' },
  { label: 'Audit Reports', description: 'Compliance and activity reports', to: '/reports?category=audit', icon: Shield, module: 'reports' },
]

const defaultItems: PanelItem[] = [
  { label: 'Dashboard', description: 'Open system overview', to: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Staff Management', description: 'Manage staff records', to: '/staff', icon: Users, module: 'staff' },
  { label: 'User Management', description: 'Manage access accounts', to: '/admin/users', icon: UserCheck, module: 'user-management' },
  { label: 'Accounts', description: 'Transactions and balances', to: '/accounts', icon: Receipt, module: 'accounts' },
  { label: 'Reports', description: 'Generate and download reports', to: '/reports', icon: BarChart3, module: 'reports' },
  { label: 'Chat', description: 'Open messages and conversations', to: '/chat', icon: MessageSquare, module: 'chat' },
]

function getPanel(pathname: string): { title: string; items: PanelItem[] } {
  if (pathname.startsWith('/admin/users') || pathname.startsWith('/admin/register-user') || pathname.startsWith('/settings/roles-permissions')) return { title: 'User Management Menu', items: userItems }
  if (pathname.startsWith('/admin')) return { title: 'Admin Panel Menu', items: adminItems }
  if (pathname.startsWith('/settings')) return { title: 'Settings Menu', items: settingsItems }
  if (pathname.startsWith('/staff')) return { title: 'Staff Management Menu', items: staffItems }
  if (pathname.startsWith('/accounts') || pathname.startsWith('/chart-of-accounts') || pathname.startsWith('/trading') || pathname.startsWith('/trial-balance')) return { title: 'Accounts Menu', items: accountItems }
  if (pathname.startsWith('/audit') || pathname.startsWith('/settings/system-logs')) return { title: 'Audit & Logs Menu', items: auditItems }
  if (pathname.startsWith('/reports')) return { title: 'Reports Menu', items: reportsItems }
  return { title: 'Navigation Menu', items: defaultItems }
}

export default function SecondaryPanel() {
  const { pathname } = useLocation()
  const { secondaryPanelOpen, setSecondaryPanelOpen } = useUIStore()
  const { user } = useAuthStore()
  useRolePermissions()
  const panel = getPanel(pathname)
  const role = user?.role || 'staff'
  const visibleItems = panel.items.filter(item => !item.module || canAccessModule(role, item.module))

  return (
    <aside className={`hidden lg:block overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-300 ease-out ${secondaryPanelOpen ? 'w-[280px]' : 'w-0'}`}>
      <div className="h-full w-[280px] p-4">
        <div className="h-full rounded-lg border border-slate-200 bg-white p-3">
          <h2 className="mb-3 text-sm font-bold text-navy">{panel.title}</h2>
          <div className="space-y-1">
            {visibleItems.map(({ label, description, to, icon: Icon }) => (
              <NavLink
                key={`${label}-${to}`}
                to={to}
                onClick={() => setSecondaryPanelOpen(false)}
                className={({ isActive }) => `flex items-start gap-3 rounded-lg px-3 py-2 transition-colors ${isActive || pathname === to.split('?')[0] ? 'bg-blue-50 text-coop-blue' : 'text-slate-600 hover:bg-slate-50 hover:text-navy'}`}
              >
                <Icon size={15} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block text-xs font-bold">{label}</span>
                  <span className="block text-[10px] leading-4 text-slate-500">{description}</span>
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
