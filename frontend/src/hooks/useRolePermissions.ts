import { useMemo } from 'react'
import { useAuthStore } from '../store/authStore'

export type PermissionLevel = 'full' | 'read' | 'custom' | 'none'

const STORAGE_KEYS = [
  'oshodi_role_permissions_v1',
  'oshodi_role_permissions',
  'rolePermissions',
  'rolesPermissions',
]

const normalizeRole = (role?: string) =>
  String(role || 'staff').toLowerCase().replace(/\s+/g, '_')

const normalizeModule = (moduleName: string) =>
  moduleName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

const defaultRolePermissions = (role: string): Record<string, PermissionLevel> => {
  if (role === 'super_admin' || role === 'admin') {
    return {
      dashboard: 'full',
      staff_management: 'full',
      management: 'full',
      accounts: 'full',
      trading_account: 'full',
      trial_balance: 'full',
      audit: 'full',
      reports: 'full',
      chat: 'full',
      settings: 'full',
      user_management: 'full',
      roles_permissions: 'full',
      admin_dashboard: 'full',
      system_logs: 'full',
      backup_restore: 'full',
      integrations: 'full',
      company_profile: 'full',
    }
  }

  return {
    dashboard: 'read',
    accounts: role === 'accountant' || role === 'cashier' ? 'custom' : 'none',
    trading_account: role === 'accountant' ? 'read' : 'none',
    trial_balance: role === 'accountant' || role === 'auditor' ? 'read' : 'none',
    audit: role === 'auditor' ? 'read' : 'none',
    reports: role === 'accountant' || role === 'auditor' || role === 'manager' ? 'read' : 'none',
    chat: 'full',
    staff_management: role === 'manager' ? 'custom' : 'none',
    management: role === 'manager' ? 'custom' : 'none',
    settings: 'none',
    user_management: 'none',
    roles_permissions: 'none',
  }
}

const loadSavedPermissions = (role: string) => {
  for (const key of STORAGE_KEYS) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null')
      const rolePermissions = parsed?.[role]?.permissions || parsed?.[role]
      if (rolePermissions && typeof rolePermissions === 'object') {
        return rolePermissions as Record<string, PermissionLevel>
      }
    } catch {
      continue
    }
  }
  return null
}

export const useRolePermissions = () => {
  const user = useAuthStore(state => state.user)

  return useMemo(() => {
    const roleKey = normalizeRole((user as any)?.role)
    const isSuperAdmin = roleKey === 'super_admin'
    const isAdmin = roleKey === 'admin'
    const permissions = {
      ...defaultRolePermissions(roleKey),

    }

    const getModuleLevel = (moduleName: string): PermissionLevel => {
      if (isSuperAdmin) return 'full'
      return permissions[normalizeModule(moduleName)] || 'none'
    }

    const canAccess = (moduleName: string) => getModuleLevel(moduleName) !== 'none'
    const canRead = canAccess
    const canWrite = (moduleName: string) => {
      const level = getModuleLevel(moduleName)
      return level === 'full' || level === 'custom'
    }
    const canPerform = (moduleName: string, _action?: string) => canWrite(moduleName)

    return {
      roleKey,
      isSuperAdmin,
      isAdmin,
      permissions,
      getModuleLevel,
      canAccess,
      canRead,
      canWrite,
      canPerform,
      hasPermission: canAccess,
      canUseAction: canPerform,
    }
  }, [user])
}
