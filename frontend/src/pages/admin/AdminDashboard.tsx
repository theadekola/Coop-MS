import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowRight, Bell, Calendar, CheckCircle2, Database, FileText, Lock, Plus, Settings, Shield, ShieldCheck, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { auditApi, managementApi, settingsApi, staffApi } from '../../services/api'
import type { AuditLog, PendingApproval, Staff, UserRole } from '../../types'
import packageJson from '../../../package.json'

type RoleSetting = { permissions?: Record<string, string> }
type RolesSettings = { roles?: RoleSetting[] }
type AdminNotes = { notes: Array<{ id: number; text: string; createdAt: string }> }
type SystemPrefs = { organizationName?: string; companyName?: string; cooperativeName?: string }

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  accountant: 'Accountant',
  auditor: 'Auditor',
  cashier: 'Cashier',
  loan_officer: 'Officer',
  manager: 'Manager',
  staff: 'Staff',
}

const defaultNotes: AdminNotes = { notes: [] }
const quickLinkClass = 'w-full flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-navy hover:bg-slate-50'

function StatCard({ icon, label, value, sub, action, tone }: { icon: ReactNode; label: string; value: string | number; sub: string; action?: { label: string; onClick: () => void }; tone: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm min-h-[120px] flex flex-col justify-between">
      <div className="p-5 flex items-center gap-4">
        <span className={`w-12 h-12 rounded-full flex items-center justify-center ${tone}`}>{icon}</span>
        <span>
          <span className="block text-sm font-semibold text-navy">{label}</span>
          <span className="block text-2xl font-bold text-navy mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</span>
          <span className="block text-xs text-slate-500 mt-1">{sub}</span>
        </span>
      </div>
      {action && <button onClick={action.onClick} className="border-t border-slate-100 px-5 py-3 text-xs font-bold text-coop-blue text-left hover:bg-slate-50">{action.label} <ArrowRight size={12} className="inline" /></button>}
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <span className="flex items-center gap-3 text-sm font-semibold text-navy">{icon}{label}</span>
      <span className="text-sm text-navy text-right">{value}</span>
    </div>
  )
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function isWarning(log: AuditLog) {
  const text = `${log.action} ${log.module} ${log.description}`.toLowerCase()
  return text.includes('failed') || text.includes('error') || text.includes('critical') || text.includes('delete') || text.includes('warning')
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<Staff[]>([])
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [rolesSettings, setRolesSettings] = useState<RolesSettings>({})
  const [systemPrefs, setSystemPrefs] = useState<SystemPrefs>({})
  const [notes, setNotes] = useState<AdminNotes>(defaultNotes)
  const [period, setPeriod] = useState('month')
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState(false)

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [staffResult, approvalsResult, logsResult, savedRoles, savedSystem, savedNotes] = await Promise.all([
        staffApi.list({ limit: 1000 }),
        managementApi.approvals('pending'),
        auditApi.logs({ limit: 1000 }),
        settingsApi.get<RolesSettings>('roles-permissions').catch(() => ({})),
        settingsApi.get<SystemPrefs>('system').catch(() => ({})),
        settingsApi.get<AdminNotes>('admin-notes').catch(() => defaultNotes),
      ])
      setUsers(staffResult.data)
      setApprovals(approvalsResult as unknown as PendingApproval[])
      setLogs(logsResult.data)
      setRolesSettings(savedRoles)
      setSystemPrefs(savedSystem)
      setNotes({ ...defaultNotes, ...savedNotes, notes: savedNotes.notes || [] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  const activeUsers = users.filter(user => user.status === 'active')
  const inactiveUsers = users.filter(user => user.status !== 'active')
  const uniqueRoles = Array.from(new Set(users.map(user => user.role)))
  const permissionCount = rolesSettings.roles?.reduce((sum, role) => sum + Object.keys(role.permissions || {}).length, 0) || 0
  const alertLogs = logs.filter(isWarning)
  const healthPercent = logs.length ? Math.max(0, Math.round(((logs.length - alertLogs.length) / logs.length) * 100)) : 100

  const roleSummary = useMemo(() => uniqueRoles.map(role => {
    const roleUsers = users.filter(user => user.role === role)
    return {
      role,
      label: roleLabels[role],
      total: roleUsers.length,
      active: roleUsers.filter(user => user.status === 'active').length,
      inactive: roleUsers.filter(user => user.status !== 'active').length,
    }
  }).sort((a, b) => b.total - a.total), [users])

  const chartData = useMemo(() => {
    const buckets = new Map<string, { name: string; users: number; logins: number }>()
    const days = period === 'week' ? 7 : period === 'year' ? 12 : 30
    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date()
      if (period === 'year') {
        date.setMonth(date.getMonth() - index)
        const key = `${date.getFullYear()}-${date.getMonth()}`
        buckets.set(key, { name: date.toLocaleString([], { month: 'short' }), users: 0, logins: 0 })
      } else {
        date.setDate(date.getDate() - index)
        const key = date.toISOString().slice(0, 10)
        buckets.set(key, { name: date.toLocaleDateString([], { day: '2-digit', month: 'short' }), users: 0, logins: 0 })
      }
    }
    users.forEach(user => {
      if (!user.joinedDate) return
      const date = new Date(user.joinedDate)
      if (Number.isNaN(date.getTime())) return
      const key = period === 'year' ? `${date.getFullYear()}-${date.getMonth()}` : date.toISOString().slice(0, 10)
      const bucket = buckets.get(key)
      if (bucket) bucket.users += 1
    })
    logs.filter(log => log.action === 'LOGIN').forEach(log => {
      const date = new Date(log.dateTime)
      if (Number.isNaN(date.getTime())) return
      const key = period === 'year' ? `${date.getFullYear()}-${date.getMonth()}` : date.toISOString().slice(0, 10)
      const bucket = buckets.get(key)
      if (bucket) bucket.logins += 1
    })
    return Array.from(buckets.values())
  }, [logs, period, users])

  const exportUserSummary = () => {
    const headers = ['User Role', 'Total Users', 'Active Users', 'Inactive Users']
    const rows = roleSummary.map(row => [row.label, row.total, row.active, row.inactive])
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `admin-user-summary-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const saveNote = async () => {
    const text = noteText.trim()
    if (!text) {
      toast.error('Enter a note first')
      return
    }
    try {
      const next = { notes: [{ id: Date.now(), text, createdAt: new Date().toISOString() }, ...notes.notes] }
      const saved = await settingsApi.save<AdminNotes>('admin-notes', next)
      setNotes(saved)
      setNoteText('')
      setShowNote(false)
      toast.success('Administrator note saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save note')
    }
  }

  const systemName = systemPrefs.organizationName || systemPrefs.companyName || systemPrefs.cooperativeName || 'Oshodi Isolo Excel Cooperative'

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Admin Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Overview of system, users and key activities.</p>
        </div>
        <button onClick={loadDashboard} disabled={loading} className="btn-secondary disabled:opacity-60">{loading ? 'Refreshing...' : 'Refresh Dashboard'}</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard icon={<Users size={22} className="text-blue-700" />} label="Total Users" value={users.length} sub="All system users" tone="bg-blue-100" action={{ label: 'View all users', onClick: () => navigate('/admin/users') }} />
        <StatCard icon={<Users size={22} className="text-green-700" />} label="Active Users" value={activeUsers.length} sub={`${users.length ? Math.round((activeUsers.length / users.length) * 100) : 0}% of total users`} tone="bg-green-100" action={{ label: 'Manage users', onClick: () => navigate('/admin/users') }} />
        <StatCard icon={<Shield size={22} className="text-purple-700" />} label="System Roles" value={uniqueRoles.length} sub="Roles currently assigned" tone="bg-purple-100" action={{ label: 'View roles', onClick: () => navigate('/admin/roles') }} />
        <StatCard icon={<Lock size={22} className="text-orange-700" />} label="Permissions" value={permissionCount} sub="Configured permissions" tone="bg-orange-100" action={{ label: 'View permissions', onClick: () => navigate('/admin/roles') }} />
        <StatCard icon={<ShieldCheck size={22} className="text-green-700" />} label="System Health" value={`${healthPercent}%`} sub={alertLogs.length ? `${alertLogs.length} alert(s) found` : 'All systems operational'} tone="bg-green-100" action={{ label: 'View logs', onClick: () => navigate('/settings/system-logs') }} />
        <StatCard icon={<FileText size={22} className="text-orange-700" />} label="Pending Approvals" value={approvals.length} sub="Requires attention" tone="bg-orange-100" action={{ label: 'View approvals', onClick: () => navigate('/management') }} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-5">
        <div className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-bold text-navy">System Overview</h3>
              <select value={period} onChange={event => setPeriod(event.target.value)} className="input-field w-44">
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-xl p-4">
                <h4 className="text-sm font-bold text-navy">User Registration</h4>
                <div className="text-2xl font-bold text-navy mt-2">{chartData.reduce((sum, row) => sum + row.users, 0).toLocaleString()}</div>
                <p className="text-xs text-slate-500">New users</p>
                <div className="h-44 mt-3">
                  <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="users" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
                </div>
              </div>
              <div className="border border-slate-100 rounded-xl p-4">
                <h4 className="text-sm font-bold text-navy">Login Activity</h4>
                <div className="text-2xl font-bold text-navy mt-2">{logs.filter(log => log.action === 'LOGIN').length.toLocaleString()}</div>
                <p className="text-xs text-slate-500">Total logins loaded</p>
                <div className="h-44 mt-3">
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="logins" fill="#16A34A" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-bold text-navy">User Management Summary</h3>
              <div className="flex gap-2">
                <button onClick={() => navigate('/admin/users')} className="btn-secondary">View All Users</button>
                <button onClick={exportUserSummary} disabled={!roleSummary.length} className="btn-secondary disabled:opacity-50">Export</button>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full">
                <thead><tr>{['User Role', 'Total Users', 'Active Users', 'Inactive Users', 'Actions'].map(header => <th key={header} className="text-left text-xs font-bold text-navy px-4 py-3 bg-slate-50">{header}</th>)}</tr></thead>
                <tbody>
                  {roleSummary.map(row => (
                    <tr key={row.role} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm font-semibold text-navy">{row.label}</td>
                      <td className="px-4 py-3 text-sm text-navy">{row.total}</td>
                      <td className="px-4 py-3 text-sm text-green-700">{row.active}</td>
                      <td className="px-4 py-3 text-sm text-red-600">{row.inactive}</td>
                      <td className="px-4 py-3"><button onClick={() => navigate('/admin/users')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-coop-blue hover:bg-slate-50">View</button></td>
                    </tr>
                  ))}
                </tbody>
                {roleSummary.length > 0 && <tfoot><tr className="border-t border-slate-200 font-bold"><td className="px-4 py-3">Total</td><td className="px-4 py-3">{users.length}</td><td className="px-4 py-3 text-green-700">{activeUsers.length}</td><td className="px-4 py-3 text-red-600">{inactiveUsers.length}</td><td /></tr></tfoot>}
              </table>
              {!roleSummary.length && <div className="py-10 text-center text-sm text-slate-400">No users found.</div>}
            </div>
          </section>

          <section className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <Bell size={20} className="text-coop-blue mt-0.5" />
                <div>
                  <h3 className="font-bold text-navy">Administrator Notes</h3>
                  <p className="text-sm text-navy/80 mt-1">Use this section to save notes for other administrators.</p>
                </div>
              </div>
              <button onClick={() => setShowNote(true)} className="btn-secondary"><Plus size={14} /> Add New Note</button>
            </div>
            {notes.notes.length > 0 && <div className="mt-4 grid gap-2">{notes.notes.slice(0, 3).map(note => <div key={note.id} className="bg-white border border-blue-100 rounded-lg p-3 text-sm text-navy"><div>{note.text}</div><div className="text-xs text-slate-400 mt-1">{formatDate(note.createdAt)}</div></div>)}</div>}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-3">System Information</h3>
            <InfoRow icon={<FileText size={15} className="text-coop-blue" />} label="System Name" value={systemName} />
            <InfoRow icon={<Shield size={15} className="text-coop-blue" />} label="Version" value={`v${packageJson.version}`} />
            <InfoRow icon={<Database size={15} className="text-coop-blue" />} label="Database" value="MSSQL" />
            <InfoRow icon={<Calendar size={15} className="text-coop-blue" />} label="Server Time" value={new Date().toLocaleString()} />
            <InfoRow icon={<CheckCircle2 size={15} className="text-green-700" />} label="Health Status" value={alertLogs.length ? 'Needs review' : 'Operational'} />
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy">Recent Activities</h3>
              <button onClick={() => navigate('/settings/system-logs')} className="text-xs font-bold text-coop-blue">View All <ArrowRight size={12} className="inline" /></button>
            </div>
            <div className="space-y-3">
              {logs.slice(0, 6).map(log => (
                <button key={log.id} onClick={() => navigate('/settings/system-logs')} className="w-full text-left flex gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <span className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center"><FileText size={15} className="text-coop-blue" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-navy truncate">{log.description || log.action}</span>
                    <span className="block text-xs text-slate-500 truncate">{log.staffName || 'System'} - {formatDate(log.dateTime)}</span>
                  </span>
                </button>
              ))}
              {!logs.length && <div className="py-8 text-center text-sm text-slate-400">No recent activities.</div>}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy">System Alerts</h3>
              <button onClick={() => navigate('/settings/system-logs')} className="text-xs font-bold text-coop-blue">View All <ArrowRight size={12} className="inline" /></button>
            </div>
            <div className="space-y-3">
              {alertLogs.slice(0, 4).map(log => (
                <button key={log.id} onClick={() => navigate('/settings/system-logs')} className="w-full text-left flex gap-3 rounded-lg p-2 hover:bg-red-50">
                  <span className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle size={15} className="text-red-600" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-navy truncate">{log.module || log.action}</span>
                    <span className="block text-xs text-slate-500 truncate">{log.description || 'System alert'}</span>
                  </span>
                </button>
              ))}
              {!alertLogs.length && <div className="py-8 text-center text-sm text-slate-400">No system alerts.</div>}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">Quick Links</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => navigate('/admin/users')} className={quickLinkClass}><Users size={15} className="text-coop-blue" /> User Management</button>
              <button onClick={() => navigate('/admin/roles')} className={quickLinkClass}><Shield size={15} className="text-coop-blue" /> Role & Permissions</button>
              <button onClick={() => navigate('/settings')} className={quickLinkClass}><Settings size={15} className="text-coop-blue" /> System Settings</button>
              <button onClick={() => navigate('/settings/system-logs')} className={quickLinkClass}><FileText size={15} className="text-coop-blue" /> System Logs</button>
              <button onClick={() => navigate('/settings/backup-restore')} className={quickLinkClass}><Database size={15} className="text-coop-blue" /> Backup & Restore</button>
              <button onClick={() => navigate('/settings/integrations')} className={quickLinkClass}><Settings size={15} className="text-coop-blue" /> Integrations</button>
            </div>
          </section>
        </aside>
      </div>

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">&copy; {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.</footer>

      {showNote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-navy">Add Administrator Note</h3>
            <textarea value={noteText} onChange={event => setNoteText(event.target.value)} className="input-field min-h-[130px] mt-4" placeholder="Enter note..." />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNote(false)} className="flex-1 btn-secondary justify-center">Cancel</button>
              <button onClick={saveNote} className="flex-1 btn-primary bg-navy justify-center">Save Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
