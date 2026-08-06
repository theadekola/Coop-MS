import type { UserRole } from '../types'

export type PermissionLevel = 'full' | 'read' | 'custom' | 'none'
export type DataAccessLevel = 'all' | 'department' | 'own'
export type PermissionModuleId =
  | 'dashboard'
  | 'staff'
  | 'management'
  | 'accounts'
  | 'trading'
  | 'trial-balance'
  | 'audit'
  | 'reports'
  | 'chat'
  | 'settings'
  | 'user-management'
  | 'roles-permissions'

export type RoleConfig = {
  id: string
  label: string
  description: string
  role?: UserRole
  system: boolean
  createdAt: string
  updatedAt: string
  permissions: Record<string, PermissionLevel>
  customActions: Record<string, string[]>
  dataAccess: DataAccessLevel
}

export type RolesSettings = { roles: RoleConfig[] }

export const roleSettingsUpdatedEvent = 'roles-permissions-updated'
const roleSettingsCacheKey = 'roles-permissions-cache'
const now = new Date().toISOString()

export const permissionModules: Array<{ id: PermissionModuleId; actions: string[] }> = [
  { id: 'dashboard', actions: ['View Dashboard', 'View Analytics', 'View Announcements', 'Export Widgets'] },
  { id: 'staff', actions: ['View Staff', 'Create Staff', 'Edit Staff', 'Change Staff Status', 'Export Staff'] },
  { id: 'management', actions: ['View Activities', 'Create Announcement', 'Review Approvals', 'Manage Meetings'] },
  { id: 'accounts', actions: ['View Accounts', 'Create Accounts', 'Post Transactions', 'Approve Transactions', 'Edit Accounts', 'Delete Accounts', 'Export Data', 'Manage Budgets'] },
  { id: 'trading', actions: ['View Trading', 'Post Sales', 'Post Purchases', 'Export Trading'] },
  { id: 'trial-balance', actions: ['View Trial Balance', 'Apply Filters', 'Print', 'Export Excel'] },
  { id: 'audit', actions: ['View Audit Logs', 'Apply Filters', 'Export Audit', 'Manage Audit Settings'] },
  { id: 'reports', actions: ['View Reports', 'Generate Reports', 'Schedule Reports', 'Download Reports'] },
  { id: 'chat', actions: ['View Chats', 'Send Messages', 'Create Rooms', 'Manage Chat Settings'] },
  { id: 'settings', actions: ['View Settings', 'Edit Settings', 'Security Settings', 'Company Profile'] },
  { id: 'user-management', actions: ['View Users', 'Create Users', 'Edit Users', 'Reset Passwords', 'Import Users', 'Export Users'] },
  { id: 'roles-permissions', actions: ['View Roles', 'Create Roles', 'Edit Permissions', 'Delete Roles'] },
]

const full = () => Object.fromEntries(permissionModules.map(module => [module.id, 'full'])) as Record<string, PermissionLevel>
const read = () => Object.fromEntries(permissionModules.map(module => [module.id, 'read'])) as Record<string, PermissionLevel>
const none = () => Object.fromEntries(permissionModules.map(module => [module.id, 'none'])) as Record<string, PermissionLevel>
const actions = (permissionIds: string[] = []) => Object.fromEntries(permissionModules.map(module => [module.id, permissionIds.includes(module.id) ? module.actions : []])) as Record<string, string[]>

export const defaultRoleConfigs: RoleConfig[] = [
  { id: 'super_admin', role: 'super_admin', label: 'Super Admin', description: 'Full access to all modules and system configurations.', system: true, createdAt: now, updatedAt: now, permissions: full(), customActions: actions(permissionModules.map(module => module.id)), dataAccess: 'all' },
  { id: 'admin', role: 'admin', label: 'Admin', description: 'Administrative access to manage users, operations and system settings except protected super admin accounts.', system: true, createdAt: now, updatedAt: now, permissions: full(), customActions: actions(permissionModules.map(module => module.id)), dataAccess: 'all' },
  { id: 'accountant', role: 'accountant', label: 'Accountant', description: 'Access to accounting and financial modules with limited management capabilities.', system: true, createdAt: now, updatedAt: now, permissions: { ...read(), accounts: 'custom', trading: 'full', 'trial-balance': 'full', reports: 'full', 'user-management': 'none', 'roles-permissions': 'none' }, customActions: actions(['accounts']), dataAccess: 'department' },
  { id: 'manager', role: 'manager', label: 'Manager', description: 'Can manage staff, approvals, announcements and management reports.', system: true, createdAt: now, updatedAt: now, permissions: { ...read(), staff: 'full', management: 'full', reports: 'full', 'user-management': 'none', 'roles-permissions': 'none' }, customActions: actions(), dataAccess: 'department' },
  { id: 'auditor', role: 'auditor', label: 'Auditor', description: 'Can review audit logs, balances and compliance reports.', system: true, createdAt: now, updatedAt: now, permissions: { ...read(), audit: 'full', accounts: 'read', 'trial-balance': 'read', 'user-management': 'none', 'roles-permissions': 'none' }, customActions: actions(), dataAccess: 'all' },
  { id: 'cashier', role: 'cashier', label: 'Cashier', description: 'Can post cash transactions and view assigned account activity.', system: true, createdAt: now, updatedAt: now, permissions: { ...none(), dashboard: 'read', accounts: 'full', trading: 'full', chat: 'full' }, customActions: actions(), dataAccess: 'own' },
  { id: 'loan_officer', role: 'loan_officer', label: 'Officer', description: 'Can view assigned operational records and submit activity updates.', system: true, createdAt: now, updatedAt: now, permissions: { ...none(), dashboard: 'read', staff: 'read', management: 'read', accounts: 'read', reports: 'read', chat: 'full' }, customActions: actions(), dataAccess: 'own' },
  { id: 'staff', role: 'staff', label: 'Staff', description: 'Standard staff access with limited permissions based on department.', system: true, createdAt: now, updatedAt: now, permissions: { ...none(), dashboard: 'read', accounts: 'read', reports: 'read', chat: 'full' }, customActions: actions(), dataAccess: 'own' },
]

export function normalizeRoleConfig(role: Partial<RoleConfig>): RoleConfig {
  const fallback = defaultRoleConfigs.find(item => item.id === role.id || item.role === role.role) || defaultRoleConfigs[defaultRoleConfigs.length - 1]
  return {
    ...fallback,
    ...role,
    id: role.id || fallback.id,
    label: role.label || fallback.label,
    description: role.description || fallback.description,
    permissions: { ...fallback.permissions, ...(role.permissions || {}) },
    customActions: { ...fallback.customActions, ...(role.customActions || {}) },
    dataAccess: role.dataAccess || fallback.dataAccess,
  }
}

export function mergeSavedRoles(savedRoles: Partial<RoleConfig>[] = []): RoleConfig[] {
  const savedById = new Map(savedRoles.filter(role => role.id).map(role => [role.id, role]))
  const mergedDefaults = defaultRoleConfigs.map(role => normalizeRoleConfig({ ...role, ...(savedById.get(role.id) || {}) }))
  const customRoles = savedRoles
    .filter(role => role.id && !defaultRoleConfigs.some(defaultRole => defaultRole.id === role.id))
    .map(normalizeRoleConfig)
  return [...mergedDefaults, ...customRoles]
}

export function getCachedRoleSettings(): RolesSettings {
  try {
    const raw = localStorage.getItem(roleSettingsCacheKey)
    if (!raw) return { roles: defaultRoleConfigs }
    const parsed = JSON.parse(raw) as Partial<RolesSettings>
    return { roles: mergeSavedRoles(parsed.roles || []) }
  } catch {
    localStorage.removeItem(roleSettingsCacheKey)
    return { roles: defaultRoleConfigs }
  }
}

export function cacheRoleSettings(settings: RolesSettings): RolesSettings {
  const normalized = { roles: mergeSavedRoles(settings.roles || []) }
  localStorage.setItem(roleSettingsCacheKey, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(roleSettingsUpdatedEvent, { detail: normalized }))
  return normalized
}

export function getRoleConfig(role?: UserRole | null): RoleConfig {
  const settings = getCachedRoleSettings()
  return settings.roles.find(item => item.role === role || item.id === role) || normalizeRoleConfig({ role: role || 'staff' })
}

export function getPermissionLevel(role: UserRole | undefined | null, moduleId: PermissionModuleId): PermissionLevel {
  return getRoleConfig(role).permissions[moduleId] || 'none'
}

export function canAccessModule(role: UserRole | undefined | null, moduleId: PermissionModuleId): boolean {
  return getPermissionLevel(role, moduleId) !== 'none'
}

export function canAccessAnyModule(role: UserRole | undefined | null, moduleIds: PermissionModuleId[]): boolean {
  return moduleIds.some(moduleId => canAccessModule(role, moduleId))
}

export function canUseModuleAction(role: UserRole | undefined | null, moduleId: PermissionModuleId, action: string): boolean {
  const config = getRoleConfig(role)
  const level = config.permissions[moduleId] || 'none'
  if (level === 'full') return true
  if (level === 'none' || level === 'read') return false
  return (config.customActions[moduleId] || []).includes(action)
}
