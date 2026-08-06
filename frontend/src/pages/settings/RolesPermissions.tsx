import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BarChart3, BriefcaseBusiness, Check, CheckCircle, ChevronDown, ChevronRight, Copy, Download, Edit, FileText, Info, KeyRound, MessageSquare, Plus, Save, Search, Settings, Shield, ShieldCheck, Trash2, User, UserCog, Users } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import Badge from '../../components/ui/Badge'
import { settingsApi, staffApi } from '../../services/api'
import { cacheRoleSettings } from '../../services/permissions'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types'

type PermissionLevel = 'full' | 'read' | 'custom' | 'none'
type RoleConfig = {
  id: string
  label: string
  description: string
  role?: UserRole
  system: boolean
  createdAt: string
  updatedAt: string
  permissions: Record<string, PermissionLevel>
  customActions: Record<string, string[]>
  dataAccess: 'all' | 'department' | 'own'
}
type RolesSettings = { roles: RoleConfig[] }

const stepItems: Array<{ n: 1 | 2 | 3 | 4; label: string; sub: string }> = [
  { n: 1, label: 'Role Information', sub: 'Set role name and description' },
  { n: 2, label: 'Permissions', sub: 'Configure module permissions' },
  { n: 3, label: 'Data Access', sub: 'Set data access level' },
  { n: 4, label: 'Review & Save', sub: 'Review and save role' },
]

const modules = [
  { id: 'dashboard', label: 'Dashboard', sub: 'View dashboard and analytics', icon: BarChart3, actions: ['View Dashboard', 'View Analytics', 'View Announcements', 'Export Widgets'] },
  { id: 'staff', label: 'Staff Management', sub: 'Manage staff records and information', icon: Users, actions: ['View Staff', 'Create Staff', 'Edit Staff', 'Change Staff Status', 'Export Staff'] },
  { id: 'management', label: 'Management', sub: 'Manage cooperative management activities', icon: BriefcaseBusiness, actions: ['View Activities', 'Create Announcement', 'Review Approvals', 'Manage Meetings'] },
  { id: 'accounts', label: 'Accounts', sub: 'Manage accounts and financial records', icon: FileText, actions: ['View Accounts', 'Create Accounts', 'Post Transactions', 'Approve Transactions', 'Edit Accounts', 'Delete Accounts', 'Export Data', 'Manage Budgets'] },
  { id: 'trading', label: 'Trading Account', sub: 'Manage trading accounts and transactions', icon: BarChart3, actions: ['View Trading', 'Post Sales', 'Post Purchases', 'Export Trading'] },
  { id: 'trial-balance', label: 'Trial Balance', sub: 'View and manage trial balance', icon: FileText, actions: ['View Trial Balance', 'Apply Filters', 'Print', 'Export Excel'] },
  { id: 'audit', label: 'Audit', sub: 'Conduct audits and review findings', icon: Shield, actions: ['View Audit Logs', 'Apply Filters', 'Export Audit', 'Manage Audit Settings'] },
  { id: 'reports', label: 'Reports', sub: 'Generate and export reports', icon: FileText, actions: ['View Reports', 'Generate Reports', 'Schedule Reports', 'Download Reports'] },
  { id: 'chat', label: 'Chat', sub: 'Internal communication and messaging', icon: MessageSquare, actions: ['View Chats', 'Send Messages', 'Create Rooms', 'Manage Chat Settings'] },
  { id: 'settings', label: 'Settings', sub: 'System settings and configurations', icon: Settings, actions: ['View Settings', 'Edit Profile', 'Security Settings', 'Company Profile'] },
  { id: 'user-management', label: 'User Management', sub: 'Create and manage system users', icon: UserCog, actions: ['View Users', 'Create Users', 'Edit Users', 'Lock Users', 'Import Users', 'Export Users'] },
  { id: 'roles-permissions', label: 'Roles & Permissions', sub: 'Manage role access levels', icon: KeyRound, actions: ['View Roles', 'Create Roles', 'Edit Permissions', 'Delete Roles'] },
]

const now = new Date().toISOString()
const full = () => Object.fromEntries(modules.map(module => [module.id, 'full'])) as Record<string, PermissionLevel>
const read = () => Object.fromEntries(modules.map(module => [module.id, 'read'])) as Record<string, PermissionLevel>
const none = () => Object.fromEntries(modules.map(module => [module.id, 'none'])) as Record<string, PermissionLevel>
const actions = (permissionIds: string[] = []) => Object.fromEntries(modules.map(module => [module.id, permissionIds.includes(module.id) ? module.actions : []])) as Record<string, string[]>

const defaultRoles: RoleConfig[] = [
  { id: 'super_admin', role: 'super_admin', label: 'Super Admin', description: 'Full access to all modules and system configurations.', system: true, createdAt: now, updatedAt: now, permissions: full(), customActions: actions(modules.map(m => m.id)), dataAccess: 'all' },
  { id: 'admin', role: 'admin', label: 'Admin', description: 'Administrative access to manage users, operations and system settings except protected super admin accounts.', system: true, createdAt: now, updatedAt: now, permissions: full(), customActions: actions(modules.map(m => m.id)), dataAccess: 'all' },
  { id: 'accountant', role: 'accountant', label: 'Accountant', description: 'Access to accounting and financial modules with limited management capabilities.', system: true, createdAt: now, updatedAt: now, permissions: { ...read(), accounts: 'custom', trading: 'full', 'trial-balance': 'full', reports: 'full', 'user-management': 'none', 'roles-permissions': 'none' }, customActions: actions(['accounts']), dataAccess: 'department' },
  { id: 'manager', role: 'manager', label: 'Manager', description: 'Can manage staff, approvals, announcements and management reports.', system: true, createdAt: now, updatedAt: now, permissions: { ...read(), staff: 'full', management: 'full', reports: 'full', 'user-management': 'none', 'roles-permissions': 'none' }, customActions: actions(), dataAccess: 'department' },
  { id: 'auditor', role: 'auditor', label: 'Auditor', description: 'Can review audit logs, balances and compliance reports.', system: true, createdAt: now, updatedAt: now, permissions: { ...read(), audit: 'full', accounts: 'read', 'trial-balance': 'read', 'user-management': 'none', 'roles-permissions': 'none' }, customActions: actions(), dataAccess: 'all' },
  { id: 'cashier', role: 'cashier', label: 'Cashier', description: 'Can post cash transactions and view assigned account activity.', system: true, createdAt: now, updatedAt: now, permissions: { ...none(), dashboard: 'read', accounts: 'full', trading: 'full', chat: 'full' }, customActions: actions(), dataAccess: 'own' },
  { id: 'loan_officer', role: 'loan_officer', label: 'Officer', description: 'Can view assigned operational records and submit activity updates.', system: true, createdAt: now, updatedAt: now, permissions: { ...none(), dashboard: 'read', staff: 'read', management: 'read', accounts: 'read', reports: 'read', chat: 'full' }, customActions: actions(), dataAccess: 'own' },
  { id: 'staff', role: 'staff', label: 'Staff', description: 'Standard staff access with limited permissions based on department.', system: true, createdAt: now, updatedAt: now, permissions: { ...none(), dashboard: 'read', accounts: 'read', reports: 'read', chat: 'full' }, customActions: actions(), dataAccess: 'own' },
]

function normalizeRoleConfig(role: Partial<RoleConfig>): RoleConfig {
  const fallback = defaultRoles.find(item => item.id === role.id) || defaultRoles[0]
  return {
    ...fallback,
    ...role,
    description: role.description || fallback.description,
    permissions: { ...fallback.permissions, ...(role.permissions || {}) },
    customActions: { ...fallback.customActions, ...(role.customActions || {}) },
    dataAccess: role.dataAccess || fallback.dataAccess,
  }
}

function mergeSavedRoles(savedRoles: Partial<RoleConfig>[]): RoleConfig[] {
  const savedById = new Map(savedRoles.filter(role => role.id).map(role => [role.id, role]))
  const mergedDefaults = defaultRoles.map(role => normalizeRoleConfig({ ...role, ...(savedById.get(role.id) || {}) }))
  const customRoles = savedRoles
    .filter(role => role.id && !defaultRoles.some(defaultRole => defaultRole.id === role.id))
    .map(normalizeRoleConfig)
  return [...mergedDefaults, ...customRoles]
}

export default function RolesPermissions() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(2)
  const [roles, setRoles] = useState<RoleConfig[]>(defaultRoles)
  const [selectedRoleId, setSelectedRoleId] = useState('accountant')
  const [search, setSearch] = useState('')
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<string[]>(['accounts'])
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const canViewSuperAdmin = currentUser?.role === 'super_admin'
  const visibleRoles = useMemo(() => canViewSuperAdmin ? roles : roles.filter(role => role.id !== 'super_admin' && role.role !== 'super_admin'), [canViewSuperAdmin, roles])
  const selectedRole = visibleRoles.find(role => role.id === selectedRoleId) || visibleRoles[0] || roles[0]

  useEffect(() => { loadPage() }, [])
  useEffect(() => {
    if (visibleRoles.length && !visibleRoles.some(role => role.id === selectedRoleId)) {
      setSelectedRoleId(visibleRoles[0].id)
    }
  }, [selectedRoleId, visibleRoles])

  const loadPage = async () => {
    try {
      const [saved, staffResult] = await Promise.all([
        settingsApi.get<RolesSettings>('roles-permissions'),
        staffApi.list({ limit: 1000 }),
      ])
      if (saved.roles?.length) {
        const merged = mergeSavedRoles(saved.roles)
        setRoles(merged)
        cacheRoleSettings({ roles: merged })
      } else {
        cacheRoleSettings({ roles })
      }
      const counts: Record<string, number> = {}
      staffResult.data.forEach(staff => { counts[staff.role] = (counts[staff.role] || 0) + 1 })
      setStaffCounts(counts)
    } catch {
      toast.error('Could not load roles and permissions')
    }
  }

  const saveRoles = async (nextRoles = roles, message = 'Roles and permissions saved') => {
    try {
      setSaving(true)
      const saved = await settingsApi.save<RolesSettings>('roles-permissions', { roles: nextRoles })
      const normalized = (saved.roles || nextRoles).map(normalizeRoleConfig)
      setRoles(normalized)
      cacheRoleSettings({ roles: normalized })
      toast.success(message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save roles')
    } finally {
      setSaving(false)
    }
  }

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase()
    return visibleRoles.filter(role => !term || role.label.toLowerCase().includes(term) || role.description.toLowerCase().includes(term))
  }, [visibleRoles, search])

  const selectedCounts = useMemo(() => {
    return modules.reduce((total, module) => {
      const level = selectedRole.permissions[module.id] || 'none'
      total[level] += 1
      return total
    }, { full: 0, read: 0, custom: 0, none: 0 })
  }, [selectedRole])

  const permissionData = [
    { name: 'Full Access', value: selectedCounts.full, color: '#16A34A' },
    { name: 'Custom Access', value: selectedCounts.custom, color: '#14B8A6' },
    { name: 'View Only', value: selectedCounts.read, color: '#2563EB' },
    { name: 'No Access', value: selectedCounts.none, color: '#EF4444' },
  ]

  const totalRoles = visibleRoles.length
  const systemRoles = visibleRoles.filter(role => role.system).length
  const customRoles = visibleRoles.filter(role => !role.system).length
  const totalPermissions = visibleRoles.reduce((sum, role) => sum + Object.keys(role.permissions).length, 0)
  const coverage = totalPermissions ? Math.round(visibleRoles.reduce((sum, role) => sum + Object.values(role.permissions).filter(level => level !== 'none').length, 0) / totalPermissions * 1000) / 10 : 0

  const userCountForRole = (role: RoleConfig) => role.role ? staffCounts[role.role] || 0 : 0

  const moduleActions = (moduleId: string) => modules.find(module => module.id === moduleId)?.actions || []
  const readOnlyActions = (moduleId: string) => moduleActions(moduleId).filter(action => /view|read|open|apply filters|print|download|export/i.test(action))
  const currentActionsForLevel = (moduleId: string, role = selectedRole) => {
    const level = role.permissions[moduleId] || 'none'
    if (level === 'full') return moduleActions(moduleId)
    if (level === 'read') return readOnlyActions(moduleId)
    if (level === 'custom') return role.customActions[moduleId] || []
    return []
  }

  const updatePermission = (moduleId: string, level: PermissionLevel) => {
    const existingCustomActions = selectedRole.customActions[moduleId] || []
    const defaultCustomActions = existingCustomActions.length ? existingCustomActions : readOnlyActions(moduleId)
    if (level === 'custom') {
      setExpanded(prev => prev.includes(moduleId) ? prev : [...prev, moduleId])
    }
    const nextRoles: RoleConfig[] = roles.map(role => role.id === selectedRole.id ? {
      ...role,
      updatedAt: new Date().toISOString(),
      permissions: { ...role.permissions, [moduleId]: level },
      customActions: level === 'custom' ? { ...role.customActions, [moduleId]: defaultCustomActions } : role.customActions,
    } : role)
    setRoles(nextRoles)
  }

  const updateCustomAction = (moduleId: string, action: string, checked: boolean) => {
    const selected = currentActionsForLevel(moduleId)
    const nextActions = checked ? Array.from(new Set([...selected, action])) : selected.filter(item => item !== action)
    const nextRoles: RoleConfig[] = roles.map(role => role.id === selectedRole.id ? {
      ...role,
      updatedAt: new Date().toISOString(),
      permissions: { ...role.permissions, [moduleId]: 'custom' as PermissionLevel },
      customActions: { ...role.customActions, [moduleId]: nextActions },
    } : role)
    setRoles(nextRoles)
  }

  const isActionSelected = (moduleId: string, action: string) => currentActionsForLevel(moduleId).includes(action)

  const expandAllModules = () => {
    setExpanded(modules.map(module => module.id))
    toast.success('All permission modules expanded')
  }

  const collapseAllModules = () => {
    setExpanded([])
    toast.success('All permission modules collapsed')
  }

  const setAllSelected = (level: PermissionLevel) => {
    const nextRoles: RoleConfig[] = roles.map(role => role.id === selectedRole.id ? {
      ...role,
      updatedAt: new Date().toISOString(),
      permissions: Object.fromEntries(modules.map(module => [module.id, level])) as Record<string, PermissionLevel>,
    } : role)
    setRoles(nextRoles)
    toast.success(`All permissions set to ${level === 'full' ? 'full access' : level === 'read' ? 'view only' : level}`)
  }

  const setDataAccess = (dataAccess: RoleConfig['dataAccess']) => {
    setRoles(roles.map(role => role.id === selectedRole.id ? { ...role, dataAccess, updatedAt: new Date().toISOString() } : role))
  }

  const saveDraft = () => {
    localStorage.setItem('roles-permissions-draft', JSON.stringify({ roles }))
    toast.success('Draft saved on this browser')
  }

  const openAddRole = () => {
    setEditingRoleId(null)
    setFormName('')
    setFormDescription('')
    setShowRoleForm(true)
  }

  const saveRoleForm = () => {
    if (!formName.trim()) {
      toast.error('Enter role name')
      return
    }
    if (editingRoleId) {
      const nextRoles = roles.map(role => role.id === editingRoleId ? { ...role, label: formName.trim(), description: formDescription.trim() || role.description, updatedAt: new Date().toISOString() } : role)
      setRoles(nextRoles)
      setShowRoleForm(false)
      setEditingRoleId(null)
      saveRoles(nextRoles, 'Role updated')
      return
    }
    const id = formName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `role_${Date.now()}`
    if (roles.some(role => role.id === id)) {
      toast.error('Role already exists')
      return
    }
    const role: RoleConfig = { id, label: formName.trim(), description: formDescription.trim() || 'Custom role for selected users.', system: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), permissions: read(), customActions: actions(), dataAccess: 'department' }
    const nextRoles = [...roles, role]
    setRoles(nextRoles)
    setSelectedRoleId(id)
    setShowRoleForm(false)
    saveRoles(nextRoles, 'Role created')
  }

  const renameRole = () => {
    if (selectedRole.system) {
      toast.error('System role names are protected')
      return
    }
    setEditingRoleId(selectedRole.id)
    setFormName(selectedRole.label)
    setFormDescription(selectedRole.description)
    setShowRoleForm(true)
  }

  const duplicateRole = () => {
    const id = `${selectedRole.id}_copy_${Date.now()}`
    const copied: RoleConfig = { ...selectedRole, id, role: undefined, label: `${selectedRole.label} Copy`, system: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    const nextRoles = [...roles, copied]
    setRoles(nextRoles)
    setSelectedRoleId(id)
    saveRoles(nextRoles, 'Role duplicated')
  }

  const deleteRole = () => {
    if (selectedRole.system) {
      toast.error('System roles cannot be deleted')
      return
    }
    if (userCountForRole(selectedRole) > 0) {
      toast.error('Move users to another role before deleting this role')
      return
    }
    const nextRoles = roles.filter(role => role.id !== selectedRole.id)
    setRoles(nextRoles)
    setSelectedRoleId(nextRoles[0]?.id || '')
    saveRoles(nextRoles, 'Role deleted')
  }

  const exportRoles = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ roles }, null, 2)], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `roles-permissions-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const viewRoleUsers = () => {
    if (!selectedRole.role) {
      toast('Custom role has no assigned system role yet')
      return
    }
    navigate(`/admin/users?role=${encodeURIComponent(selectedRole.role)}`)
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId])
  }

  const content = step === 1 ? (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <Header title="Role Information" sub="Review the selected role name, description and status." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <label className="block">
          <span className="block text-xs font-bold text-navy mb-1.5">Role Name</span>
          <input value={selectedRole.label} readOnly className="input-field bg-slate-50" />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-navy mb-1.5">Role Type</span>
          <input value={selectedRole.system ? 'System Role' : 'Custom Role'} readOnly className="input-field bg-slate-50" />
        </label>
        <label className="block md:col-span-2">
          <span className="block text-xs font-bold text-navy mb-1.5">Description</span>
          <textarea value={selectedRole.description} readOnly className="input-field bg-slate-50 min-h-24" />
        </label>
      </div>
      <button onClick={renameRole} className="btn-secondary mt-5"><Edit size={14} /> Edit Role Information</button>
    </section>
  ) : step === 3 ? (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <Header title="Data Access" sub="Choose which records users with this role can access." />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        {[
          ['all', 'All Data', 'Can access organization-wide records.'],
          ['department', 'Department Data', 'Can access records for their department.'],
          ['own', 'Own Records', 'Can access only records assigned to them.'],
        ].map(([value, label, sub]) => (
          <button key={value} onClick={() => setDataAccess(value as RoleConfig['dataAccess'])} className={`text-left rounded-xl border p-4 ${selectedRole.dataAccess === value ? 'border-coop-blue bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <div className="font-bold text-navy">{label}</div>
            <p className="text-sm text-slate-500 mt-2">{sub}</p>
          </button>
        ))}
      </div>
    </section>
  ) : step === 4 ? (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <Header title="Review & Save" sub="Review the selected role and save the permissions." />
      <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        <MiniStat label="Full Access" value={selectedCounts.full} />
        <MiniStat label="Custom Access" value={selectedCounts.custom} />
        <MiniStat label="View Only" value={selectedCounts.read} />
        <MiniStat label="No Access" value={selectedCounts.none} />
      </div>
      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <div className="font-bold text-navy">{selectedRole.label}</div>
        <p className="text-sm text-slate-500 mt-1">{selectedRole.description}</p>
        <p className="text-sm text-slate-500 mt-3">Data access: <span className="font-bold capitalize text-navy">{selectedRole.dataAccess}</span></p>
      </div>
    </section>
  ) : (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 border-b border-slate-100">
        <Header title="Configure Permissions" sub="Select the modules and actions that users with this role will be allowed to access." />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button onClick={expandAllModules} className="text-coop-blue font-semibold">Expand All</button>
          <span className="text-slate-300">|</span>
          <button onClick={collapseAllModules} className="text-coop-blue font-semibold">Collapse All</button>
          <button onClick={() => setAllSelected('full')} className="btn-secondary !py-2"><Check size={14} /> Select All</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-bold text-navy">Module / Feature</th>
              {[
                ['full', 'Full Access', 'All actions'],
                ['read', 'View Only', 'Read only access'],
                ['custom', 'Custom Access', 'Select specific actions'],
                ['none', 'No Access', 'No permissions'],
              ].map(([level, label, sub]) => (
                <th key={level} className="px-4 py-3 text-center">
                  <span className="block text-xs font-bold text-navy">{label}</span>
                  <span className="block text-[11px] font-normal text-slate-500">{sub}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map(module => {
              const Icon = module.icon
              const level = selectedRole.permissions[module.id] || 'none'
              const isOpen = expanded.includes(module.id)
              return (
                <tr key={module.id} className="border-t border-slate-100 align-top">
                  <td className="px-5 py-3">
                    <button onClick={() => toggleExpanded(module.id)} className="flex items-center gap-3 text-left">
                      {isOpen ? <ChevronDown size={15} className="text-navy" /> : <ChevronRight size={15} className="text-navy" />}
                      <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Icon size={15} className="text-coop-blue" /></span>
                      <span><span className="block text-sm font-bold text-navy">{module.label}</span><span className="block text-xs text-slate-500">{module.sub}</span></span>
                    </button>
                    {isOpen && (
                      <div className="ml-11 mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <span className="text-xs font-bold text-navy">Page buttons and actions</span>
                          <span className="text-[11px] text-slate-500">Tick or untick any action to use Custom Access.</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {module.actions.map(action => {
                            const checked = isActionSelected(module.id, action)
                            return (
                              <button
                                key={action}
                                type="button"
                                onClick={() => updateCustomAction(module.id, action, !checked)}
                                className={`flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                                  checked ? 'border-coop-blue bg-blue-50 text-coop-blue' : 'border-slate-200 bg-white text-navy hover:border-blue-200 hover:bg-blue-50'
                                }`}
                              >
                                <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-coop-blue bg-coop-blue' : 'border-slate-300 bg-white'}`}>
                                  {checked && <Check size={11} className="text-white" />}
                                </span>
                                {action}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                  {(['full', 'read', 'custom', 'none'] as PermissionLevel[]).map(option => (
                    <td key={option} className="px-3 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => updatePermission(module.id, option)}
                        className={`inline-flex min-h-10 w-full max-w-[150px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                          level === option
                            ? option === 'none'
                              ? 'border-red-200 bg-red-50 text-red-700 shadow-sm'
                              : option === 'custom'
                                ? 'border-teal-200 bg-teal-50 text-teal-700 shadow-sm'
                                : 'border-coop-blue bg-blue-50 text-coop-blue shadow-sm'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-coop-blue'
                        }`}
                        aria-pressed={level === option}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                          level === option ? 'border-current bg-current' : 'border-slate-300 bg-white'
                        }`}>
                          {level === option && <Check size={11} className="text-white" />}
                        </span>
                        {option === 'full' ? 'Full' : option === 'read' ? 'View' : option === 'custom' ? 'Custom' : 'None'}
                      </button>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Roles & Permissions</h2>
          <p className="text-sm text-navy/70 mt-1">User Management &gt; Role & Permissions &gt; Edit Role</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportRoles} className="btn-secondary"><Download size={14} /> Permission Settings</button>
          <button onClick={openAddRole} className="btn-primary bg-coop-blue"><Plus size={15} /> Add New Role</button>
        </div>
      </div>

      <section className="bg-white border-b border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stepItems.map(({ n, label, sub }) => (
            <button key={n} onClick={() => setStep(n)} className={`flex items-center gap-3 text-left border-b-2 pb-4 ${step === n ? 'border-coop-blue' : 'border-transparent'}`}>
              <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${step > n ? 'bg-green-50 border-green-500 text-green-700' : step === n ? 'bg-coop-blue border-coop-blue text-white' : 'bg-white border-slate-300 text-navy'}`}>{step > n ? <Check size={15} /> : n}</span>
              <span><span className="block text-sm font-bold text-navy">{label}</span><span className="block text-xs text-slate-500">{sub}</span></span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Metric icon={<ShieldCheck size={22} className="text-blue-700" />} label="Total Roles" value={totalRoles} sub="All defined user roles" tone="bg-blue-100" />
        <Metric icon={<Users size={22} className="text-green-700" />} label="System Roles" value={systemRoles} sub="Default system roles" tone="bg-green-100" />
        <Metric icon={<UserCog size={22} className="text-orange-700" />} label="Custom Roles" value={customRoles} sub="Custom created roles" tone="bg-orange-100" />
        <Metric icon={<KeyRound size={22} className="text-purple-700" />} label="Total Permissions" value={totalPermissions} sub="System permissions" tone="bg-purple-100" />
        <Metric icon={<Shield size={22} className="text-teal-700" />} label="Permission Coverage" value={`${coverage}%`} sub="Overall coverage" tone="bg-teal-100" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_330px] gap-5">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-navy mb-4">Roles List</h3>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} className="input-field pl-9" placeholder="Search roles..." />
          </div>
          <div className="space-y-2">
            {filteredRoles.map(role => (
              <button key={role.id} onClick={() => setSelectedRoleId(role.id)} className={`w-full flex items-center gap-3 rounded-lg p-3 text-left border ${selectedRoleId === role.id ? 'bg-blue-50 border-blue-100' : 'border-transparent hover:bg-slate-50'}`}>
                <span className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">{roleIcon(role)}</span>
                <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-navy truncate">{role.label}</span><span className="block text-xs text-slate-500">{userCountForRole(role)} user{userCountForRole(role) === 1 ? '' : 's'}</span></span>
              </button>
            ))}
          </div>
          <button onClick={openAddRole} className="w-full mt-4 border border-slate-200 rounded-lg p-3 text-sm font-semibold text-coop-blue hover:bg-slate-50"><Plus size={15} className="inline mr-2" /> Add New Role</button>
        </section>

        <div className="space-y-5">
          {content}
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <Header title="Custom Permission Settings" sub="Define specific actions for modules with custom access." />
            <div className="mt-4 space-y-3">
              {modules.filter(module => selectedRole.permissions[module.id] === 'custom').map(module => (
                <div key={module.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-navy">{module.label} Module</div>
                    <span className="text-xs text-slate-500">Selected Actions ({(selectedRole.customActions[module.id] || []).length} of {module.actions.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                    {module.actions.map(action => {
                      const checked = (selectedRole.customActions[module.id] || []).includes(action)
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => updateCustomAction(module.id, action, !checked)}
                          className={`flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                            checked ? 'border-coop-blue bg-blue-50 text-coop-blue' : 'border-slate-200 bg-white text-navy hover:border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-coop-blue bg-coop-blue' : 'border-slate-300 bg-white'}`}>
                            {checked && <Check size={11} className="text-white" />}
                          </span>
                          {action}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {!modules.some(module => selectedRole.permissions[module.id] === 'custom') && <p className="text-sm text-slate-500">No custom permissions selected for this role.</p>}
            </div>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => step === 1 ? navigate('/admin/users') : setStep(value => Math.max(1, value - 1) as 1 | 2 | 3 | 4)} className="btn-secondary">Back</button>
            <div className="flex gap-3">
              <button onClick={saveDraft} className="btn-secondary"><Save size={14} /> Save as Draft</button>
              {step < 4 ? <button onClick={() => setStep(value => Math.min(4, value + 1) as 1 | 2 | 3 | 4)} className="btn-primary bg-coop-blue">Next: {step === 2 ? 'Data Access' : 'Review & Save'} <ChevronRight size={14} /></button> : <button onClick={() => saveRoles()} disabled={saving} className="btn-primary bg-coop-blue disabled:opacity-60"><Save size={14} /> Save Role</button>}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-navy mb-4">Role Summary</h3>
            <div className="flex items-start gap-3">
              <span className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">{roleIcon(selectedRole)}</span>
              <div>
                <div className="font-bold text-navy flex items-center gap-2">{selectedRole.label} <Badge label={selectedRole.system ? 'Active' : 'Custom'} variant="green" /></div>
                <p className="text-xs text-slate-500 mt-2">{selectedRole.description}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <Detail icon={<Users size={15} />} label="Users with this role" value={`${userCountForRole(selectedRole)}`} />
              <Detail icon={<BriefcaseBusiness size={15} />} label="Created On" value={new Date(selectedRole.createdAt).toLocaleString()} />
              <Detail icon={<Info size={15} />} label="Last Updated" value={new Date(selectedRole.updatedAt).toLocaleString()} />
              <Detail icon={<User size={15} />} label="Created By" value={currentUser?.fullName || 'System'} />
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-navy mb-4">Permission Overview</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={permissionData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {permissionData.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-sm">
              {permissionData.map(item => <div key={item.name} className="flex justify-between"><span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full" style={{ background: item.color }} />{item.name}</span><span className="font-bold text-navy">{item.value}</span></div>)}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-navy mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button onClick={duplicateRole} className="quick-action"><Copy size={15} className="text-green-700" /><span><b>Duplicate Role</b><small>Create a copy of this role</small></span></button>
              <button onClick={viewRoleUsers} className="quick-action"><Users size={15} className="text-green-700" /><span><b>Role Users</b><small>View users with this role</small></span></button>
              <button onClick={renameRole} className="quick-action"><Edit size={15} className="text-coop-blue" /><span><b>Edit Role</b><small>Update role name and description</small></span></button>
              <button onClick={deleteRole} className="quick-action text-red-600"><Trash2 size={15} /><span><b className="!text-red-600">Delete Role</b><small>Permanently delete this role</small></span></button>
            </div>
          </section>

          <section className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <h3 className="font-bold text-navy mb-3">Permission Tips</h3>
            <Tip>Use custom access to grant specific permissions without giving full access.</Tip>
            <Tip>View only access allows users to see data but cannot make changes.</Tip>
            <Tip>Changes apply to all users assigned to this role after saving.</Tip>
          </section>
        </aside>
      </div>

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.
      </footer>

      {showRoleForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-navy">{editingRoleId ? 'Edit Role' : 'Add New Role'}</h3>
            <p className="text-sm text-slate-500 mt-1">{editingRoleId ? 'Update role name and description.' : 'Create a custom role with view-only permissions by default.'}</p>
            <label className="block text-sm font-medium text-slate-700 mt-5 mb-1">Role Name</label>
            <input value={formName} onChange={event => setFormName(event.target.value)} className="input-field" placeholder="Role name" autoFocus />
            <label className="block text-sm font-medium text-slate-700 mt-4 mb-1">Description</label>
            <textarea value={formDescription} onChange={event => setFormDescription(event.target.value)} className="input-field min-h-24" placeholder="Role description" />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowRoleForm(false)} className="flex-1 btn-secondary justify-center">Cancel</button>
              <button onClick={saveRoleForm} className="flex-1 btn-primary bg-navy justify-center">Save Role</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function roleIcon(role: RoleConfig) {
  if (role.id === 'super_admin') return <ShieldCheck size={18} className="text-blue-700" />
  if (role.id === 'admin') return <UserCog size={18} className="text-green-700" />
  if (role.id.includes('account')) return <Shield size={18} className="text-purple-700" />
  if (role.id.includes('manager')) return <Users size={18} className="text-green-700" />
  if (role.id.includes('auditor')) return <BarChart3 size={18} className="text-orange-700" />
  if (role.id.includes('cashier')) return <FileText size={18} className="text-blue-700" />
  return <Shield size={18} className="text-slate-600" />
}

function Header({ title, sub }: { title: string; sub?: string }) {
  return <div><h3 className="font-bold text-navy">{title}</h3>{sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}</div>
}

function Metric({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: number | string; sub: string; tone: string }) {
  return <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5"><div className="flex items-center gap-4"><span className={`w-12 h-12 rounded-full flex items-center justify-center ${tone}`}>{icon}</span><span><span className="block text-2xl font-bold text-navy">{value}</span><span className="block text-sm font-semibold text-navy">{label}</span><span className="block text-xs text-slate-500 mt-1">{sub}</span></span></div></div>
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 p-4 text-center"><div className="text-2xl font-bold text-navy">{value}</div><div className="text-xs text-slate-500 mt-1">{label}</div></div>
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-slate-600">{icon}{label}</span><span className="font-medium text-navy text-right">{value}</span></div>
}

function Tip({ children }: { children: ReactNode }) {
  return <div className="flex gap-2 text-sm text-navy/80 mb-2 last:mb-0"><CheckCircle size={15} className="text-coop-blue mt-0.5" /><span>{children}</span></div>
}
