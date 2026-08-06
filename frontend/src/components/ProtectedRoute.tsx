import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types'
import { useRolePermissions } from '../hooks/useRolePermissions'
import { canAccessModule, type PermissionModuleId } from '../services/permissions'

const fallbackRoutes: Array<{ module: PermissionModuleId; path: string }> = [
  { module: 'dashboard', path: '/dashboard' },
  { module: 'staff', path: '/staff' },
  { module: 'management', path: '/management' },
  { module: 'accounts', path: '/accounts' },
  { module: 'trading', path: '/trading' },
  { module: 'trial-balance', path: '/trial-balance' },
  { module: 'audit', path: '/audit' },
  { module: 'reports', path: '/reports' },
  { module: 'chat', path: '/chat' },
  { module: 'settings', path: '/settings/company-profile' },
  { module: 'user-management', path: '/admin/users' },
  { module: 'roles-permissions', path: '/admin/roles' }
]

export default function ProtectedRoute({ children, roles, module }: { children: React.ReactNode; roles?: UserRole[]; module?: PermissionModuleId }) {
  const { isAuthenticated, token, user } = useAuthStore()
  useRolePermissions()

  if (!isAuthenticated || !token || !user) return <Navigate to="/login" replace />
  const fallbackPath = fallbackRoutes.find(route => route.module !== module && canAccessModule(user.role, route.module))?.path || '/profile'
  if (module && !canAccessModule(user.role, module)) return <Navigate to={fallbackPath} replace />
  if (roles?.length && !roles.includes(user.role)) return <Navigate to={fallbackPath} replace />
  return <>{children}</>
}
