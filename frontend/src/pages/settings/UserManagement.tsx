import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Download, Eye, Filter, Grid2X2, KeyRound, LineChart as LineChartIcon, List, Lock, Mail, MoreVertical, Plus, RefreshCw, Search, ShieldCheck, Upload, UserCheck, UserCog, Users } from 'lucide-react'
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Badge, { roleBadge, statusBadge } from '../../components/ui/Badge'
import { auditApi, staffApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import type { Staff, StaffStatus, UserRole } from '../../types'

const roles: Array<{ value: UserRole; label: string }> = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'loan_officer', label: 'Officer' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
]
const protectedRoles: UserRole[] = ['super_admin', 'admin']
const roleOrder: Record<UserRole, number> = {
  super_admin: 0,
  admin: 1,
  accountant: 2,
  manager: 3,
  loan_officer: 4,
  cashier: 5,
  auditor: 6,
  staff: 7,
}

const departments = ['All Departments', 'Accounts', 'Audit', 'Cash Desk', 'HR', 'IT', 'Loans', 'Management', 'Operations', 'Trading', 'General']

function Metric({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: number; sub: string; tone: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-4">
        <span className={`w-14 h-14 rounded-xl flex items-center justify-center ${tone}`}>{icon}</span>
        <span>
          <span className="block text-sm font-bold text-navy">{label}</span>
          <span className="block text-2xl font-bold text-navy mt-1">{value}</span>
          <span className="block text-xs text-slate-500 mt-1">{sub}</span>
        </span>
      </div>
    </div>
  )
}

function roleLabel(role: UserRole) {
  return roles.find(item => item.value === role)?.label || role.replace(/_/g, ' ')
}

function sortByRolePriority(rows: Staff[]) {
  return [...rows].sort((a, b) => {
    const roleRank = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99)
    if (roleRank !== 0) return roleRank
    return a.fullName.localeCompare(b.fullName)
  })
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === ',' && !quoted) { values.push(current.trim()); current = ''; continue }
    current += char
  }
  values.push(current.trim())
  return values
}

export default function UserManagement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleFromUrl = searchParams.get('role')
  const { user: currentUser } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [users, setUsers] = useState<Staff[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All Roles')
  const [departmentFilter, setDepartmentFilter] = useState('All Departments')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectedUser, setSelectedUser] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(false)
  const [loginTrend, setLoginTrend] = useState<Array<{ day: string; count: number }>>([])
  const canViewSuperAdmin = currentUser?.role === 'super_admin'
  const visibleRoles = useMemo(() => canViewSuperAdmin ? roles : roles.filter(role => role.value !== 'super_admin'), [canViewSuperAdmin])
  const visibleUsers = useMemo(() => {
    const rows = canViewSuperAdmin ? users : users.filter(row => row.role !== 'super_admin')
    return sortByRolePriority(rows)
  }, [canViewSuperAdmin, users])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const [staffResult, logResult] = await Promise.all([
        staffApi.list({ limit: 1000 }),
        auditApi.logs({ action: 'LOGIN', limit: 1000 }).catch(() => ({ data: [], stats: {} })),
      ])
      setUsers(sortByRolePriority(staffResult.data))
      setTotal(staffResult.total)
      const buckets = new Map<string, { day: string; count: number }>()
      for (let index = 6; index >= 0; index -= 1) {
        const date = new Date()
        date.setDate(date.getDate() - index)
        buckets.set(date.toISOString().slice(0, 10), { day: date.toLocaleDateString([], { day: '2-digit', month: 'short' }), count: 0 })
      }
      logResult.data.forEach(log => {
        const key = log.dateTime?.slice(0, 10)
        const bucket = buckets.get(key)
        if (bucket) bucket.count += 1
      })
      setLoginTrend(Array.from(buckets.values()))
      setSelectedIds([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])
  useEffect(() => {
    if (roleFromUrl && roles.some(role => role.value === roleFromUrl)) {
      setRoleFilter(roleFromUrl)
      setPage(1)
    }
  }, [roleFromUrl])
  useEffect(() => {
    if (!canViewSuperAdmin && roleFilter === 'super_admin') {
      setRoleFilter('All Roles')
    }
  }, [canViewSuperAdmin, roleFilter])

  const filteredUsers = useMemo(() => visibleUsers.filter(row => {
    const term = search.trim().toLowerCase()
    const matchesSearch = !term || [row.fullName, row.email, row.employeeId, row.phone].some(value => String(value || '').toLowerCase().includes(term))
    const matchesRole = roleFilter === 'All Roles' || row.role === roleFilter
    const matchesDepartment = departmentFilter === 'All Departments' || row.department === departmentFilter
    const matchesStatus = statusFilter === 'All Status' || row.status === statusFilter
    return matchesSearch && matchesRole && matchesDepartment && matchesStatus
  }), [visibleUsers, search, roleFilter, departmentFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)
  const activeCount = visibleUsers.filter(row => row.status === 'active').length
  const lockedCount = visibleUsers.filter(row => row.status === 'suspended').length
  const inactiveCount = visibleUsers.filter(row => row.status === 'inactive').length
  const pendingCount = visibleUsers.filter(row => row.status === 'on_leave').length
  const statusData = [
    { name: 'Active', value: activeCount, color: '#22C55E' },
    { name: 'Inactive', value: inactiveCount, color: '#A5B4FC' },
    { name: 'Locked', value: lockedCount, color: '#EF4444' },
    { name: 'Pending', value: pendingCount, color: '#F59E0B' },
  ].filter(item => item.value > 0)

  const resetFilters = () => {
    setSearch('')
    setRoleFilter('All Roles')
    setDepartmentFilter('All Departments')
    setStatusFilter('All Status')
    setPage(1)
  }

  const canEditUser = (target: Staff) => {
    if (currentUser?.role === 'super_admin') return true
    if (currentUser?.role === 'admin') return target.role !== 'super_admin'
    return !protectedRoles.includes(target.role)
  }
  const canResetPassword = (target: Staff) => canEditUser(target)

  const openEditUser = (row: Staff) => {
    if (!canEditUser(row)) {
      toast.error('You can view this account, but you cannot edit Admin or Super Admin roles')
      return
    }
    navigate('/admin/register-user', { state: { editUser: row } })
  }

  const exportUsers = (rows = filteredUsers, filename = 'users.csv') => {
    const headers = ['Full Name', 'Username', 'Email', 'Role', 'Department', 'Status', 'Last Login', 'Phone']
    const body = rows.map(row => [row.fullName, row.employeeId, row.email, roleLabel(row.role), row.department, row.status, row.lastLogin || '', row.phone])
    const csv = [headers, ...body].map(row => row.map(csvEscape).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const importUsers = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) throw new Error('CSV must include a header and at least one user')
      const headers = parseCsvLine(lines[0]).map(header => header.toLowerCase())
      const indexOf = (name: string) => headers.findIndex(header => header.includes(name))
      let created = 0
      for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line)
        const fullName = cells[indexOf('name')] || ''
        const email = cells[indexOf('email')] || ''
        if (!fullName || !email) continue
        await staffApi.create({
          fullName,
          email,
          phone: cells[indexOf('phone')] || '',
          role: ((cells[indexOf('role')] || 'staff').toLowerCase().replace(/\s+/g, '_') as UserRole),
          department: cells[indexOf('department')] || 'General',
          password: cells[indexOf('password')] || 'Password@123',
        })
        created += 1
      }
      toast.success(`${created} user(s) imported`)
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to import users')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const changeStatus = async (row: Staff, status: StaffStatus) => {
    if (!canEditUser(row)) {
      toast.error('You can view this account, but you cannot change Admin or Super Admin status')
      return
    }
    try {
      await staffApi.update(row.id, { status })
      toast.success('User status updated')
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update user')
    }
  }

  const runBulkAction = async (action: string) => {
    if (!action) return
    const selected = visibleUsers.filter(row => selectedIds.includes(row.id))
    if (!selected.length) {
      toast.error('Select at least one user')
      return
    }
    if (action === 'export') {
      exportUsers(selected, 'selected-users.csv')
      return
    }
    const blocked = selected.filter(row => !canEditUser(row))
    if (blocked.length) {
      toast.error('Remove Admin or Super Admin accounts from the selection before changing status')
      return
    }
    const status: StaffStatus = action === 'activate' ? 'active' : action === 'deactivate' ? 'inactive' : 'suspended'
    try {
      await Promise.all(selected.map(row => staffApi.update(row.id, { status })))
      toast.success('Bulk action completed')
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk action failed')
    }
  }

  const toggleSelected = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  const toggleAllPage = () => {
    const pageIds = pagedUsers.map(row => row.id)
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))
    setSelectedIds(prev => allSelected ? prev.filter(id => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds])))
  }

  const sendResetMail = async (row: Staff) => {
    if (!canResetPassword(row)) {
      toast.error('You can view this account, but you cannot reset Admin or Super Admin passwords')
      return
    }
    try {
      const result = await staffApi.resetPassword(row.id)
      const temporaryPassword = result.temporaryPassword || ''
      if (temporaryPassword) {
        try {
          await navigator.clipboard?.writeText(temporaryPassword)
        } catch {
          // Clipboard can be blocked by browser permissions; still show the temporary password.
        }
      }
      toast.success(temporaryPassword ? `Temporary password copied: ${temporaryPassword}` : 'Password reset completed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to reset password')
    }
  }

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div>
        <h2 className="text-xl font-bold text-navy">User Management</h2>
        <p className="text-sm text-navy/70 mt-1">Dashboard &gt; User Management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Metric icon={<Users size={24} className="text-purple-700" />} label="Total Users" value={visibleUsers.length || (canViewSuperAdmin ? total : visibleUsers.length)} sub="System user accounts" tone="bg-purple-100" />
        <Metric icon={<UserCheck size={24} className="text-green-700" />} label="Active Users" value={activeCount} sub="Currently active" tone="bg-green-100" />
        <Metric icon={<Lock size={24} className="text-orange-700" />} label="Locked Users" value={lockedCount} sub="Locked accounts" tone="bg-orange-100" />
        <Metric icon={<UserCog size={24} className="text-slate-700" />} label="Inactive Users" value={inactiveCount} sub="Inactive accounts" tone="bg-slate-100" />
        <Metric icon={<Mail size={24} className="text-purple-700" />} label="Pending Activation" value={pendingCount} sub="Awaiting activation" tone="bg-purple-100" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h3 className="font-bold text-navy">User Directory</h3>
              <p className="text-sm text-slate-500 mt-1">Manage system user accounts, access and security.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/admin/register-user')} className="btn-primary bg-coop-blue"><Plus size={15} /> Add New User</button>
              <select onChange={event => runBulkAction(event.target.value)} className="input-field w-40">
                <option value="">Bulk Actions</option>
                <option value="activate">Activate</option>
                <option value="deactivate">Deactivate</option>
                <option value="lock">Lock</option>
                <option value="export">Export</option>
              </select>
              <button onClick={() => exportUsers()} className="btn-secondary"><Download size={14} /> Export</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(140px,1fr))] gap-3 mb-5">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} className="input-field pl-9" placeholder="Search by name, username or email..." />
            </div>
            <select value={roleFilter} onChange={event => { setRoleFilter(event.target.value); setPage(1) }} className="input-field"><option>All Roles</option>{visibleRoles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
            <select value={departmentFilter} onChange={event => { setDepartmentFilter(event.target.value); setPage(1) }} className="input-field">{departments.map(item => <option key={item}>{item}</option>)}</select>
            <select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1) }} className="input-field"><option>All Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Locked</option><option value="on_leave">Pending</option></select>
            <button onClick={resetFilters} className="btn-secondary justify-center"><RefreshCw size={14} /> Reset</button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full">
              <thead><tr><th className="text-left px-4 py-3 bg-slate-50"><input type="checkbox" checked={pagedUsers.length > 0 && pagedUsers.every(row => selectedIds.includes(row.id))} onChange={toggleAllPage} /></th>{['User', 'Username', 'Role', 'Department', 'Last Login', 'Status', '2FA', 'Actions'].map(header => <th key={header} className="text-left text-xs font-bold text-navy px-4 py-3 bg-slate-50 whitespace-nowrap">{header}</th>)}</tr></thead>
              <tbody>
                {pagedUsers.map(row => {
                  return (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold">{row.fullName.split(' ').map(part => part[0]).join('').slice(0, 2)}</span>
                        <span><span className="block text-sm font-bold text-navy">{row.fullName}</span><span className="block text-xs text-slate-500">{row.email}</span></span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-navy">{row.employeeId || '-'}</td>
                    <td className="px-4 py-3">{roleBadge(row.role)}</td>
                    <td className="px-4 py-3 text-sm text-navy">{row.department || '-'}</td>
                    <td className="px-4 py-3 text-sm text-navy whitespace-nowrap">{row.lastLogin ? new Date(row.lastLogin).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3">{statusBadge(row.status)}</td>
                    <td className="px-4 py-3"><Badge label={row.twoFactorEnabled ? 'Enabled' : 'Disabled'} variant={row.twoFactorEnabled ? 'green' : 'gray'} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setSelectedUser(row)} title="View user" className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"><Eye size={13} /></button>
                        <button
                          onClick={() => openEditUser(row)}
                          disabled={!canEditUser(row)}
                          title={canEditUser(row) ? 'Edit user' : 'View only for this role'}
                          className={`p-1.5 rounded-lg border border-slate-200 ${canEditUser(row) ? 'hover:bg-slate-50 text-navy' : 'opacity-40 cursor-not-allowed text-slate-400'}`}
                        >
                          <MoreVertical size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
            {!loading && pagedUsers.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No users found.</div>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <span className="text-sm text-navy">Showing {filteredUsers.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length} users</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={14} /></button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => <button key={i + 1} onClick={() => setPage(i + 1)} className={`w-9 h-9 rounded-lg border text-sm font-bold ${page === i + 1 ? 'bg-coop-blue text-white border-coop-blue' : 'border-slate-200 text-navy'}`}>{i + 1}</button>)}
              <button onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={14} /></button>
              <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} className="input-field w-28">{[10, 25, 50].map(size => <option key={size} value={size}>{size} / page</option>)}</select>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">User Status Overview</h3>
            <div className="h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" innerRadius={54} outerRadius={78}>{statusData.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            <div className="space-y-2 mt-3">{statusData.map(item => <div key={item.name} className="flex justify-between text-sm"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: item.color }} />{item.name}</span><span className="font-bold text-navy">{item.value}</span></div>)}</div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">Login Activity (Last 7 Days)</h3>
            <div className="h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={loginTrend}><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={() => navigate('/admin/register-user')} className="quick-action"><Plus size={16} className="text-purple-700" /> <span><b>Add New User</b><small>Create a new system user</small></span></button>
              <button onClick={() => fileInputRef.current?.click()} className="quick-action"><Upload size={16} className="text-purple-700" /> <span><b>Bulk Import Users</b><small>Import multiple users from CSV</small></span></button>
              <button onClick={() => selectedUser ? sendResetMail(selectedUser) : toast.error('Open a user first')} className="quick-action"><KeyRound size={16} className="text-green-700" /> <span><b>Reset User Password</b><small>Send password reset email</small></span></button>
              <button onClick={() => navigate('/admin/roles')} className="quick-action"><ShieldCheck size={16} className="text-blue-700" /> <span><b>User Roles</b><small>Manage roles and permissions</small></span></button>
              <button onClick={() => navigate('/settings/system-logs')} className="quick-action"><LineChartIcon size={16} className="text-purple-700" /> <span><b>Login History</b><small>View user login activity</small></span></button>
            </div>
          </section>

          <section className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <h3 className="font-bold text-navy mb-3">Tips</h3>
            <div className="space-y-2 text-sm text-navy/80">
              <p>Use roles and permissions to control what users can access.</p>
              <p>Enable 2FA for all users to improve security.</p>
            </div>
          </section>
        </aside>
      </div>

      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={event => event.target.files?.[0] && importUsers(event.target.files[0])} />
      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">&copy; {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.</footer>

      {selectedUser && <UserModal user={selectedUser} canEditLock={canEditUser(selectedUser)} canReset={canResetPassword(selectedUser)} onClose={() => setSelectedUser(null)} onEdit={() => openEditUser(selectedUser)} onLock={() => { setSelectedUser(null); changeStatus(selectedUser, 'suspended') }} onReset={() => sendResetMail(selectedUser)} />}
    </div>
  )
}

function UserModal({ user, canEditLock, canReset, onClose, onEdit, onLock, onReset }: { user: Staff; canEditLock: boolean; canReset: boolean; onClose: () => void; onEdit: () => void; onLock: () => void; onReset: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-navy">{user.fullName}</h3>
        <p className="text-sm text-slate-500">{user.email}</p>
        <div className="grid grid-cols-2 gap-3 text-sm mt-5">
          <div><div className="text-xs text-slate-400">Username</div><div className="font-medium">{user.employeeId || '-'}</div></div>
          <div><div className="text-xs text-slate-400">Phone</div><div className="font-medium">{user.phone}</div></div>
          <div><div className="text-xs text-slate-400">Role</div><div className="font-medium">{roleLabel(user.role)}</div></div>
          <div><div className="text-xs text-slate-400">Department</div><div className="font-medium">{user.department || '-'}</div></div>
          <div><div className="text-xs text-slate-400">Status</div><div className="font-medium">{statusBadge(user.status)}</div></div>
          <div><div className="text-xs text-slate-400">2FA</div><div className="font-medium">{user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button onClick={onEdit} disabled={!canEditLock} className="btn-primary bg-navy justify-center disabled:opacity-40 disabled:cursor-not-allowed">Edit</button>
          <button onClick={onReset} disabled={!canReset} className="btn-secondary justify-center disabled:opacity-40 disabled:cursor-not-allowed">Reset Password</button>
          <button onClick={onLock} disabled={!canEditLock} className="btn-secondary text-red-600 justify-center disabled:opacity-40 disabled:cursor-not-allowed">Lock</button>
          <button onClick={onClose} className="btn-secondary justify-center">Close</button>
        </div>
        {!canEditLock && <p className="mt-3 text-center text-xs text-slate-500">You can view this account, but you cannot edit Admin or Super Admin roles.</p>}
      </div>
    </div>
  )
}
