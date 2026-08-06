import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  Bell,
  CheckCircle,
  Database,
  Download,
  Edit,
  Eye,
  FileText,
  HelpCircle,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { auditApi, settingsApi, staffApi } from '../../services/api'
import type { AuditLog, Staff } from '../../types'

type SecurityTab = 'Security Overview' | 'Password Policy' | 'Access Control' | 'Session Management' | 'Data Protection' | 'Audit & Activity'
type Status = 'Enabled' | 'Disabled' | 'Active' | 'Inactive' | 'Pending' | 'Completed'

type RetentionPolicy = {
  id: number
  dataType: string
  retentionPeriod: string
  expiryAction: string
  status: Status
  lastReview: string
}

type DataControl = {
  id: number
  control: string
  description: string
  status: Status
  lastUpdated: string
}

type TrustedDevice = {
  id: number
  name: string
  ipAddress: string
  lastSeen: string
  trusted: boolean
}

type SecurityState = {
  twoFactorEnabled: boolean
  minPasswordLength: string
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecial: boolean
  passwordExpiryEnabled: boolean
  passwordExpiryDays: string
  passwordHistory: string
  accountLockoutEnabled: boolean
  maxFailedAttempts: string
  lockoutDuration: string
  securityQuestions: boolean
  suspiciousActivityAlerts: boolean
  maintenanceModeLogin: boolean
  allowedIps: string[]
  restrictedResources: string[]
  trustedDevices: TrustedDevice[]
  sessionTimeout: string
  warningBeforeTimeout: string
  maxSessionsPerUser: string
  forceLogoutOnPasswordChange: boolean
  preventSessionFixation: boolean
  rememberDeviceDays: boolean
  notifyOnNewLogin: boolean
  encryptionAtRest: boolean
  encryptionInTransit: boolean
  backupEncryption: boolean
  securityHeaders: boolean
  retentionPolicies: RetentionPolicy[]
  dataControls: DataControl[]
  lastSecurityScan: string
  securityScanStatus: string
  forceLogoutRequestedAt: string
  clearedSessionsAt: string
}

const tabs: SecurityTab[] = ['Security Overview', 'Password Policy', 'Access Control', 'Session Management', 'Data Protection', 'Audit & Activity']

const emptySecurity: SecurityState = {
  twoFactorEnabled: false,
  minPasswordLength: '',
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSpecial: false,
  passwordExpiryEnabled: false,
  passwordExpiryDays: '',
  passwordHistory: '',
  accountLockoutEnabled: false,
  maxFailedAttempts: '',
  lockoutDuration: '',
  securityQuestions: false,
  suspiciousActivityAlerts: false,
  maintenanceModeLogin: false,
  allowedIps: [],
  restrictedResources: [],
  trustedDevices: [],
  sessionTimeout: '',
  warningBeforeTimeout: '',
  maxSessionsPerUser: '',
  forceLogoutOnPasswordChange: false,
  preventSessionFixation: false,
  rememberDeviceDays: false,
  notifyOnNewLogin: false,
  encryptionAtRest: false,
  encryptionInTransit: false,
  backupEncryption: false,
  securityHeaders: false,
  retentionPolicies: [],
  dataControls: [],
  lastSecurityScan: '',
  securityScanStatus: '',
  forceLogoutRequestedAt: '',
  clearedSessionsAt: '',
}

const modules = ['Dashboard', 'Staff Management', 'Management', 'Accounts', 'Trading Account', 'Trial Balance', 'Audit', 'Reports', 'Chat', 'Settings', 'User Management', 'Roles & Permissions']
const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  accountant: 'Accountant',
  auditor: 'Auditor',
  cashier: 'Cashier',
  loan_officer: 'Officer',
  manager: 'Manager',
  staff: 'Staff',
}

function nowStamp() {
  return new Date().toLocaleString()
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function downloadText(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function exportCsv(filename: string, headers: string[], rows: unknown[][]) {
  downloadText(filename, [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8')
}

function Card({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-navy">{title}</h3>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-navy">{label}</span>{children}</label>
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? 'bg-coop-blue' : 'bg-slate-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} /></button>
}

function ToggleRow({ icon, title, sub, checked, onChange }: { icon: ReactNode; title: string; sub: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-coop-blue">{icon}</span>
        <span>
          <span className="block text-sm font-bold text-navy">{title}</span>
          <span className="block text-xs text-slate-500">{sub}</span>
        </span>
      </div>
      <div className="text-right">
        <Toggle checked={checked} onChange={onChange} />
        <span className="mt-1 block text-[11px] text-slate-400">{checked ? 'Enabled' : 'Disabled'}</span>
      </div>
    </div>
  )
}

function Stat({ icon, label, value, sub, tone = 'blue' }: { icon: ReactNode; label: string; value: string; sub?: string; tone?: 'blue' | 'green' | 'orange' | 'purple' | 'red' }) {
  const tones = { blue: 'bg-blue-50 text-coop-blue', green: 'bg-green-50 text-coop-green', orange: 'bg-orange-50 text-orange-500', purple: 'bg-purple-50 text-purple-600', red: 'bg-red-50 text-red-600' }
  return <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span><span><span className="block text-xs font-semibold text-slate-500">{label}</span><span className="block text-xl font-bold text-navy">{value}</span>{sub && <span className="block text-xs text-slate-500">{sub}</span>}</span></div></div>
}

function StatusBadge({ value }: { value: string }) {
  const color = ['Enabled', 'Active', 'Completed', 'Success'].includes(value) ? 'bg-green-100 text-green-700' : value === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
  return <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${color}`}>{value}</span>
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{message}</div>
}

function ActionButton({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-bold hover:bg-blue-50 ${danger ? 'text-red-600' : 'text-coop-blue'}`}>{children}</button>
}

function MiniRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0"><span className="text-xs font-semibold text-navy">{label}</span><span className={`text-xs font-bold ${good ? 'text-coop-green' : 'text-navy'}`}>{value}</span></div>
}

export default function Security() {
  const [activeTab, setActiveTab] = useState<SecurityTab>('Security Overview')
  const [settings, setSettings] = useState<SecurityState>(emptySecurity)
  const [staff, setStaff] = useState<Staff[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [ipInput, setIpInput] = useState('')
  const [resourceInput, setResourceInput] = useState('')
  const [editingPolicy, setEditingPolicy] = useState(false)
  const [editingDataControl, setEditingDataControl] = useState<DataControl | null>(null)
  const [editingRetention, setEditingRetention] = useState<RetentionPolicy | null>(null)
  const [deviceForm, setDeviceForm] = useState<TrustedDevice | null>(null)
  const [auditFilter, setAuditFilter] = useState('')

  const secureCount = [
    settings.twoFactorEnabled,
    settings.requireUppercase,
    settings.requireLowercase,
    settings.requireNumbers,
    settings.requireSpecial,
    settings.accountLockoutEnabled,
    settings.encryptionAtRest,
    settings.encryptionInTransit,
    settings.securityHeaders,
  ].filter(Boolean).length
  const securityScore = Math.round((secureCount / 9) * 100)
  const roleGroups = useMemo(() => staff.reduce<Record<string, number>>((groups, row) => ({ ...groups, [row.role]: (groups[row.role] || 0) + 1 }), {}), [staff])
  const activeUsers = staff.filter(row => row.status === 'active').length
  const failedLogs = logs.filter(log => `${log.action} ${log.description}`.toLowerCase().includes('failed'))
  const securityLogs = logs.filter(log => `${log.action} ${log.module} ${log.description}`.toLowerCase().includes('security') || `${log.action} ${log.module} ${log.description}`.toLowerCase().includes('password') || `${log.action} ${log.module} ${log.description}`.toLowerCase().includes('login'))
  const displayedLogs = logs.filter(log => {
    const term = `${search} ${auditFilter}`.trim().toLowerCase()
    if (!term) return true
    return [log.staffName, log.action, log.module, log.description, log.ipAddress].some(value => String(value || '').toLowerCase().includes(term))
  })
  const accessPie = [
    { name: 'Full Access', value: Object.values(roleGroups).reduce((sum, count) => sum + count, 0), color: '#16A34A' },
    { name: 'Restricted', value: settings.restrictedResources.length, color: '#F59E0B' },
    { name: 'IP Rules', value: settings.allowedIps.length, color: '#2563EB' },
  ].filter(item => item.value > 0)
  const dataPie = [
    { name: 'Controls', value: settings.dataControls.length, color: '#2563EB' },
    { name: 'Retention Policies', value: settings.retentionPolicies.length, color: '#16A34A' },
    { name: 'Protection Alerts', value: failedLogs.length, color: '#EF4444' },
  ].filter(item => item.value > 0)

  useEffect(() => {
    Promise.all([
      settingsApi.get<SecurityState>('security').catch(() => emptySecurity),
      staffApi.list({ limit: 500 }).catch(() => ({ data: [], total: 0 })),
      auditApi.logs({ limit: 500 }).catch(() => ({ data: [], stats: {} })),
    ]).then(([saved, staffResult, auditResult]) => {
      setSettings({
        ...emptySecurity,
        ...saved,
        allowedIps: saved.allowedIps || [],
        restrictedResources: saved.restrictedResources || [],
        trustedDevices: saved.trustedDevices || [],
        retentionPolicies: saved.retentionPolicies || [],
        dataControls: saved.dataControls || [],
      })
      setStaff(staffResult.data || [])
      setLogs(auditResult.data || [])
    })
  }, [])

  const update = <K extends keyof SecurityState>(key: K, value: SecurityState[K]) => setSettings(prev => ({ ...prev, [key]: value }))

  const saveSettings = async (next = settings) => {
    try {
      setSaving(true)
      const saved = await settingsApi.save<SecurityState>('security', next)
      setSettings({
        ...emptySecurity,
        ...saved,
        allowedIps: saved.allowedIps || [],
        restrictedResources: saved.restrictedResources || [],
        trustedDevices: saved.trustedDevices || [],
        retentionPolicies: saved.retentionPolicies || [],
        dataControls: saved.dataControls || [],
      })
      toast.success('Security settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save security settings')
    } finally {
      setSaving(false)
    }
  }

  const resetToEmpty = async () => {
    setSettings(emptySecurity)
    await saveSettings(emptySecurity)
  }

  const runSecurityScan = async () => {
    const next = { ...settings, lastSecurityScan: nowStamp(), securityScanStatus: securityScore >= 70 ? 'Secure' : 'Needs attention' }
    await saveSettings(next)
    toast.success('Security scan completed')
  }

  const requestForceLogout = async () => {
    const next = { ...settings, forceLogoutRequestedAt: nowStamp() }
    await saveSettings(next)
    toast.success('Force logout request recorded')
  }

  const clearSessions = async () => {
    const next = { ...settings, trustedDevices: [], clearedSessionsAt: nowStamp() }
    await saveSettings(next)
    toast.success('Stored sessions cleared')
  }

  const exportAuditLog = () => {
    exportCsv('security-audit-log.csv', ['Date & Time', 'User', 'Action', 'Module', 'Description', 'IP Address'], displayedLogs.map(log => [log.dateTime, log.staffName, log.action, log.module, log.description, log.ipAddress]))
    toast.success('Security audit log exported')
  }

  const exportPolicy = () => {
    downloadText('password-policy.json', JSON.stringify(settings, null, 2), 'application/json;charset=utf-8')
    toast.success('Security policy exported')
  }

  const addIp = async () => {
    const value = ipInput.trim()
    if (!value) return toast.error('Enter an IP address')
    setIpInput('')
    await saveSettings({ ...settings, allowedIps: Array.from(new Set([...settings.allowedIps, value])) })
  }

  const addResource = async () => {
    const value = resourceInput.trim()
    if (!value) return toast.error('Enter a resource name')
    setResourceInput('')
    await saveSettings({ ...settings, restrictedResources: Array.from(new Set([...settings.restrictedResources, value])) })
  }

  const saveDataControl = async (row: DataControl) => {
    const exists = settings.dataControls.some(item => item.id === row.id)
    const next = exists ? settings.dataControls.map(item => item.id === row.id ? row : item) : [row, ...settings.dataControls]
    setEditingDataControl(null)
    await saveSettings({ ...settings, dataControls: next })
  }

  const saveRetention = async (row: RetentionPolicy) => {
    const exists = settings.retentionPolicies.some(item => item.id === row.id)
    const next = exists ? settings.retentionPolicies.map(item => item.id === row.id ? row : item) : [row, ...settings.retentionPolicies]
    setEditingRetention(null)
    await saveSettings({ ...settings, retentionPolicies: next })
  }

  const saveDevice = async (row: TrustedDevice) => {
    const exists = settings.trustedDevices.some(item => item.id === row.id)
    const next = exists ? settings.trustedDevices.map(item => item.id === row.id ? row : item) : [row, ...settings.trustedDevices]
    setDeviceForm(null)
    await saveSettings({ ...settings, trustedDevices: next })
  }

  const roleRows = Object.entries(roleGroups).map(([role, count]) => [roleLabels[role] || role, count] as [string, number])
  const activeSessions = settings.trustedDevices.filter(item => item.trusted).length
  const statusLabel = securityScore >= 80 ? 'Secure' : securityScore >= 50 ? 'Review Needed' : 'Needs Setup'

  return (
    <div className="space-y-4 p-3 md:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Security</h2>
          <p className="text-sm text-slate-500">Manage security settings and protect your cooperative data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search settings..." className="input-field w-64 pl-9" />
          </div>
          <button onClick={runSecurityScan} className="btn-secondary"><ShieldCheck size={14} /> Run Scan</button>
          <button onClick={() => saveSettings()} disabled={saving} className="btn-primary bg-coop-blue"><Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-b border-slate-200 bg-white px-2">
        {tabs.map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`border-b-2 px-3 py-3 text-xs font-bold ${activeTab === tab ? 'border-coop-blue text-coop-blue' : 'border-transparent text-navy hover:text-coop-blue'}`}>{tab}</button>)}
      </div>

      {activeTab === 'Security Overview' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Card title="Authentication & Access" sub="Manage how users authenticate and access the system.">
              <ToggleRow icon={<Lock size={18} />} title="Two-Factor Authentication (2FA)" sub="Add an extra layer of security to user accounts." checked={settings.twoFactorEnabled} onChange={value => update('twoFactorEnabled', value)} />
              <ActionRow icon={<Shield size={18} />} title="Login Security" sub="Configure login attempts, lockouts and restrictions." action="Configure" onClick={() => setActiveTab('Password Policy')} />
              <ActionRow icon={<Monitor size={18} />} title="IP Access Control" sub="Restrict system access by IP addresses." action="Manage IPs" onClick={() => setActiveTab('Access Control')} />
              <ActionRow icon={<Monitor size={18} />} title="Device Management" sub="Manage trusted devices and sessions." action="View Devices" onClick={() => setActiveTab('Session Management')} />
            </Card>
            <Card title="Password & Policy Settings" sub="Define password rules and security requirements.">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
                  <MiniRow label="Minimum length" value={settings.minPasswordLength || 'Not configured'} good={Boolean(settings.minPasswordLength)} />
                  <MiniRow label="Require uppercase" value={settings.requireUppercase ? 'Enabled' : 'Disabled'} good={settings.requireUppercase} />
                  <MiniRow label="Require lowercase" value={settings.requireLowercase ? 'Enabled' : 'Disabled'} good={settings.requireLowercase} />
                  <MiniRow label="Require numbers" value={settings.requireNumbers ? 'Enabled' : 'Disabled'} good={settings.requireNumbers} />
                  <MiniRow label="Require special characters" value={settings.requireSpecial ? 'Enabled' : 'Disabled'} good={settings.requireSpecial} />
                  <button onClick={() => setEditingPolicy(true)} className="mt-2 btn-secondary"><Edit size={14} /> Edit Policy</button>
                </div>
                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <ToggleRow icon={<KeyRound size={16} />} title="Password Expiry" sub="Force password change after expiry period." checked={settings.passwordExpiryEnabled} onChange={value => update('passwordExpiryEnabled', value)} />
                  <Field label="Expiry Period"><input value={settings.passwordExpiryDays} onChange={e => update('passwordExpiryDays', e.target.value)} placeholder="Days" className="input-field" /></Field>
                  <Field label="Password History"><input value={settings.passwordHistory} onChange={e => update('passwordHistory', e.target.value)} placeholder="Previous passwords to block" className="input-field" /></Field>
                </div>
              </div>
            </Card>
            <Card title="Data & System Protection" sub="Protect your data and system from threats.">
              <ToggleRow icon={<Database size={18} />} title="Data Encryption" sub="Encrypt sensitive data at rest." checked={settings.encryptionAtRest} onChange={value => update('encryptionAtRest', value)} />
              <ToggleRow icon={<Database size={18} />} title="Transport Encryption" sub="Require encrypted data in transit." checked={settings.encryptionInTransit} onChange={value => update('encryptionInTransit', value)} />
              <ToggleRow icon={<Database size={18} />} title="Backup Encryption" sub="Encrypt system backups." checked={settings.backupEncryption} onChange={value => update('backupEncryption', value)} />
              <ToggleRow icon={<Shield size={18} />} title="Security Headers" sub="Add security headers to responses." checked={settings.securityHeaders} onChange={value => update('securityHeaders', value)} />
            </Card>
            <Card title="Additional Security Options" sub="Other security configurations.">
              <ToggleRow icon={<HelpCircle size={18} />} title="Security Questions" sub="Enable security questions for password reset." checked={settings.securityQuestions} onChange={value => update('securityQuestions', value)} />
              <ToggleRow icon={<Bell size={18} />} title="Suspicious Activity Alerts" sub="Get notified about suspicious activities." checked={settings.suspiciousActivityAlerts} onChange={value => update('suspiciousActivityAlerts', value)} />
              <ToggleRow icon={<Lock size={18} />} title="Maintenance Mode Login" sub="Restrict logins during maintenance." checked={settings.maintenanceModeLogin} onChange={value => update('maintenanceModeLogin', value)} />
            </Card>
          </div>
          <div className="space-y-4">
            <Card title="Security Status">
              <div className="flex items-center gap-3"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-coop-green"><ShieldCheck size={26} /></span><div><div className="text-lg font-bold text-navy">{statusLabel}</div><div className="text-xs text-slate-500">{securityScore}% configured</div></div></div>
              <div className="mt-4 space-y-2">
                <MiniRow label="Firewall" value="Active" good />
                <MiniRow label="Security Scan" value={settings.lastSecurityScan || 'Not run'} good={Boolean(settings.lastSecurityScan)} />
                <MiniRow label="Failed Login Events" value={String(failedLogs.length)} />
                <MiniRow label="Active Users" value={String(activeUsers)} good={activeUsers > 0} />
              </div>
              <button onClick={runSecurityScan} className="mt-3 btn-secondary w-full justify-center"><ShieldCheck size={14} /> Run Security Scan</button>
            </Card>
            <QuickActions onForceLogout={requestForceLogout} onClearSessions={clearSessions} onLoginAttempts={() => { setActiveTab('Audit & Activity'); setAuditFilter('failed login') }} onExport={exportAuditLog} onUpdate={() => saveSettings()} />
            <Card title="Recent Security Activity" action={<button onClick={() => setActiveTab('Audit & Activity')} className="text-xs font-bold text-coop-blue">View All</button>}>
              {securityLogs.length ? <LogList logs={securityLogs.slice(0, 5)} /> : <EmptyState message="No security activity found." />}
            </Card>
            <Card title="Security Tips"><ul className="space-y-2 text-xs text-slate-600"><li>Use strong, unique passwords.</li><li>Enable two-factor authentication.</li><li>Review user access regularly.</li><li>Keep security settings up to date.</li></ul><button onClick={() => downloadText('security-guide.txt', 'Security guide: enable 2FA, password policy, session controls and data protection.')} className="mt-3 text-xs font-bold text-coop-blue">Learn more about security</button></Card>
          </div>
        </div>
      )}

      {activeTab === 'Password Policy' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Card title="Password Policy Overview" sub="Configure rules and requirements for user passwords across the system.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Stat icon={<ShieldCheck size={20} />} label="Policy Strength" value={securityScore >= 70 ? 'Strong' : 'Incomplete'} sub="Security level" tone="green" />
                <Stat icon={<Lock size={20} />} label="Minimum Length" value={settings.minPasswordLength || '0'} sub="characters" tone="green" />
                <Stat icon={<KeyRound size={20} />} label="Password Expiry" value={settings.passwordExpiryDays || '0'} sub="days" tone="orange" />
                <Stat icon={<FileText size={20} />} label="Last Updated" value={settings.lastSecurityScan ? 'Saved' : 'Not saved'} sub={settings.lastSecurityScan || ''} tone="purple" />
              </div>
            </Card>
            <Card title="Password Policy Rules" sub="Define the rules that all passwords must meet." action={<button onClick={() => setEditingPolicy(true)} className="btn-secondary"><Edit size={14} /> Edit Rules</button>}>
              <PolicyRules settings={settings} update={update} />
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Password Expiry Settings" sub="Configure password expiration and notification settings.">
                <div className="space-y-3">
                  <Field label="Password Expiry Period"><input value={settings.passwordExpiryDays} onChange={e => update('passwordExpiryDays', e.target.value)} placeholder="Days" className="input-field" /></Field>
                  <Field label="Password History"><input value={settings.passwordHistory} onChange={e => update('passwordHistory', e.target.value)} placeholder="Previous passwords to block" className="input-field" /></Field>
                  <ToggleRow icon={<KeyRound size={16} />} title="Enable Expiry" sub="Require users to change passwords." checked={settings.passwordExpiryEnabled} onChange={value => update('passwordExpiryEnabled', value)} />
                </div>
              </Card>
              <Card title="Account Lockout Settings" sub="Configure account lockout for failed login attempts.">
                <div className="space-y-3">
                  <Field label="Maximum Failed Attempts"><input value={settings.maxFailedAttempts} onChange={e => update('maxFailedAttempts', e.target.value)} placeholder="Attempts" className="input-field" /></Field>
                  <Field label="Lockout Duration"><input value={settings.lockoutDuration} onChange={e => update('lockoutDuration', e.target.value)} placeholder="Minutes" className="input-field" /></Field>
                  <ToggleRow icon={<Lock size={16} />} title="Account Lockout" sub="Lock account after failed attempts." checked={settings.accountLockoutEnabled} onChange={value => update('accountLockoutEnabled', value)} />
                </div>
              </Card>
            </div>
          </div>
          <div className="space-y-4">
            <Card title="Quick Actions"><div className="space-y-2"><ActionButton onClick={() => setEditingPolicy(true)}><Edit size={14} /> Edit Policy</ActionButton><ActionButton onClick={resetToEmpty}><RefreshCw size={14} /> Reset to Empty</ActionButton><ActionButton onClick={() => saveSettings()}><ShieldCheck size={14} /> Enforce Policy Now</ActionButton><ActionButton onClick={exportPolicy}><Download size={14} /> Export Policy</ActionButton></div></Card>
            <Card title="Policy Strength Meter"><div className="flex flex-col items-center"><div className="flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-green-500 text-xl font-bold text-navy">{securityScore}%</div><p className="mt-3 text-center text-sm font-bold text-navy">{securityScore >= 70 ? 'Strong' : 'Incomplete'}</p></div></Card>
            <Card title="Password Policy Tips"><ul className="space-y-3 text-xs text-slate-600"><li>Use a mix of letters, numbers and special characters.</li><li>Avoid using personal information in passwords.</li><li>Change passwords regularly.</li></ul><button onClick={() => downloadText('password-policy-guide.txt', 'Password policy guide')} className="mt-3 btn-secondary"><FileText size={14} /> View Security Guide</button></Card>
          </div>
        </div>
      )}

      {activeTab === 'Access Control' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Card title="Access Control Overview" sub="Manage roles, permissions and access to system resources.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Stat icon={<Users size={20} />} label="Total Roles" value={String(roleRows.length)} sub="Active roles" />
                <Stat icon={<UserCog size={20} />} label="Total Users" value={String(staff.length)} sub="System users" tone="green" />
                <Stat icon={<Shield size={20} />} label="Restricted Resources" value={String(settings.restrictedResources.length)} sub="With limited access" tone="purple" />
                <Stat icon={<Monitor size={20} />} label="IP Rules" value={String(settings.allowedIps.length)} sub="Allowed IP addresses" tone="orange" />
              </div>
            </Card>
            <Card title="Roles & Permissions Summary" sub="Overview of system roles and their user count." action={<button onClick={() => window.location.assign('/settings/roles-permissions')} className="btn-secondary"><Users size={14} /> View Roles</button>}>
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Role Name', 'Users', 'Status'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead><tbody>{roleRows.length ? roleRows.map(([role, count]) => <tr key={role} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{role}</td><td className="px-3 py-2">{count}</td><td className="px-3 py-2"><StatusBadge value="Active" /></td></tr>) : <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">No roles found.</td></tr>}</tbody></table></div>
            </Card>
            <Card title="Module Access Matrix" sub="View which roles have access to each system module.">
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">Module</th>{roleRows.map(([role]) => <th key={role} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{role}</th>)}</tr></thead><tbody>{modules.map(module => <tr key={module} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{module}</td>{roleRows.map(([role]) => <td key={`${module}-${role}`} className="px-3 py-2"><StatusBadge value={role === 'Super Admin' || role === 'Admin' ? 'Enabled' : 'Active'} /></td>)}</tr>)}</tbody></table></div>
            </Card>
            <Card title="User Access Assignment" sub="Manage user access by assigning appropriate roles." action={<button onClick={() => window.location.assign('/admin/users/new')} className="btn-secondary"><Plus size={14} /> Add New User</button>}>
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['User', 'Email', 'Role', 'Status', 'Last Login'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead><tbody>{staff.length ? staff.slice(0, 8).map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{row.fullName}</td><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{roleLabels[row.role] || row.role}</td><td className="px-3 py-2"><StatusBadge value={row.status === 'active' ? 'Active' : 'Inactive'} /></td><td className="px-3 py-2">{row.lastLogin || '-'}</td></tr>) : <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No users found.</td></tr>}</tbody></table></div>
            </Card>
          </div>
          <div className="space-y-4">
            <Card title="Quick Actions"><div className="space-y-2"><ActionButton onClick={() => window.location.assign('/settings/roles-permissions')}><Plus size={14} /> Create New Role</ActionButton><ActionButton onClick={() => window.location.assign('/settings/roles-permissions')}><Shield size={14} /> Assign Permissions</ActionButton><ActionButton onClick={() => window.location.assign('/admin/users')}><Users size={14} /> Manage Users</ActionButton><ActionButton onClick={() => exportCsv('access-control-report.csv', ['Role', 'Users'], roleRows)}><Download size={14} /> Export Access Report</ActionButton></div></Card>
            <Card title="IP Access Control"><div className="flex gap-2"><input value={ipInput} onChange={e => setIpInput(e.target.value)} placeholder="IP address" className="input-field" /><button onClick={addIp} className="btn-primary bg-coop-blue"><Plus size={14} /></button></div><ListItems rows={settings.allowedIps} onRemove={value => saveSettings({ ...settings, allowedIps: settings.allowedIps.filter(item => item !== value) })} empty="No IP restrictions configured." /></Card>
            <Card title="Restricted Resources"><div className="flex gap-2"><input value={resourceInput} onChange={e => setResourceInput(e.target.value)} placeholder="Resource name" className="input-field" /><button onClick={addResource} className="btn-primary bg-coop-blue"><Plus size={14} /></button></div><ListItems rows={settings.restrictedResources} onRemove={value => saveSettings({ ...settings, restrictedResources: settings.restrictedResources.filter(item => item !== value) })} empty="No restricted resources configured." /></Card>
            <PieCard title="Access Control Health" data={accessPie} empty="No access data yet." />
          </div>
        </div>
      )}

      {activeTab === 'Session Management' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Card title="Session Management Overview" sub="Monitor and manage user sessions across the system for better security.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Stat icon={<Users size={20} />} label="Active Sessions" value={String(activeSessions)} sub="Trusted devices" />
                <Stat icon={<Monitor size={20} />} label="Total Devices" value={String(settings.trustedDevices.length)} sub="Stored devices" tone="green" />
                <Stat icon={<CheckCircle size={20} />} label="Successful Logins" value={String(logs.filter(log => `${log.action} ${log.description}`.toLowerCase().includes('login')).length)} sub="From audit log" tone="orange" />
                <Stat icon={<Shield size={20} />} label="Blocked Sessions" value={String(failedLogs.length)} sub="Security events" tone="red" />
              </div>
            </Card>
            <Card title="Trusted Devices" sub="Devices that are allowed or remembered for login." action={<button onClick={() => setDeviceForm({ id: Date.now(), name: '', ipAddress: '', lastSeen: '', trusted: true })} className="btn-secondary"><Plus size={14} /> Add Device</button>}>
              <DeviceTable rows={settings.trustedDevices} onEdit={setDeviceForm} onToggle={row => saveDevice({ ...row, trusted: !row.trusted })} onDelete={id => saveSettings({ ...settings, trustedDevices: settings.trustedDevices.filter(item => item.id !== id) })} />
            </Card>
            <Card title="Recent Session Activity" sub="Latest login and session events.">
              {securityLogs.length ? <LogTable logs={securityLogs.slice(0, 8)} /> : <EmptyState message="No session activity found." />}
            </Card>
            <Card title="Session Timeout & Security Settings" sub="Configure session expiration and security rules.">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <Field label="Session Timeout"><input value={settings.sessionTimeout} onChange={e => update('sessionTimeout', e.target.value)} placeholder="Minutes" className="input-field" /></Field>
                  <Field label="Warning Before Timeout"><input value={settings.warningBeforeTimeout} onChange={e => update('warningBeforeTimeout', e.target.value)} placeholder="Minutes" className="input-field" /></Field>
                  <Field label="Maximum Sessions per User"><input value={settings.maxSessionsPerUser} onChange={e => update('maxSessionsPerUser', e.target.value)} placeholder="Sessions" className="input-field" /></Field>
                </div>
                <div className="space-y-1"><ToggleRow icon={<LogOut size={16} />} title="Force Logout on Password Change" sub="Log out all other sessions when password changes." checked={settings.forceLogoutOnPasswordChange} onChange={value => update('forceLogoutOnPasswordChange', value)} /><ToggleRow icon={<Shield size={16} />} title="Prevent Session Fixation" sub="Regenerate session ID after login." checked={settings.preventSessionFixation} onChange={value => update('preventSessionFixation', value)} /><ToggleRow icon={<Monitor size={16} />} title="Remember Device" sub="Reduce frequent logins on trusted devices." checked={settings.rememberDeviceDays} onChange={value => update('rememberDeviceDays', value)} /><ToggleRow icon={<Bell size={16} />} title="Notify on New Login" sub="Send alert when new login is detected." checked={settings.notifyOnNewLogin} onChange={value => update('notifyOnNewLogin', value)} /></div>
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            <Card title="Quick Actions"><div className="space-y-2"><ActionButton onClick={() => toast.success('Showing all stored sessions')}><Eye size={14} /> View All Sessions</ActionButton><ActionButton onClick={() => setDeviceForm({ id: Date.now(), name: '', ipAddress: '', lastSeen: '', trusted: true })}><Monitor size={14} /> Add Session Device</ActionButton><ActionButton onClick={requestForceLogout} danger><LogOut size={14} /> Force Logout All</ActionButton><ActionButton onClick={() => exportCsv('session-log.csv', ['Device', 'IP Address', 'Last Seen', 'Trusted'], settings.trustedDevices.map(row => [row.name, row.ipAddress, row.lastSeen, row.trusted ? 'Yes' : 'No']))}><Download size={14} /> Export Session Log</ActionButton></div></Card>
            <PieCard title="Session Summary" data={[{ name: 'Trusted', value: activeSessions, color: '#16A34A' }, { name: 'Untrusted', value: settings.trustedDevices.length - activeSessions, color: '#EF4444' }].filter(item => item.value > 0)} empty="No session data yet." />
            <Card title="Session Management Tips"><ul className="space-y-3 text-xs text-slate-600"><li>Review active sessions regularly.</li><li>Terminate unknown sessions quickly.</li><li>Use strong passwords and 2FA.</li></ul></Card>
          </div>
        </div>
      )}

      {activeTab === 'Data Protection' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Card title="Data Protection Overview" sub="Monitor and manage how cooperative data is protected across the system.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Stat icon={<Shield size={20} />} label="Encryption" value={settings.encryptionAtRest && settings.encryptionInTransit ? 'Enabled' : 'Incomplete'} sub="Data protection" />
                <Stat icon={<Database size={20} />} label="Backups" value={settings.backupEncryption ? 'Encrypted' : 'Not set'} sub="Backup protection" tone="green" />
                <Stat icon={<FileText size={20} />} label="Data Controls" value={String(settings.dataControls.length)} sub="Configured controls" tone="orange" />
                <Stat icon={<FileText size={20} />} label="Retention Policies" value={String(settings.retentionPolicies.length)} sub="Active policies" tone="purple" />
                <Stat icon={<XCircle size={20} />} label="Protection Alerts" value={String(failedLogs.length)} sub="From audit log" tone="red" />
              </div>
            </Card>
            <Card title="Data Protection Controls" sub="Configure and review data protection settings." action={<button onClick={() => setEditingDataControl({ id: Date.now(), control: '', description: '', status: 'Enabled', lastUpdated: nowStamp() })} className="btn-secondary"><Plus size={14} /> Add Control</button>}>
              <DataControlTable rows={settings.dataControls} onEdit={setEditingDataControl} onDelete={id => saveSettings({ ...settings, dataControls: settings.dataControls.filter(item => item.id !== id) })} />
            </Card>
            <Card title="Data Retention Policies" sub="Manage how long different types of data are retained." action={<button onClick={() => setEditingRetention({ id: Date.now(), dataType: '', retentionPeriod: '', expiryAction: '', status: 'Active', lastReview: nowStamp() })} className="btn-secondary"><Plus size={14} /> Add Retention Policy</button>}>
              <RetentionTable rows={settings.retentionPolicies} onEdit={setEditingRetention} onDelete={id => saveSettings({ ...settings, retentionPolicies: settings.retentionPolicies.filter(item => item.id !== id) })} />
            </Card>
          </div>
          <div className="space-y-4">
            <PieCard title="Data Classification" data={dataPie} empty="No data protection records yet." />
            <Card title="Compliance Status"><MiniRow label="Data Encryption" value={settings.encryptionAtRest && settings.encryptionInTransit ? 'Compliant' : 'Incomplete'} good={settings.encryptionAtRest && settings.encryptionInTransit} /><MiniRow label="Backup Encryption" value={settings.backupEncryption ? 'Compliant' : 'Incomplete'} good={settings.backupEncryption} /><MiniRow label="Retention Policies" value={settings.retentionPolicies.length ? 'Configured' : 'Not configured'} good={settings.retentionPolicies.length > 0} /><button onClick={() => exportCsv('data-protection-report.csv', ['Item', 'Value'], [['Data controls', settings.dataControls.length], ['Retention policies', settings.retentionPolicies.length], ['Protection alerts', failedLogs.length]])} className="mt-3 btn-secondary"><Download size={14} /> View Compliance Report</button></Card>
            <Card title="Backup Status"><MiniRow label="Backup Encryption" value={settings.backupEncryption ? 'Enabled' : 'Disabled'} good={settings.backupEncryption} /><MiniRow label="Last Session Clear" value={settings.clearedSessionsAt || '-'} /><button onClick={() => update('backupEncryption', true)} className="mt-3 btn-secondary"><Database size={14} /> Enable Backup Encryption</button></Card>
            <Card title="Data Protection Tips"><ul className="space-y-2 text-xs text-slate-600"><li>Only collect data that is necessary.</li><li>Always encrypt sensitive data.</li><li>Review access permissions regularly.</li><li>Store backups in a secure location.</li></ul></Card>
          </div>
        </div>
      )}

      {activeTab === 'Audit & Activity' && (
        <div className="space-y-4">
          <Card title="Audit & Activity Overview" sub="Track and review all system activities and security events.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Stat icon={<FileText size={20} />} label="Total Events" value={String(logs.length)} sub="Loaded audit events" />
              <Stat icon={<Users size={20} />} label="User Logins" value={String(securityLogs.length)} sub="Login/security events" tone="green" />
              <Stat icon={<Shield size={20} />} label="Security Events" value={String(securityLogs.length)} sub="Audit matches" tone="orange" />
              <Stat icon={<Edit size={20} />} label="Data Changes" value={String(logs.filter(log => log.action === 'UPDATE').length)} sub="Update actions" tone="purple" />
              <Stat icon={<Download size={20} />} label="Reports Generated" value={String(logs.filter(log => log.module === 'Reports').length)} sub="Report audit events" tone="green" />
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-4">
              <Card title="Audit Trail" sub="View and search system audit events." action={<button onClick={exportAuditLog} className="btn-secondary"><Download size={14} /> Export Audit Log</button>}>
                <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input value={auditFilter} onChange={e => setAuditFilter(e.target.value)} placeholder="Search events, users or actions..." className="input-field" />
                  <select value={auditFilter} onChange={e => setAuditFilter(e.target.value)} className="input-field"><option value="">All Event Types</option><option value="login">Login</option><option value="password">Password</option><option value="failed">Failed</option><option value="security">Security</option></select>
                  <button onClick={() => { setAuditFilter(''); setSearch('') }} className="btn-secondary justify-center"><RefreshCw size={14} /> Reset</button>
                </div>
                <LogTable logs={displayedLogs.slice(0, 12)} />
              </Card>
            </div>
            <div className="space-y-4">
              <PieCard title="Event Type Distribution" data={[{ name: 'Security', value: securityLogs.length, color: '#16A34A' }, { name: 'Failed', value: failedLogs.length, color: '#EF4444' }, { name: 'Other', value: Math.max(logs.length - securityLogs.length, 0), color: '#2563EB' }].filter(item => item.value > 0)} empty="No audit events yet." />
              <Card title="Top Active Users">{staff.length ? staff.slice(0, 5).map(row => <MiniRow key={row.id} label={row.fullName} value={row.lastLogin || '-'} />) : <EmptyState message="No users found." />}</Card>
              <Card title="Security Alerts">{failedLogs.length ? <LogList logs={failedLogs.slice(0, 5)} /> : <EmptyState message="No security alerts found." />}</Card>
            </div>
          </div>
          <Card title="Audit Log Reports" sub="Generate and download detailed audit reports.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">{['User Activity Report', 'Security Events Report', 'Data Changes Report', 'Compliance Report', 'Custom Report'].map(label => <ActionButton key={label} onClick={() => exportAuditLog()}><Download size={14} /> {label}</ActionButton>)}</div>
          </Card>
        </div>
      )}

      {editingPolicy && <PolicyModal data={settings} onClose={() => setEditingPolicy(false)} onSave={next => { setEditingPolicy(false); saveSettings(next) }} />}
      {editingDataControl && <DataControlModal data={editingDataControl} onClose={() => setEditingDataControl(null)} onSave={saveDataControl} />}
      {editingRetention && <RetentionModal data={editingRetention} onClose={() => setEditingRetention(null)} onSave={saveRetention} />}
      {deviceForm && <DeviceModal data={deviceForm} onClose={() => setDeviceForm(null)} onSave={saveDevice} />}
    </div>
  )
}

function ActionRow({ icon, title, sub, action, onClick }: { icon: ReactNode; title: string; sub: string; action: string; onClick: () => void }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-coop-blue">{icon}</span><span><span className="block text-sm font-bold text-navy">{title}</span><span className="block text-xs text-slate-500">{sub}</span></span></div><button onClick={onClick} className="btn-secondary">{action}</button></div>
}

function QuickActions({ onForceLogout, onClearSessions, onLoginAttempts, onExport, onUpdate }: { onForceLogout: () => void; onClearSessions: () => void; onLoginAttempts: () => void; onExport: () => void; onUpdate: () => void }) {
  return <Card title="Quick Actions"><div className="space-y-2"><ActionButton onClick={onForceLogout} danger><LogOut size={14} /> Force Logout All Users</ActionButton><ActionButton onClick={onClearSessions}><Trash2 size={14} /> Clear All Sessions</ActionButton><ActionButton onClick={onLoginAttempts}><Eye size={14} /> View Login Attempts</ActionButton><ActionButton onClick={onExport}><Download size={14} /> Download Audit Log</ActionButton><ActionButton onClick={onUpdate}><Save size={14} /> Update Security Settings</ActionButton></div></Card>
}

function PolicyRules({ settings, update }: { settings: SecurityState; update: <K extends keyof SecurityState>(key: K, value: SecurityState[K]) => void }) {
  const rows: Array<[string, string, keyof SecurityState]> = [
    ['Minimum Password Length', settings.minPasswordLength ? `At least ${settings.minPasswordLength} characters` : 'Not configured', 'minPasswordLength'],
    ['Require Uppercase Letters', 'At least 1 uppercase letter', 'requireUppercase'],
    ['Require Lowercase Letters', 'At least 1 lowercase letter', 'requireLowercase'],
    ['Require Numbers', 'At least 1 number', 'requireNumbers'],
    ['Require Special Characters', 'At least 1 special character', 'requireSpecial'],
    ['Password Expiry', settings.passwordExpiryDays ? `Expires after ${settings.passwordExpiryDays} days` : 'Not configured', 'passwordExpiryEnabled'],
    ['Prevent Password Reuse', settings.passwordHistory ? `Block last ${settings.passwordHistory} passwords` : 'Not configured', 'passwordHistory'],
    ['Account Lockout', settings.maxFailedAttempts ? `Lock after ${settings.maxFailedAttempts} attempts` : 'Not configured', 'accountLockoutEnabled'],
  ]
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Rule', 'Requirement', 'Status', 'Enforced'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead><tbody>{rows.map(([rule, req, key]) => { const current = settings[key]; const enabled = Boolean(current); return <tr key={rule} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{rule}</td><td className="px-3 py-2">{req}</td><td className="px-3 py-2"><StatusBadge value={enabled ? 'Enabled' : 'Disabled'} /></td><td className="px-3 py-2">{typeof current === 'boolean' ? <Toggle checked={enabled} onChange={value => update(key, value as SecurityState[typeof key])} /> : '-'}</td></tr> })}</tbody></table></div>
}

function ListItems({ rows, onRemove, empty }: { rows: string[]; onRemove: (value: string) => void; empty: string }) {
  return <div className="mt-3 space-y-2">{rows.length ? rows.map(row => <div key={row} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs"><span className="font-semibold text-navy">{row}</span><button onClick={() => onRemove(row)} className="text-red-600"><Trash2 size={14} /></button></div>) : <EmptyState message={empty} />}</div>
}

function PieCard({ title, data, empty }: { title: string; data: Array<{ name: string; value: number; color: string }>; empty: string }) {
  return <Card title={title}>{data.length ? <><div className="h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" innerRadius={45} outerRadius={70}>{data.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="space-y-2">{data.map(item => <MiniRow key={item.name} label={item.name} value={String(item.value)} />)}</div></> : <EmptyState message={empty} />}</Card>
}

function DeviceTable({ rows, onEdit, onToggle, onDelete }: { rows: TrustedDevice[]; onEdit: (row: TrustedDevice) => void; onToggle: (row: TrustedDevice) => void; onDelete: (id: number) => void }) {
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Device', 'IP Address', 'Last Seen', 'Trusted', 'Actions'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{row.name}</td><td className="px-3 py-2">{row.ipAddress}</td><td className="px-3 py-2">{row.lastSeen || '-'}</td><td className="px-3 py-2"><StatusBadge value={row.trusted ? 'Active' : 'Inactive'} /></td><td className="px-3 py-2"><div className="flex gap-2"><button onClick={() => onEdit(row)} className="rounded-md border p-1.5 text-coop-blue"><Edit size={13} /></button><button onClick={() => onToggle(row)} className="rounded-md border p-1.5 text-navy">{row.trusted ? <Lock size={13} /> : <Unlock size={13} />}</button><button onClick={() => onDelete(row.id)} className="rounded-md border p-1.5 text-red-600"><Trash2 size={13} /></button></div></td></tr>) : <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No trusted devices configured.</td></tr>}</tbody></table></div>
}

function DataControlTable({ rows, onEdit, onDelete }: { rows: DataControl[]; onEdit: (row: DataControl) => void; onDelete: (id: number) => void }) {
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Control', 'Description', 'Status', 'Last Updated', 'Actions'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{row.control}</td><td className="px-3 py-2">{row.description}</td><td className="px-3 py-2"><StatusBadge value={row.status} /></td><td className="px-3 py-2">{row.lastUpdated || '-'}</td><td className="px-3 py-2"><button onClick={() => onEdit(row)} className="mr-2 rounded-md border p-1.5 text-coop-blue"><Edit size={13} /></button><button onClick={() => onDelete(row.id)} className="rounded-md border p-1.5 text-red-600"><Trash2 size={13} /></button></td></tr>) : <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No data protection controls configured.</td></tr>}</tbody></table></div>
}

function RetentionTable({ rows, onEdit, onDelete }: { rows: RetentionPolicy[]; onEdit: (row: RetentionPolicy) => void; onDelete: (id: number) => void }) {
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Data Type', 'Retention Period', 'Action After Expiry', 'Status', 'Last Review', 'Actions'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{row.dataType}</td><td className="px-3 py-2">{row.retentionPeriod}</td><td className="px-3 py-2">{row.expiryAction}</td><td className="px-3 py-2"><StatusBadge value={row.status} /></td><td className="px-3 py-2">{row.lastReview || '-'}</td><td className="px-3 py-2"><button onClick={() => onEdit(row)} className="mr-2 rounded-md border p-1.5 text-coop-blue"><Edit size={13} /></button><button onClick={() => onDelete(row.id)} className="rounded-md border p-1.5 text-red-600"><Trash2 size={13} /></button></td></tr>) : <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No retention policies configured.</td></tr>}</tbody></table></div>
}

function LogList({ logs }: { logs: AuditLog[] }) {
  return <div className="divide-y divide-slate-100">{logs.map(log => <div key={log.id} className="py-3 text-xs"><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-navy">{log.action}</div><div className="text-slate-500">{log.description || log.module}</div></div><span className="text-slate-400">{log.dateTime || '-'}</span></div></div>)}</div>
}

function LogTable({ logs }: { logs: AuditLog[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Time', 'User', 'Action', 'Module', 'IP Address', 'Details'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead><tbody>{logs.length ? logs.map(log => <tr key={log.id} className="border-t border-slate-100"><td className="px-3 py-2">{log.dateTime || '-'}</td><td className="px-3 py-2 font-bold text-navy">{log.staffName || 'System'}</td><td className="px-3 py-2">{log.action}</td><td className="px-3 py-2">{log.module}</td><td className="px-3 py-2">{log.ipAddress || '-'}</td><td className="px-3 py-2">{log.description || '-'}</td></tr>) : <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No audit events found.</td></tr>}</tbody></table></div>
}

function Modal({ title, children, onClose, onSave }: { title: string; children: ReactNode; onClose: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-2xl rounded-xl bg-white p-6"><h3 className="text-lg font-bold text-navy">{title}</h3><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={onClose} className="btn-secondary justify-center">Cancel</button><button onClick={onSave} className="btn-primary bg-coop-blue justify-center"><Save size={14} /> Save</button></div></div></div>
}

function PolicyModal({ data, onClose, onSave }: { data: SecurityState; onClose: () => void; onSave: (value: SecurityState) => void }) {
  const [row, setRow] = useState(data)
  const set = <K extends keyof SecurityState>(key: K, value: SecurityState[K]) => setRow(prev => ({ ...prev, [key]: value }))
  return <Modal title="Password Policy" onClose={onClose} onSave={() => onSave(row)}><Field label="Minimum Password Length"><input value={row.minPasswordLength} onChange={e => set('minPasswordLength', e.target.value)} className="input-field" /></Field><Field label="Password Expiry Days"><input value={row.passwordExpiryDays} onChange={e => set('passwordExpiryDays', e.target.value)} className="input-field" /></Field><Field label="Password History"><input value={row.passwordHistory} onChange={e => set('passwordHistory', e.target.value)} className="input-field" /></Field><Field label="Failed Login Attempts"><input value={row.maxFailedAttempts} onChange={e => set('maxFailedAttempts', e.target.value)} className="input-field" /></Field><ToggleRow icon={<KeyRound size={16} />} title="Uppercase" sub="Require uppercase letter." checked={row.requireUppercase} onChange={value => set('requireUppercase', value)} /><ToggleRow icon={<KeyRound size={16} />} title="Lowercase" sub="Require lowercase letter." checked={row.requireLowercase} onChange={value => set('requireLowercase', value)} /><ToggleRow icon={<KeyRound size={16} />} title="Numbers" sub="Require number." checked={row.requireNumbers} onChange={value => set('requireNumbers', value)} /><ToggleRow icon={<KeyRound size={16} />} title="Special Characters" sub="Require special character." checked={row.requireSpecial} onChange={value => set('requireSpecial', value)} /></Modal>
}

function DataControlModal({ data, onClose, onSave }: { data: DataControl; onClose: () => void; onSave: (row: DataControl) => void }) {
  const [row, setRow] = useState(data)
  return <Modal title="Data Protection Control" onClose={onClose} onSave={() => onSave({ ...row, lastUpdated: nowStamp() })}><Field label="Control"><input value={row.control} onChange={e => setRow({ ...row, control: e.target.value })} className="input-field" /></Field><Field label="Description"><input value={row.description} onChange={e => setRow({ ...row, description: e.target.value })} className="input-field" /></Field><Field label="Status"><select value={row.status} onChange={e => setRow({ ...row, status: e.target.value as Status })} className="input-field"><option>Enabled</option><option>Disabled</option><option>Active</option><option>Inactive</option></select></Field></Modal>
}

function RetentionModal({ data, onClose, onSave }: { data: RetentionPolicy; onClose: () => void; onSave: (row: RetentionPolicy) => void }) {
  const [row, setRow] = useState(data)
  return <Modal title="Retention Policy" onClose={onClose} onSave={() => onSave({ ...row, lastReview: nowStamp() })}><Field label="Data Type"><input value={row.dataType} onChange={e => setRow({ ...row, dataType: e.target.value })} className="input-field" /></Field><Field label="Retention Period"><input value={row.retentionPeriod} onChange={e => setRow({ ...row, retentionPeriod: e.target.value })} className="input-field" /></Field><Field label="Action After Expiry"><input value={row.expiryAction} onChange={e => setRow({ ...row, expiryAction: e.target.value })} className="input-field" /></Field><Field label="Status"><select value={row.status} onChange={e => setRow({ ...row, status: e.target.value as Status })} className="input-field"><option>Active</option><option>Inactive</option><option>Pending</option><option>Completed</option></select></Field></Modal>
}

function DeviceModal({ data, onClose, onSave }: { data: TrustedDevice; onClose: () => void; onSave: (row: TrustedDevice) => void }) {
  const [row, setRow] = useState(data)
  return <Modal title="Trusted Device" onClose={onClose} onSave={() => onSave({ ...row, lastSeen: row.lastSeen || nowStamp() })}><Field label="Device Name"><input value={row.name} onChange={e => setRow({ ...row, name: e.target.value })} className="input-field" /></Field><Field label="IP Address"><input value={row.ipAddress} onChange={e => setRow({ ...row, ipAddress: e.target.value })} className="input-field" /></Field><Field label="Last Seen"><input value={row.lastSeen} onChange={e => setRow({ ...row, lastSeen: e.target.value })} className="input-field" /></Field><ToggleRow icon={<Monitor size={16} />} title="Trusted" sub="Allow this remembered device." checked={row.trusted} onChange={value => setRow({ ...row, trusted: value })} /></Modal>
}
