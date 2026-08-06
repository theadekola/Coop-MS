import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import toast from 'react-hot-toast'
import {
  Bell,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Palette,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Smartphone,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { authApi, settingsApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types'

type TabKey = 'personal' | 'contact' | 'preferences'

type SessionRow = {
  id: string
  device: string
  location: string
  ipAddress: string
  lastActive: string
  current?: boolean
}

type ActivityRow = {
  id: string
  title: string
  description: string
  dateTime: string
}

type ProfileSettings = {
  username: string
  joinedDate: string
  bio: string
  location: string
  photoDataUrl: string
  workEmail: string
  alternatePhone: string
  emergencyContact: string
  preferredContactMethod: string
  addressType: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  mailingAddress: boolean
  defaultDashboard: string
  itemsPerPage: string
  dateFormat: string
  timeFormat: '12' | '24'
  theme: 'light' | 'dark' | 'system'
  primaryColor: string
  sidebarBehavior: string
  compactMode: boolean
  emailNotifications: boolean
  browserNotifications: boolean
  smsNotifications: boolean
  systemAnnouncements: boolean
  sessions: SessionRow[]
  activities: ActivityRow[]
}

const emptySettings: ProfileSettings = {
  username: '',
  joinedDate: '',
  bio: '',
  location: '',
  photoDataUrl: '',
  workEmail: '',
  alternatePhone: '',
  emergencyContact: '',
  preferredContactMethod: 'Email',
  addressType: 'Office Address',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Nigeria',
  mailingAddress: true,
  defaultDashboard: 'Dashboard',
  itemsPerPage: '25',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24',
  theme: 'light',
  primaryColor: '#2563EB',
  sidebarBehavior: 'Expanded',
  compactMode: false,
  emailNotifications: true,
  browserNotifications: true,
  smsNotifications: false,
  systemAnnouncements: true,
  sessions: [],
  activities: [],
}

const roles: Array<{ value: UserRole; label: string }> = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'loan_officer', label: 'Loan Officer' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
]

const colorOptions = ['#2563EB', '#16A34A', '#7C3AED', '#F97316', '#DC2626', '#0F766E', '#64748B']

function initials(name = '') {
  const value = name.trim()
  if (!value) return 'U'
  return value.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

function roleLabel(role?: UserRole) {
  return roles.find(item => item.value === role)?.label || 'Staff'
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | boolean | undefined>>) {
  const escape = (value: string | number | boolean | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function profileSettingsScope(user?: { id?: string | number; employeeId?: string; email?: string } | null) {
  const raw = user?.id ?? user?.employeeId ?? user?.email ?? 'current'
  const key = String(raw).toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  return `my-profile-${key}`
}

function resizeProfilePhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read the selected photo'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Unable to prepare the selected photo'))
      image.onload = () => {
        const maxSize = 512
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Unable to resize the selected photo'))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}

export default function Profile() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const { user, updateUser, logout } = useAuthStore()
  const settingsScope = useMemo(() => profileSettingsScope(user), [user?.id, user?.employeeId, user?.email])
  const [tab, setTab] = useState<TabKey>('personal')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<ProfileSettings>(emptySettings)
  const [savedSettings, setSavedSettings] = useState<ProfileSettings>(emptySettings)
  const [account, setAccount] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'staff' as UserRole,
    department: '',
    employeeId: '',
    joinedDate: '',
    twoFactorEnabled: false,
  })

  useEffect(() => {
    setAccount({
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      role: user?.role || 'staff',
      department: user?.department || '',
      employeeId: user?.employeeId || '',
      joinedDate: savedSettings.joinedDate || user?.joinedDate || '',
      twoFactorEnabled: Boolean(user?.twoFactorEnabled),
    })
  }, [user])

  useEffect(() => {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const darkMode = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark)
    document.documentElement.style.setProperty('--profile-primary', settings.primaryColor)
    document.documentElement.classList.toggle('profile-dark-mode', darkMode)
    document.documentElement.classList.toggle('profile-compact-mode', settings.compactMode)
  }, [settings.theme, settings.primaryColor, settings.compactMode])

  useEffect(() => {
    let mounted = true
    settingsApi.get<ProfileSettings>(settingsScope)
      .then(saved => {
        if (!mounted) return
        const merged = { ...emptySettings, ...saved, sessions: saved.sessions || [], activities: saved.activities || [] }
        setSettings(merged)
        setSavedSettings(merged)
        if (merged.joinedDate) setAccount(current => ({ ...current, joinedDate: merged.joinedDate }))
      })
      .catch(() => {
        if (!mounted) return
        setSettings(emptySettings)
        setSavedSettings(emptySettings)
      })
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [settingsScope])

  const completed = useMemo(() => {
    const checks = [
      Boolean(account.fullName && account.email),
      Boolean(account.phone || settings.workEmail),
      Boolean(settings.photoDataUrl || user?.avatar),
      Boolean(account.twoFactorEnabled),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [account, settings.photoDataUrl, settings.workEmail, user?.avatar])

  const updateAccount = <K extends keyof typeof account>(key: K, value: typeof account[K]) => {
    setAccount(current => ({ ...current, [key]: value }))
  }

  const updateSetting = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) => {
    setSettings(current => ({ ...current, [key]: value }))
  }

  const saveProfile = async () => {
    if (!account.fullName.trim() || !account.email.trim()) {
      toast.error('Full name and email are required')
      return
    }
    setSaving(true)
    try {
      const updated = await authApi.updateMe({
        fullName: account.fullName.trim(),
        email: account.email.trim(),
        phone: account.phone,
        employeeId: account.employeeId || user?.employeeId || `EXC${String(user?.id || '').padStart(3, '0')}`,
        role: account.role,
        department: account.department || user?.department || 'General',
      })
      const saved = await settingsApi.save<ProfileSettings>(settingsScope, { ...settings, joinedDate: account.joinedDate })
      const photoDataUrl = saved.photoDataUrl || settings.photoDataUrl || updated.avatar || user?.avatar || ''
      updateUser({ ...updated, avatar: photoDataUrl })
      setSavedSettings(saved)
      setSettings(saved)
      window.dispatchEvent(new CustomEvent('my-profile-updated', { detail: { photoDataUrl, scope: settingsScope } }))
      toast.success('Profile saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save profile')
    } finally {
      setSaving(false)
    }
  }

  const cancelChanges = () => {
    setSettings(savedSettings)
    setAccount({
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      role: user?.role || 'staff',
      department: user?.department || '',
      employeeId: user?.employeeId || '',
      joinedDate: user?.joinedDate || '',
      twoFactorEnabled: Boolean(user?.twoFactorEnabled),
    })
  }

  const handlePhoto = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be 5MB or less')
      return
    }
    try {
      const photoDataUrl = await resizeProfilePhoto(file)
      updateSetting('photoDataUrl', photoDataUrl)
      toast.success('Photo ready. Click Save Changes to apply it.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to prepare photo')
    }
  }

  const logOutAllOtherDevices = async () => {
    const currentOnly = settings.sessions.filter(session => session.current)
    const next = { ...settings, sessions: currentOnly }
    setSettings(next)
    setSavedSettings(await settingsApi.save<ProfileSettings>(settingsScope, next))
    toast.success('Other sessions cleared')
  }

  const removeSession = async (id: string) => {
    const next = { ...settings, sessions: settings.sessions.filter(session => session.id !== id) }
    setSettings(next)
    setSavedSettings(await settingsApi.save<ProfileSettings>(settingsScope, next))
    toast.success('Session removed')
  }

  const exportActivity = () => {
    downloadCsv('profile-activity.csv', ['Title', 'Description', 'Date & Time'], settings.activities.map(row => [row.title, row.description, row.dateTime]))
  }

  const viewMap = () => {
    const query = [settings.addressLine1, settings.addressLine2, settings.city, settings.state, settings.country].filter(Boolean).join(', ')
    if (!query) {
      toast.error('Enter an address first')
      return
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer')
  }

  const resetPreferences = () => {
    setSettings(current => ({
      ...current,
      defaultDashboard: emptySettings.defaultDashboard,
      itemsPerPage: emptySettings.itemsPerPage,
      dateFormat: emptySettings.dateFormat,
      timeFormat: emptySettings.timeFormat,
      theme: emptySettings.theme,
      primaryColor: emptySettings.primaryColor,
      sidebarBehavior: emptySettings.sidebarBehavior,
      compactMode: emptySettings.compactMode,
      emailNotifications: emptySettings.emailNotifications,
      browserNotifications: emptySettings.browserNotifications,
      smsNotifications: emptySettings.smsNotifications,
      systemAnnouncements: emptySettings.systemAnnouncements,
    }))
    toast.success('Preferences reset')
  }

  const setBrowserNotifications = async (enabled: boolean) => {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        toast.error('Browser notifications were blocked by the browser')
        return
      }
    }
    updateSetting('browserNotifications', enabled)
    toast.success(enabled ? 'Browser notifications enabled' : 'Browser notifications disabled')
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const photo = settings.photoDataUrl || user?.avatar

  return (
    <div
      className={`profile-page p-4 lg:p-5 space-y-4 max-w-[1600px] mx-auto ${settings.compactMode ? 'profile-page-compact' : ''}`}
      style={{ '--profile-primary': settings.primaryColor } as CSSProperties & Record<string, string>}
    >
      <div>
        <h2 className="text-xl font-bold text-navy">My Profile</h2>
        <p className="text-sm text-slate-500 mt-1">View and manage your personal information and account preferences.</p>
      </div>

      {loading ? (
        <div className="card p-6 text-sm text-slate-500">Loading profile...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)_340px] gap-4">
          <aside className="space-y-4">
            <ProfileCard
              photo={photo}
              fullName={account.fullName}
              role={roleLabel(account.role)}
              email={account.email}
              phone={account.phone}
              joinedDate={account.joinedDate}
              location={settings.location}
              onPhoto={() => fileRef.current?.click()}
            />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={event => handlePhoto(event.target.files?.[0])} />

            <Panel title="Account Security" sub="Keep your account secure and monitor your security activity.">
              <StatusLine label="Two-Factor Authentication" value={account.twoFactorEnabled ? 'Enabled' : 'Disabled'} good={account.twoFactorEnabled} />
              <StatusLine label="Login Notifications" value={settings.emailNotifications ? 'Enabled' : 'Disabled'} good={settings.emailNotifications} />
              <StatusLine label="Active Sessions" value={`${settings.sessions.length} session${settings.sessions.length === 1 ? '' : 's'}`} good={settings.sessions.length > 0} />
              <button onClick={() => navigate('/settings/password-reset')} className="btn-secondary w-full justify-center mt-3"><Shield size={14} /> Password Reset</button>
            </Panel>

            <Panel title="Profile Menu">
              <SideButton active={tab === 'personal'} icon={<User size={15} />} label="Personal Information" onClick={() => setTab('personal')} />
              <SideButton active={tab === 'contact'} icon={<MapPin size={15} />} label="Contact & Address" onClick={() => setTab('contact')} />
              <SideButton active={tab === 'preferences'} icon={<Settings size={15} />} label="Preferences" onClick={() => setTab('preferences')} />
              <SideButton icon={<LogOut size={15} />} label="Logout" danger onClick={handleLogout} />
            </Panel>
          </aside>

          <main className="space-y-4 min-w-0">
            <div className="card p-4">
              <div className="flex flex-wrap gap-2 border-b border-slate-200">
                <TabButton active={tab === 'personal'} icon={<User size={14} />} label="Personal Information" onClick={() => setTab('personal')} />
                <TabButton active={tab === 'contact'} icon={<MapPin size={14} />} label="Contact & Address" onClick={() => setTab('contact')} />
                <TabButton active={tab === 'preferences'} icon={<Settings size={14} />} label="Preferences" onClick={() => setTab('preferences')} />
              </div>

              {tab === 'personal' && (
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Full Name"><input value={account.fullName} onChange={e => updateAccount('fullName', e.target.value)} className="input-field" /></Field>
                    <Field label="Username"><input value={settings.username} onChange={e => updateSetting('username', e.target.value)} className="input-field" /></Field>
                    <Field label="Email Address"><input value={account.email} onChange={e => updateAccount('email', e.target.value)} type="email" className="input-field" /></Field>
                    <Field label="Phone Number"><input value={account.phone} onChange={e => updateAccount('phone', e.target.value)} className="input-field" /></Field>
                    <Field label="Role"><select value={account.role} onChange={e => updateAccount('role', e.target.value as UserRole)} className="input-field">{roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}</select></Field>
                    <Field label="Department"><input value={account.department} onChange={e => updateAccount('department', e.target.value)} className="input-field" /></Field>
                    <Field label="Employee ID"><input value={account.employeeId} onChange={e => updateAccount('employeeId', e.target.value)} className="input-field" /></Field>
                    <Field label="Joined Date"><input value={account.joinedDate} onChange={e => updateAccount('joinedDate', e.target.value)} type="date" className="input-field" /></Field>
                  </div>
                  <Field label="Bio"><textarea value={settings.bio} onChange={e => updateSetting('bio', e.target.value)} rows={3} className="input-field resize-none" /></Field>
                  <FormActions saving={saving} onSave={saveProfile} onCancel={cancelChanges} />
                </div>
              )}

              {tab === 'contact' && (
                <div className="pt-4 space-y-4">
                  <SectionHeader title="Contact Information" action={<button onClick={() => toast.success('Contact fields are ready for entry')} className="btn-secondary"><Plus size={14} /> Add New Contact</button>} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Primary Email"><input value={account.email} onChange={e => updateAccount('email', e.target.value)} type="email" className="input-field" /></Field>
                    <Field label="Work Email"><input value={settings.workEmail} onChange={e => updateSetting('workEmail', e.target.value)} type="email" className="input-field" /></Field>
                    <Field label="Primary Phone"><input value={account.phone} onChange={e => updateAccount('phone', e.target.value)} className="input-field" /></Field>
                    <Field label="Alternative Phone"><input value={settings.alternatePhone} onChange={e => updateSetting('alternatePhone', e.target.value)} className="input-field" /></Field>
                    <Field label="Emergency Contact"><input value={settings.emergencyContact} onChange={e => updateSetting('emergencyContact', e.target.value)} className="input-field" /></Field>
                    <Field label="Preferred Contact Method"><select value={settings.preferredContactMethod} onChange={e => updateSetting('preferredContactMethod', e.target.value)} className="input-field"><option>Email</option><option>Phone</option><option>SMS</option></select></Field>
                  </div>

                  <SectionHeader title="Address Information" action={<button onClick={() => setSettings(current => ({ ...current, addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '' }))} className="btn-secondary"><Plus size={14} /> Add New Address</button>} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Address Type"><select value={settings.addressType} onChange={e => updateSetting('addressType', e.target.value)} className="input-field"><option>Office Address</option><option>Home Address</option><option>Mailing Address</option></select></Field>
                    <Field label="Address Line 1"><input value={settings.addressLine1} onChange={e => updateSetting('addressLine1', e.target.value)} className="input-field" /></Field>
                    <Field label="Address Line 2"><input value={settings.addressLine2} onChange={e => updateSetting('addressLine2', e.target.value)} className="input-field" /></Field>
                    <Field label="City"><input value={settings.city} onChange={e => updateSetting('city', e.target.value)} className="input-field" /></Field>
                    <Field label="State"><input value={settings.state} onChange={e => updateSetting('state', e.target.value)} className="input-field" /></Field>
                    <Field label="Postal Code"><input value={settings.postalCode} onChange={e => updateSetting('postalCode', e.target.value)} className="input-field" /></Field>
                    <Field label="Country"><input value={settings.country} onChange={e => updateSetting('country', e.target.value)} className="input-field" /></Field>
                    <label className="flex items-center gap-2 text-sm font-semibold text-navy mt-6"><input type="checkbox" checked={settings.mailingAddress} onChange={e => updateSetting('mailingAddress', e.target.checked)} /> This is my mailing address</label>
                  </div>
                  <div className="rounded-lg border border-dashed border-slate-300 p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-slate-600"><MapPin size={15} className="inline mr-1 text-coop-blue" /> View your address on a map</div>
                    <button onClick={viewMap} className="btn-secondary">View on Map</button>
                  </div>
                  <FormActions saving={saving} onSave={saveProfile} onCancel={cancelChanges} />
                </div>
              )}

              {tab === 'preferences' && (
                <div className="pt-4 space-y-5">
                  <SectionHeader title="Account Preferences" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Default Dashboard"><select value={settings.defaultDashboard} onChange={e => updateSetting('defaultDashboard', e.target.value)} className="input-field"><option>Dashboard</option><option>Accounts</option><option>Reports</option></select></Field>
                    <Field label="Items Per Page"><select value={settings.itemsPerPage} onChange={e => updateSetting('itemsPerPage', e.target.value)} className="input-field"><option>10</option><option>25</option><option>50</option><option>100</option></select></Field>
                    <Field label="Date Format"><select value={settings.dateFormat} onChange={e => updateSetting('dateFormat', e.target.value)} className="input-field"><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select></Field>
                    <Field label="Time Format"><div className="flex gap-3 h-10 items-center"><Radio checked={settings.timeFormat === '12'} label="12 Hours" onChange={() => updateSetting('timeFormat', '12')} /><Radio checked={settings.timeFormat === '24'} label="24 Hours" onChange={() => updateSetting('timeFormat', '24')} /></div></Field>
                  </div>

                  <SectionHeader title="Display Preferences" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Theme"><div className="flex gap-2"><Segment active={settings.theme === 'light'} label="Light" onClick={() => updateSetting('theme', 'light')} /><Segment active={settings.theme === 'dark'} label="Dark" onClick={() => updateSetting('theme', 'dark')} /><Segment active={settings.theme === 'system'} label="System" onClick={() => updateSetting('theme', 'system')} /></div></Field>
                    <Field label="Sidebar Behavior"><select value={settings.sidebarBehavior} onChange={e => updateSetting('sidebarBehavior', e.target.value)} className="input-field"><option>Expanded</option><option>Collapsed</option><option>Auto</option></select></Field>
                    <Field label="Primary Color"><div className="flex flex-wrap gap-2">{colorOptions.map(color => <button key={color} type="button" onClick={() => updateSetting('primaryColor', color)} className={`h-7 w-7 rounded-full border-2 ${settings.primaryColor === color ? 'border-navy' : 'border-white'}`} style={{ backgroundColor: color }} />)}</div></Field>
                    <Toggle label="Compact Mode" description="Reduce spacing for a more compact view." checked={settings.compactMode} onChange={value => updateSetting('compactMode', value)} />
                  </div>

                  <SectionHeader title="Notification Preferences" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Toggle label="Email Notifications" description="Receive important updates via email." checked={settings.emailNotifications} onChange={value => updateSetting('emailNotifications', value)} />
                    <Toggle label="Browser Notifications" description="Receive notifications in your browser." checked={settings.browserNotifications} onChange={setBrowserNotifications} />
                    <Toggle label="SMS Notifications" description="Receive critical alerts via SMS." checked={settings.smsNotifications} onChange={value => updateSetting('smsNotifications', value)} />
                    <Toggle label="System Announcements" description="Receive updates about new features and maintenance." checked={settings.systemAnnouncements} onChange={value => updateSetting('systemAnnouncements', value)} />
                  </div>
                  <div className="flex flex-wrap justify-between gap-3">
                    <button onClick={resetPreferences} className="btn-secondary"><RefreshCw size={14} /> Reset to Defaults</button>
                    <FormActions saving={saving} onSave={saveProfile} onCancel={cancelChanges} compact />
                  </div>
                </div>
              )}
            </div>

            <Panel title="Active Sessions" sub="Devices currently recorded for your account.">
              {settings.sessions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr>{['Device', 'Location', 'IP Address', 'Last Active', 'Status', 'Action'].map(header => <th key={header} className="text-left bg-slate-50 px-3 py-2 font-bold text-navy">{header}</th>)}</tr></thead>
                    <tbody>{settings.sessions.map(session => <tr key={session.id} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold">{session.device}</td><td className="px-3 py-2">{session.location || '-'}</td><td className="px-3 py-2">{session.ipAddress || '-'}</td><td className="px-3 py-2">{session.lastActive || '-'}</td><td className="px-3 py-2">{session.current ? <Badge text="Current" tone="green" /> : <Badge text="Active" tone="blue" />}</td><td className="px-3 py-2">{session.current ? '-' : <button onClick={() => removeSession(session.id)} className="text-red-600 font-semibold">Logout</button>}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : <Empty message="No active sessions recorded." />}
              <button onClick={logOutAllOtherDevices} disabled={!settings.sessions.some(session => !session.current)} className="mt-3 text-sm font-semibold text-red-600 disabled:opacity-40"><LogOut size={14} className="inline mr-1" /> Log out from all other devices</button>
            </Panel>
          </main>

          <aside className="space-y-4">
            <Panel title="Profile Completion" sub={`Your profile is ${completed}% complete`}>
              <div className="flex justify-center my-3"><Donut value={completed} label={`${completed}%`} /></div>
              <StatusLine label="Basic Information" value={account.fullName && account.email ? 'Complete' : 'Pending'} good={Boolean(account.fullName && account.email)} />
              <StatusLine label="Contact Information" value={account.phone || settings.workEmail ? 'Complete' : 'Pending'} good={Boolean(account.phone || settings.workEmail)} />
              <StatusLine label="Profile Photo" value={photo ? 'Complete' : 'Pending'} good={Boolean(photo)} />
              <StatusLine label="Two-Factor Authentication" value={account.twoFactorEnabled ? 'Complete' : 'Pending'} good={account.twoFactorEnabled} />
              <button onClick={() => setTab(completed < 50 ? 'personal' : completed < 75 ? 'contact' : 'preferences')} className="btn-secondary w-full justify-center mt-3">Complete Your Profile</button>
            </Panel>

            <Panel title="Recent Account Activity" sub="Latest account actions recorded in your profile.">
              {settings.activities.length ? settings.activities.map(item => (
                <div key={item.id} className="flex gap-3 py-2 border-b border-slate-100 last:border-0">
                  <CheckCircle2 size={18} className="text-green-600 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-navy truncate">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.description || item.dateTime}</div>
                  </div>
                </div>
              )) : <Empty message="No account activity recorded." />}
              <button onClick={exportActivity} disabled={!settings.activities.length} className="mt-2 text-sm font-semibold text-coop-blue disabled:opacity-40"><Download size={14} className="inline mr-1" /> Export Activity</button>
            </Panel>

            <Panel title="Preferences Summary" sub="Overview of current account settings.">
              <MiniRow icon={<Palette size={14} />} label="Theme" value={settings.theme} />
              <MiniRow icon={<Calendar size={14} />} label="Date Format" value={settings.dateFormat} />
              <MiniRow icon={<Clock size={14} />} label="Time Format" value={`${settings.timeFormat} Hours`} />
              <MiniRow icon={<Monitor size={14} />} label="Default Dashboard" value={settings.defaultDashboard} />
              <MiniRow icon={<Mail size={14} />} label="Email Notifications" value={settings.emailNotifications ? 'Enabled' : 'Disabled'} />
              <MiniRow icon={<Bell size={14} />} label="Browser Notifications" value={settings.browserNotifications ? 'Enabled' : 'Disabled'} />
              <MiniRow icon={<Smartphone size={14} />} label="SMS Notifications" value={settings.smsNotifications ? 'Enabled' : 'Disabled'} />
            </Panel>
          </aside>
        </div>
      )}
    </div>
  )
}

function ProfileCard({ photo, fullName, role, email, phone, joinedDate, location, onPhoto }: { photo?: string; fullName: string; role: string; email: string; phone: string; joinedDate: string; location: string; onPhoto: () => void }) {
  return (
    <div className="card overflow-hidden">
      <div className="h-24 bg-gradient-to-br from-blue-50 to-slate-100" />
      <div className="-mt-14 p-4 text-center">
        <button onClick={onPhoto} className="relative mx-auto block group">
          {photo ? <img src={photo} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow" /> : <div className="w-24 h-24 rounded-full border-4 border-white shadow bg-navy text-white flex items-center justify-center text-2xl font-bold">{initials(fullName)}</div>}
          <span className="absolute right-1 bottom-1 h-7 w-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm"><Camera size={14} /></span>
        </button>
        <h3 className="mt-3 text-lg font-bold text-navy">{fullName || 'User'}</h3>
        <p className="text-sm text-slate-500">{role}</p>
      </div>
      <div className="px-4 pb-4 space-y-3 text-sm">
        <Info icon={<Mail size={14} />} value={email || '-'} />
        <Info icon={<Phone size={14} />} value={phone || '-'} />
        <Info icon={<Calendar size={14} />} value={joinedDate || '-'} />
        <Info icon={<MapPin size={14} />} value={location || '-'} />
      </div>
    </div>
  )
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="card p-4"><h3 className="font-bold text-navy">{title}</h3>{sub && <p className="text-xs text-slate-500 mt-1 mb-3">{sub}</p>}<div className={sub ? '' : 'mt-3'}>{children}</div></section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-sm font-semibold text-navy mb-1.5">{label}</span>{children}</label>
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0"><h4 className="font-bold text-navy">{title}</h4>{action}</div>
}

function FormActions({ saving, onSave, onCancel, compact = false }: { saving: boolean; onSave: () => void; onCancel: () => void; compact?: boolean }) {
  return <div className={`flex flex-wrap gap-3 ${compact ? '' : 'pt-2'}`}><button onClick={onCancel} className="btn-secondary">Cancel</button><button onClick={onSave} disabled={saving} className="btn-primary"><Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}</button></div>
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`px-4 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 ${active ? 'border-coop-blue text-coop-blue bg-blue-50/60' : 'border-transparent text-slate-600 hover:text-navy'}`}>{icon}{label}</button>
}

function SideButton({ active, icon, label, danger, onClick }: { active?: boolean; icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold ${active ? 'bg-navy text-white' : danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}>{icon}{label}</button>
}

function Info({ icon, value }: { icon: React.ReactNode; value: string }) {
  return <div className="flex items-center gap-2 text-slate-600">{icon}<span className="truncate">{value}</span></div>
}

function StatusLine({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <div className="flex items-center justify-between gap-3 py-2 text-sm"><span className="flex items-center gap-2 text-navy font-semibold"><CheckCircle2 size={15} className={good ? 'text-green-600' : 'text-slate-300'} />{label}</span><span className={good ? 'text-green-700' : 'text-slate-500'}>{value}</span></div>
}

function MiniRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0 text-sm"><span className="flex items-center gap-2 text-slate-600">{icon}{label}</span><span className="font-semibold text-navy capitalize">{value}</span></div>
}

function Badge({ text, tone }: { text: string; tone: 'green' | 'blue' }) {
  const cls = tone === 'green' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{text}</span>
}

function Donut({ value, label }: { value: number; label: string }) {
  return <div className="relative h-28 w-28 rounded-full" style={{ background: `conic-gradient(#16A34A ${value * 3.6}deg, #E2E8F0 0deg)` }}><div className="absolute inset-3 rounded-full bg-white flex items-center justify-center text-lg font-bold text-navy">{label}</div></div>
}

function Empty({ message }: { message: string }) {
  return <div className="py-8 text-center text-sm text-slate-400">{message}</div>
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
      <div><div className="text-sm font-bold text-navy">{label}</div><div className="text-xs text-slate-500">{description}</div></div>
      <button type="button" onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? 'bg-coop-blue' : 'bg-slate-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} /></button>
    </div>
  )
}

function Radio({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <button type="button" onClick={onChange} className="flex items-center gap-2 text-sm font-semibold text-navy"><span className={`h-4 w-4 rounded-full border ${checked ? 'border-coop-blue ring-4 ring-blue-100 bg-coop-blue' : 'border-slate-300'}`} />{label}</button>
}

function Segment({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`px-3 py-2 rounded-lg border text-sm font-semibold ${active ? 'border-coop-blue text-coop-blue bg-blue-50' : 'border-slate-200 text-slate-600'}`}>{label}</button>
}
