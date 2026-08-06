import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  Bell,
  CheckCircle,
  Download,
  Edit,
  FileText,
  HelpCircle,
  Mail,
  MessageSquare,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import { settingsApi } from '../../services/api'

type NotificationTab = 'Notification Preferences' | 'Email Templates' | 'In-App Notifications' | 'SMS Settings' | 'Alert Rules'
type DeliveryChannel = 'inApp' | 'email' | 'sms'
type Status = 'Active' | 'Inactive' | 'Paused'

type NotificationCategory = {
  id: number
  name: string
  description: string
  inApp: boolean
  email: boolean
  sms: boolean
}

type NotificationTemplate = {
  id: number
  name: string
  module: string
  trigger: string
  audience: string
  subject: string
  message: string
  status: Status
  updatedAt: string
}

type AlertRule = {
  id: number
  name: string
  category: string
  condition: string
  channels: DeliveryChannel[]
  frequency: string
  status: Status
  updatedAt: string
}

type NotificationLog = {
  id: number
  title: string
  recipient: string
  channel: string
  status: 'Sent' | 'Failed'
  sentAt: string
}

type NotificationSettingsState = {
  inAppEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
  dailySummaryEmail: boolean
  weeklySummaryEmail: boolean
  summaryTime: string
  summaryDay: string
  quietHoursEnabled: boolean
  quietStart: string
  quietEnd: string
  timeZone: string
  smsProvider: string
  smsSenderId: string
  smsApiKey: string
  autoDismissSeconds: string
  soundAlert: boolean
  groupSimilar: boolean
  markReadOnClick: boolean
  retentionPeriod: string
  dashboardBell: boolean
  notificationCenter: boolean
  realtimePopup: boolean
  unreadBadge: boolean
  categories: NotificationCategory[]
  templates: NotificationTemplate[]
  rules: AlertRule[]
  logs: NotificationLog[]
}

const tabs: NotificationTab[] = ['Notification Preferences', 'Email Templates', 'In-App Notifications', 'SMS Settings', 'Alert Rules']

const emptySettings: NotificationSettingsState = {
  inAppEnabled: false,
  emailEnabled: false,
  smsEnabled: false,
  dailySummaryEmail: false,
  weeklySummaryEmail: false,
  summaryTime: '',
  summaryDay: '',
  quietHoursEnabled: false,
  quietStart: '',
  quietEnd: '',
  timeZone: '',
  smsProvider: '',
  smsSenderId: '',
  smsApiKey: '',
  autoDismissSeconds: '',
  soundAlert: false,
  groupSimilar: false,
  markReadOnClick: false,
  retentionPeriod: '',
  dashboardBell: false,
  notificationCenter: false,
  realtimePopup: false,
  unreadBadge: false,
  categories: [],
  templates: [],
  rules: [],
  logs: [],
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
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? 'bg-coop-blue' : 'bg-slate-300'}`}>
      <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
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
        <div className="mt-1 text-[11px] text-slate-400">{checked ? 'Enabled' : 'Disabled'}</div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value, sub, tone = 'blue' }: { icon: ReactNode; label: string; value: string; sub?: string; tone?: 'blue' | 'green' | 'orange' | 'purple' | 'red' }) {
  const tones = { blue: 'bg-blue-50 text-coop-blue', green: 'bg-green-50 text-coop-green', orange: 'bg-orange-50 text-orange-500', purple: 'bg-purple-50 text-purple-600', red: 'bg-red-50 text-red-600' }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
        <span>
          <span className="block text-xs font-semibold text-slate-500">{label}</span>
          <span className="block text-xl font-bold text-navy">{value}</span>
          {sub && <span className="block text-xs text-slate-500">{sub}</span>}
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  const color = value === 'Active' || value === 'Sent' ? 'bg-green-100 text-green-700' : value === 'Paused' ? 'bg-orange-100 text-orange-700' : value === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
  return <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${color}`}>{value}</span>
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{message}</div>
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-bold text-coop-blue hover:bg-blue-50">{children}</button>
}

function todayStamp() {
  return new Date().toLocaleString()
}

function downloadText(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function csv(rows: Record<string, string | number | boolean>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [headers, ...rows.map(row => headers.map(header => row[header]))].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Notifications() {
  const importTemplatesRef = useRef<HTMLInputElement>(null)
  const importRulesRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<NotificationTab>('Notification Preferences')
  const [settings, setSettings] = useState<NotificationSettingsState>(emptySettings)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingCategory, setEditingCategory] = useState<NotificationCategory | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)

  const activeTemplates = settings.templates.filter(item => item.status === 'Active').length
  const activeRules = settings.rules.filter(item => item.status === 'Active').length
  const pausedRules = settings.rules.filter(item => item.status === 'Paused').length
  const disabledRules = settings.rules.filter(item => item.status === 'Inactive').length
  const filteredTemplates = settings.templates.filter(item => `${item.name} ${item.module} ${item.trigger}`.toLowerCase().includes(search.toLowerCase()))
  const filteredRules = settings.rules.filter(item => `${item.name} ${item.category} ${item.condition}`.toLowerCase().includes(search.toLowerCase()))
  const recentLogs = settings.logs.slice(0, 6)
  const ruleCategories = Object.entries(settings.rules.reduce<Record<string, number>>((items, item) => ({ ...items, [item.category]: (items[item.category] || 0) + 1 }), {})).map(([name, count]) => [name, String(count), `${((count / Math.max(settings.rules.length, 1)) * 100).toFixed(1)}%`])

  useEffect(() => {
    settingsApi.get<NotificationSettingsState>('notifications')
      .then(saved => setSettings({
        ...emptySettings,
        ...saved,
        categories: saved.categories || [],
        templates: saved.templates || [],
        rules: saved.rules || [],
        logs: saved.logs || [],
      }))
      .catch(() => toast.error('Could not load notification settings'))
  }, [])

  const update = <K extends keyof NotificationSettingsState>(key: K, value: NotificationSettingsState[K]) => setSettings(prev => ({ ...prev, [key]: value }))

  const saveSettings = async (next = settings) => {
    try {
      setSaving(true)
      const saved = await settingsApi.save<NotificationSettingsState>('notifications', next)
      setSettings({ ...emptySettings, ...saved, categories: saved.categories || [], templates: saved.templates || [], rules: saved.rules || [], logs: saved.logs || [] })
      toast.success('Notification settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save notification settings')
    } finally {
      setSaving(false)
    }
  }

  const resetSettings = async () => {
    setSettings(emptySettings)
    await saveSettings(emptySettings)
  }

  const testNotification = async () => {
    const nextLog: NotificationLog = { id: Date.now(), title: 'Test notification', recipient: 'Current user', channel: activeTab, status: 'Sent', sentAt: todayStamp() }
    const next = { ...settings, logs: [nextLog, ...settings.logs] }
    setSettings(next)
    await saveSettings(next)
    toast.success('Test notification recorded')
  }

  const saveCategory = async (row: NotificationCategory) => {
    const exists = settings.categories.some(item => item.id === row.id)
    const next = { ...settings, categories: exists ? settings.categories.map(item => item.id === row.id ? row : item) : [row, ...settings.categories] }
    setEditingCategory(null)
    await saveSettings(next)
  }

  const saveTemplate = async (row: NotificationTemplate) => {
    const exists = settings.templates.some(item => item.id === row.id)
    const next = { ...settings, templates: exists ? settings.templates.map(item => item.id === row.id ? { ...row, updatedAt: todayStamp() } : item) : [{ ...row, updatedAt: todayStamp() }, ...settings.templates] }
    setEditingTemplate(null)
    await saveSettings(next)
  }

  const saveRule = async (row: AlertRule) => {
    const exists = settings.rules.some(item => item.id === row.id)
    const next = { ...settings, rules: exists ? settings.rules.map(item => item.id === row.id ? { ...row, updatedAt: todayStamp() } : item) : [{ ...row, updatedAt: todayStamp() }, ...settings.rules] }
    setEditingRule(null)
    await saveSettings(next)
  }

  const removeTemplate = async (id: number) => {
    await saveSettings({ ...settings, templates: settings.templates.filter(item => item.id !== id) })
  }

  const removeRule = async (id: number) => {
    await saveSettings({ ...settings, rules: settings.rules.filter(item => item.id !== id) })
  }

  const exportRows = (kind: 'templates' | 'rules' | 'logs') => {
    const rows = kind === 'templates' ? settings.templates : kind === 'rules' ? settings.rules.map(rule => ({ ...rule, channels: rule.channels.join('|') })) : settings.logs
    downloadText(`notifications-${kind}.csv`, csv(rows as unknown as Record<string, string | number | boolean>[]), 'text/csv')
    toast.success(`${kind} exported`)
  }

  const importRows = async (event: ChangeEvent<HTMLInputElement>, kind: 'templates' | 'rules') => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean)
    const headers = headerLine.split(',').map(item => item.replace(/^"|"$/g, '').trim())
    if (kind === 'templates') {
      const imported = lines.map((line, index) => {
        const values = line.split(',').map(item => item.replace(/^"|"$/g, '').trim())
        const row = Object.fromEntries(headers.map((header, i) => [header, values[i] || '']))
        return {
          id: Date.now() + index,
          name: String(row.name || row.Name || ''),
          module: String(row.module || row.Module || ''),
          trigger: String(row.trigger || row.Trigger || ''),
          audience: String(row.audience || row.Audience || ''),
          subject: String(row.subject || row.Subject || ''),
          message: String(row.message || row.Message || ''),
          status: 'Active' as Status,
          updatedAt: todayStamp(),
        }
      }).filter(row => row.name)
      await saveSettings({ ...settings, templates: [...imported, ...settings.templates] })
    } else {
      const imported = lines.map((line, index) => {
        const values = line.split(',').map(item => item.replace(/^"|"$/g, '').trim())
        const row = Object.fromEntries(headers.map((header, i) => [header, values[i] || '']))
        return {
          id: Date.now() + index,
          name: String(row.name || row.Name || ''),
          category: String(row.category || row.Category || ''),
          condition: String(row.condition || row.Condition || ''),
          channels: String(row.channels || row.Channels || '').split('|').filter(Boolean) as DeliveryChannel[],
          frequency: String(row.frequency || row.Frequency || ''),
          status: 'Active' as Status,
          updatedAt: todayStamp(),
        }
      }).filter(row => row.name)
      await saveSettings({ ...settings, rules: [...imported, ...settings.rules] })
    }
  }

  const createTemplate = () => setEditingTemplate({ id: Date.now(), name: '', module: '', trigger: '', audience: '', subject: '', message: '', status: 'Active', updatedAt: '' })
  const createRule = () => setEditingRule({ id: Date.now(), name: '', category: '', condition: '', channels: [], frequency: '', status: 'Active', updatedAt: '' })

  return (
    <div className="space-y-4 p-3 md:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Notifications</h2>
          <p className="text-sm text-slate-500">Configure how and when system notifications are delivered to users.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={testNotification} className="btn-secondary"><Send size={14} /> {activeTab === 'Alert Rules' ? 'Test Rule' : 'Test Notification'}</button>
          <button onClick={() => saveSettings()} disabled={saving} className="btn-primary bg-coop-blue"><Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-slate-200 bg-white px-3">
        {tabs.map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`border-b-2 px-3 py-3 text-xs font-bold ${activeTab === tab ? 'border-coop-blue text-coop-blue' : 'border-transparent text-navy hover:text-coop-blue'}`}>{tab}</button>)}
      </div>

      {activeTab === 'Notification Preferences' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title="Notification Channels" sub="Choose which channels to enable for notifications.">
              <ToggleRow icon={<MessageSquare size={18} />} title="In-App Notifications" sub="Receive notifications within the system." checked={settings.inAppEnabled} onChange={value => update('inAppEnabled', value)} />
              <ToggleRow icon={<Mail size={18} />} title="Email Notifications" sub="Receive notifications via email." checked={settings.emailEnabled} onChange={value => update('emailEnabled', value)} />
              <ToggleRow icon={<MessageSquare size={18} />} title="SMS Notifications" sub="Receive important alerts via SMS." checked={settings.smsEnabled} onChange={value => update('smsEnabled', value)} />
            </Card>
            <Card title="Email Summary" sub="Configure email digest and summary preferences.">
              <div className="space-y-3">
                <ToggleRow icon={<Mail size={18} />} title="Daily Summary Email" sub="Receive a summary once daily." checked={settings.dailySummaryEmail} onChange={value => update('dailySummaryEmail', value)} />
                <ToggleRow icon={<Mail size={18} />} title="Weekly Summary Email" sub="Receive a summary once weekly." checked={settings.weeklySummaryEmail} onChange={value => update('weeklySummaryEmail', value)} />
                <Field label="Summary Time"><input type="time" value={settings.summaryTime} onChange={e => update('summaryTime', e.target.value)} className="input-field" /></Field>
                <Field label="Summary Day"><select value={settings.summaryDay} onChange={e => update('summaryDay', e.target.value)} className="input-field"><option value="">Select day</option>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => <option key={day}>{day}</option>)}</select></Field>
              </div>
            </Card>
            <Card title="Quiet Hours" sub="Set time period when non-urgent notifications are muted.">
              <div className="space-y-3">
                <ToggleRow icon={<Bell size={18} />} title="Enable Quiet Hours" sub="Pause non-urgent notifications during this time." checked={settings.quietHoursEnabled} onChange={value => update('quietHoursEnabled', value)} />
                <Field label="Start Time"><input type="time" value={settings.quietStart} onChange={e => update('quietStart', e.target.value)} className="input-field" /></Field>
                <Field label="End Time"><input type="time" value={settings.quietEnd} onChange={e => update('quietEnd', e.target.value)} className="input-field" /></Field>
                <Field label="Time Zone"><input value={settings.timeZone} onChange={e => update('timeZone', e.target.value)} placeholder="Enter time zone" className="input-field" /></Field>
              </div>
            </Card>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
            <Card title="Notification Categories" sub="Choose which events users should be notified about." action={<button onClick={() => setEditingCategory({ id: Date.now(), name: '', description: '', inApp: false, email: false, sms: false })} className="btn-secondary"><Plus size={14} /> Add Category</button>}>
              <CategoryTable rows={settings.categories} onEdit={setEditingCategory} onToggle={(row, channel) => saveCategory({ ...row, [channel]: !row[channel] })} />
              <button onClick={resetSettings} className="mt-3 btn-secondary"><RefreshCw size={14} /> Reset to Empty</button>
            </Card>
            <Card title="Recent Notifications" sub="Latest system notifications sent." action={<button onClick={() => exportRows('logs')} className="text-xs font-bold text-coop-blue">Export</button>}>
              {recentLogs.length ? <LogList rows={recentLogs} /> : <EmptyState message="No notifications have been sent yet." />}
            </Card>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-navy"><HelpCircle size={17} className="mr-2 inline text-coop-blue" />Configure notification settings before sending live alerts to users.</div>
        </div>
      )}

      {activeTab === 'Email Templates' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <div className="space-y-4">
            <Card title="Email Templates Overview" sub="Create and manage email templates for notification messages.">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Stat icon={<Mail size={20} />} label="Total Templates" value={String(settings.templates.length)} sub="All email templates" />
                <Stat icon={<CheckCircle size={20} />} label="Active Templates" value={String(activeTemplates)} sub="Currently active" tone="green" />
                <Stat icon={<PauseCircle size={20} />} label="Paused Templates" value={String(settings.templates.filter(item => item.status === 'Paused').length)} sub="Temporarily paused" tone="orange" />
                <Stat icon={<XCircle size={20} />} label="Inactive Templates" value={String(settings.templates.filter(item => item.status === 'Inactive').length)} sub="Disabled templates" tone="red" />
              </div>
            </Card>
            <TemplateTable rows={filteredTemplates} search={search} onSearch={setSearch} onEdit={setEditingTemplate} onToggle={row => saveTemplate({ ...row, status: row.status === 'Active' ? 'Inactive' : 'Active' })} onDelete={removeTemplate} onCreate={createTemplate} />
          </div>
          <SideActions actions={[['Create New Template', createTemplate], ['Import Templates', () => importTemplatesRef.current?.click()], ['Export Templates', () => exportRows('templates')], ['Template Guide', () => downloadText('notification-template-guide.txt', 'Create templates with a clear subject, recipient audience and message body.')]]} />
          <input ref={importTemplatesRef} type="file" accept=".csv" className="hidden" onChange={event => importRows(event, 'templates')} />
        </div>
      )}

      {activeTab === 'In-App Notifications' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="space-y-4">
            <Card title="In-App Notifications Overview" sub="Manage notifications that appear inside the application for users.">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Stat icon={<Bell size={20} />} label="Total Templates" value={String(settings.templates.length)} sub="All notification templates" />
                <Stat icon={<CheckCircle size={20} />} label="Active Templates" value={String(activeTemplates)} sub="Currently active" tone="green" />
                <Stat icon={<PauseCircle size={20} />} label="Scheduled" value="0" sub="Scheduled to send" tone="orange" />
                <Stat icon={<MessageSquare size={20} />} label="Read Rate (30 Days)" value="0%" sub="No engagement data yet" tone="purple" />
              </div>
            </Card>
            <TemplateTable rows={filteredTemplates} search={search} onSearch={setSearch} onEdit={setEditingTemplate} onToggle={row => saveTemplate({ ...row, status: row.status === 'Active' ? 'Inactive' : 'Active' })} onDelete={removeTemplate} onCreate={createTemplate} />
            <Card title="Template Settings" sub="Configure the default behavior for in-app notifications.">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Field label="Auto Dismiss"><input value={settings.autoDismissSeconds} onChange={e => update('autoDismissSeconds', e.target.value)} placeholder="Seconds" className="input-field" /></Field>
                <ToggleRow icon={<Bell size={16} />} title="Sound Alert" sub="Play a sound when new notifications arrive." checked={settings.soundAlert} onChange={value => update('soundAlert', value)} />
                <ToggleRow icon={<MessageSquare size={16} />} title="Group Similar Notifications" sub="Group similar notifications." checked={settings.groupSimilar} onChange={value => update('groupSimilar', value)} />
                <ToggleRow icon={<CheckCircle size={16} />} title="Mark as Read on Click" sub="Mark clicked notifications as read." checked={settings.markReadOnClick} onChange={value => update('markReadOnClick', value)} />
                <Field label="Retention Period"><input value={settings.retentionPeriod} onChange={e => update('retentionPeriod', e.target.value)} placeholder="Days" className="input-field" /></Field>
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            <Card title="Notification Channels" sub="Choose where in-app notifications will be shown.">
              <div className="space-y-3">
                <ToggleRow icon={<Bell size={16} />} title="Dashboard Bell" sub="Show in the top navigation bell." checked={settings.dashboardBell} onChange={value => update('dashboardBell', value)} />
                <ToggleRow icon={<MessageSquare size={16} />} title="Notification Center" sub="Show in the full notification center." checked={settings.notificationCenter} onChange={value => update('notificationCenter', value)} />
                <ToggleRow icon={<Send size={16} />} title="Real-time Pop-up" sub="Show as pop-up messages." checked={settings.realtimePopup} onChange={value => update('realtimePopup', value)} />
                <ToggleRow icon={<Bell size={16} />} title="Unread Badge" sub="Show unread count on menu items." checked={settings.unreadBadge} onChange={value => update('unreadBadge', value)} />
              </div>
            </Card>
            <Card title="Preview" sub="Preview appears after sending a test notification.">
              {recentLogs.length ? <LogList rows={recentLogs.slice(0, 3)} /> : <EmptyState message="No preview notifications yet." />}
            </Card>
            <Card title="Need Help?"><p className="text-xs text-slate-500">Use templates and rules to control when users receive in-app alerts.</p><button onClick={() => downloadText('in-app-notification-guide.txt', 'In-app notification guide')} className="mt-3 btn-secondary"><FileText size={14} /> View User Guide</button></Card>
          </div>
        </div>
      )}

      {activeTab === 'SMS Settings' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="space-y-4">
            <Card title="SMS Settings" sub="Configure SMS provider and sender details.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="SMS Provider"><input value={settings.smsProvider} onChange={e => update('smsProvider', e.target.value)} placeholder="Enter SMS provider" className="input-field" /></Field>
                <Field label="Sender ID"><input value={settings.smsSenderId} onChange={e => update('smsSenderId', e.target.value)} placeholder="Enter sender ID" className="input-field" /></Field>
                <Field label="API Key"><input value={settings.smsApiKey} onChange={e => update('smsApiKey', e.target.value)} placeholder="Enter API key" className="input-field" /></Field>
                <div className="flex items-end"><ToggleRow icon={<MessageSquare size={18} />} title="Enable SMS Notifications" sub="Allow SMS notification delivery." checked={settings.smsEnabled} onChange={value => update('smsEnabled', value)} /></div>
              </div>
            </Card>
            <Card title="SMS Delivery History" sub="SMS records sent from the system.">
              {settings.logs.filter(log => log.channel.includes('SMS')).length ? <LogList rows={settings.logs.filter(log => log.channel.includes('SMS'))} /> : <EmptyState message="No SMS notifications sent yet." />}
            </Card>
          </div>
          <SideActions actions={[['Send Test SMS', testNotification], ['Export SMS Logs', () => exportRows('logs')], ['SMS Setup Guide', () => downloadText('sms-setup-guide.txt', 'Configure provider, sender ID and API key before enabling SMS delivery.')]]} />
        </div>
      )}

      {activeTab === 'Alert Rules' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="space-y-4">
            <Card title="Alert Rules Overview" sub="Create and manage rules that trigger notifications based on specific conditions.">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Stat icon={<FileText size={20} />} label="Total Rules" value={String(settings.rules.length)} sub="All alert rules" tone="purple" />
                <Stat icon={<CheckCircle size={20} />} label="Active Rules" value={String(activeRules)} sub="Currently active" tone="green" />
                <Stat icon={<PauseCircle size={20} />} label="Paused Rules" value={String(pausedRules)} sub="Temporarily paused" tone="orange" />
                <Stat icon={<XCircle size={20} />} label="Disabled Rules" value={String(disabledRules)} sub="Disabled rules" tone="red" />
              </div>
            </Card>
            <RuleTable rows={filteredRules} search={search} onSearch={setSearch} onEdit={setEditingRule} onToggle={row => saveRule({ ...row, status: row.status === 'Active' ? 'Paused' : 'Active' })} onDelete={removeRule} onCreate={createRule} />
            <Card title="Create New Alert Rule" sub="Follow these steps to set up a new alert rule.">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs text-navy">
                {['Select Category', 'Define Condition', 'Choose Channels', 'Set Frequency', 'Review & Save'].map((step, index) => <div key={step} className="rounded-lg border border-slate-200 p-3"><div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-coop-blue font-bold text-coop-blue">{index + 1}</div><div className="font-bold">{step}</div></div>)}
              </div>
            </Card>
          </div>
          <div className="space-y-4">
            <SideActions actions={[['Add New Rule', createRule], ['Enable All Rules', () => saveSettings({ ...settings, rules: settings.rules.map(rule => ({ ...rule, status: 'Active' as Status })) })], ['Disable All Rules', () => saveSettings({ ...settings, rules: settings.rules.map(rule => ({ ...rule, status: 'Inactive' as Status })) })], ['Import Rules', () => importRulesRef.current?.click()], ['Export Rules', () => exportRows('rules')]]} />
            <Card title="About Alert Rules"><p className="text-xs text-slate-500">Alert rules help you automate notifications based on important events and thresholds.</p></Card>
            <Card title="Rule Categories">{ruleCategories.length ? <MiniRows rows={ruleCategories} /> : <EmptyState message="No rule categories yet." />}</Card>
          </div>
          <input ref={importRulesRef} type="file" accept=".csv" className="hidden" onChange={event => importRows(event, 'rules')} />
        </div>
      )}

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">&copy; {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.</footer>

      {editingCategory && <CategoryModal data={editingCategory} onClose={() => setEditingCategory(null)} onSave={saveCategory} />}
      {editingTemplate && <TemplateModal data={editingTemplate} onClose={() => setEditingTemplate(null)} onSave={saveTemplate} />}
      {editingRule && <RuleModal data={editingRule} onClose={() => setEditingRule(null)} onSave={saveRule} />}
    </div>
  )
}

function CategoryTable({ rows, onEdit, onToggle }: { rows: NotificationCategory[]; onEdit: (row: NotificationCategory) => void; onToggle: (row: NotificationCategory, channel: DeliveryChannel) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr>{['Category', 'Description', 'In-App', 'Email', 'SMS', 'Action'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{row.name}</td><td className="px-3 py-2 text-slate-500">{row.description}</td>{(['inApp', 'email', 'sms'] as DeliveryChannel[]).map(channel => <td key={channel} className="px-3 py-2"><input type="checkbox" checked={row[channel]} onChange={() => onToggle(row, channel)} /></td>)}<td className="px-3 py-2"><button onClick={() => onEdit(row)} className="rounded-md border border-slate-200 p-1.5 text-coop-blue"><Edit size={13} /></button></td></tr>) : <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No notification categories configured.</td></tr>}</tbody>
      </table>
    </div>
  )
}

function TemplateTable({ rows, search, onSearch, onEdit, onToggle, onDelete, onCreate }: { rows: NotificationTemplate[]; search: string; onSearch: (value: string) => void; onEdit: (row: NotificationTemplate) => void; onToggle: (row: NotificationTemplate) => void; onDelete: (id: number) => void; onCreate: () => void }) {
  return (
    <Card title="Notification Templates" sub="Create, edit and manage notification templates." action={<div className="flex gap-2"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search templates..." className="input-field pl-9" /></div><button onClick={onCreate} className="btn-secondary"><Plus size={14} /> Create New Template</button></div>}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>{['Template Name', 'Module', 'Trigger / Event', 'Audience', 'Status', 'Last Updated', 'Actions'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead>
          <tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{row.name}</td><td className="px-3 py-2">{row.module}</td><td className="px-3 py-2">{row.trigger}</td><td className="px-3 py-2">{row.audience}</td><td className="px-3 py-2"><StatusBadge value={row.status} /></td><td className="px-3 py-2">{row.updatedAt || '-'}</td><td className="px-3 py-2"><RowActions onEdit={() => onEdit(row)} onToggle={() => onToggle(row)} onDelete={() => onDelete(row.id)} /></td></tr>) : <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No notification templates configured.</td></tr>}</tbody>
        </table>
      </div>
    </Card>
  )
}

function RuleTable({ rows, search, onSearch, onEdit, onToggle, onDelete, onCreate }: { rows: AlertRule[]; search: string; onSearch: (value: string) => void; onEdit: (row: AlertRule) => void; onToggle: (row: AlertRule) => void; onDelete: (id: number) => void; onCreate: () => void }) {
  return (
    <Card title="Alert Rules" action={<div className="flex gap-2"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search rules..." className="input-field pl-9" /></div><button onClick={onCreate} className="btn-secondary"><Plus size={14} /> Add New Rule</button></div>}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>{['Rule Name', 'Category', 'Condition', 'Channel(s)', 'Frequency', 'Status', 'Last Modified', 'Actions'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead>
          <tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-navy">{row.name}</td><td className="px-3 py-2">{row.category}</td><td className="px-3 py-2">{row.condition}</td><td className="px-3 py-2">{row.channels.join(', ') || '-'}</td><td className="px-3 py-2">{row.frequency}</td><td className="px-3 py-2"><StatusBadge value={row.status} /></td><td className="px-3 py-2">{row.updatedAt || '-'}</td><td className="px-3 py-2"><RowActions onEdit={() => onEdit(row)} onToggle={() => onToggle(row)} onDelete={() => onDelete(row.id)} /></td></tr>) : <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No alert rules configured.</td></tr>}</tbody>
        </table>
      </div>
    </Card>
  )
}

function RowActions({ onEdit, onToggle, onDelete }: { onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return <div className="flex gap-2"><button onClick={onEdit} className="rounded-md border border-slate-200 p-1.5 text-coop-blue hover:bg-blue-50"><Edit size={13} /></button><button onClick={onToggle} className="rounded-md border border-slate-200 p-1.5 text-navy hover:bg-slate-50"><MoreVertical size={13} /></button><button onClick={onDelete} className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={13} /></button></div>
}

function LogList({ rows }: { rows: NotificationLog[] }) {
  return <div className="divide-y divide-slate-100">{rows.map(row => <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-xs"><div><div className="font-bold text-navy">{row.title}</div><div className="text-slate-500">To: {row.recipient}</div></div><div className="text-right"><div className="text-slate-500">{row.sentAt}</div><StatusBadge value={row.status} /></div></div>)}</div>
}

function MiniRows({ rows }: { rows: string[][] }) {
  return <div className="divide-y divide-slate-100">{rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_auto_auto] gap-3 py-2 text-xs"><span className="font-semibold text-navy">{row[0]}</span><span className="text-navy">{row[1]}</span>{row[2] && <span className="font-bold text-navy">{row[2]}</span>}</div>)}</div>
}

function SideActions({ actions }: { actions: [string, () => void][] }) {
  return (
    <div className="space-y-4">
      <Card title="Quick Actions"><div className="space-y-2">{actions.map(([label, action]) => <ActionButton key={label} onClick={action}>{label.includes('Import') ? <Upload size={14} /> : label.includes('Export') ? <Download size={14} /> : label.includes('Disable') ? <XCircle size={14} /> : label.includes('Enable') ? <PlayCircle size={14} /> : <Plus size={14} />} {label}</ActionButton>)}</div></Card>
      <Card title="Help & Guidance"><p className="text-xs text-slate-500">Use this section to configure notification records and delivery behavior.</p></Card>
    </div>
  )
}

function CategoryModal({ data, onSave, onClose }: { data: NotificationCategory; onSave: (row: NotificationCategory) => void; onClose: () => void }) {
  const [row, setRow] = useState(data)
  return <Modal title="Notification Category" onClose={onClose} onSave={() => onSave(row)}><Field label="Category Name"><input value={row.name} onChange={e => setRow({ ...row, name: e.target.value })} className="input-field" /></Field><Field label="Description"><input value={row.description} onChange={e => setRow({ ...row, description: e.target.value })} className="input-field" /></Field><ToggleRow icon={<Bell size={16} />} title="In-App" sub="Deliver in-app notifications." checked={row.inApp} onChange={value => setRow({ ...row, inApp: value })} /><ToggleRow icon={<Mail size={16} />} title="Email" sub="Deliver email notifications." checked={row.email} onChange={value => setRow({ ...row, email: value })} /><ToggleRow icon={<MessageSquare size={16} />} title="SMS" sub="Deliver SMS notifications." checked={row.sms} onChange={value => setRow({ ...row, sms: value })} /></Modal>
}

function TemplateModal({ data, onSave, onClose }: { data: NotificationTemplate; onSave: (row: NotificationTemplate) => void; onClose: () => void }) {
  const [row, setRow] = useState(data)
  return <Modal title="Notification Template" onClose={onClose} onSave={() => onSave(row)}><Field label="Template Name"><input value={row.name} onChange={e => setRow({ ...row, name: e.target.value })} className="input-field" /></Field><Field label="Module"><input value={row.module} onChange={e => setRow({ ...row, module: e.target.value })} className="input-field" /></Field><Field label="Trigger / Event"><input value={row.trigger} onChange={e => setRow({ ...row, trigger: e.target.value })} className="input-field" /></Field><Field label="Audience"><input value={row.audience} onChange={e => setRow({ ...row, audience: e.target.value })} className="input-field" /></Field><Field label="Subject"><input value={row.subject} onChange={e => setRow({ ...row, subject: e.target.value })} className="input-field" /></Field><Field label="Status"><select value={row.status} onChange={e => setRow({ ...row, status: e.target.value as Status })} className="input-field"><option>Active</option><option>Inactive</option><option>Paused</option></select></Field><label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold text-navy">Message</span><textarea value={row.message} onChange={e => setRow({ ...row, message: e.target.value })} className="input-field min-h-28" /></label></Modal>
}

function RuleModal({ data, onSave, onClose }: { data: AlertRule; onSave: (row: AlertRule) => void; onClose: () => void }) {
  const [row, setRow] = useState(data)
  const toggleChannel = (channel: DeliveryChannel) => setRow(prev => ({ ...prev, channels: prev.channels.includes(channel) ? prev.channels.filter(item => item !== channel) : [...prev.channels, channel] }))
  return <Modal title="Alert Rule" onClose={onClose} onSave={() => onSave(row)}><Field label="Rule Name"><input value={row.name} onChange={e => setRow({ ...row, name: e.target.value })} className="input-field" /></Field><Field label="Category"><input value={row.category} onChange={e => setRow({ ...row, category: e.target.value })} className="input-field" /></Field><Field label="Condition"><input value={row.condition} onChange={e => setRow({ ...row, condition: e.target.value })} className="input-field" /></Field><Field label="Frequency"><input value={row.frequency} onChange={e => setRow({ ...row, frequency: e.target.value })} className="input-field" /></Field><Field label="Status"><select value={row.status} onChange={e => setRow({ ...row, status: e.target.value as Status })} className="input-field"><option>Active</option><option>Inactive</option><option>Paused</option></select></Field><div><span className="mb-1 block text-xs font-semibold text-navy">Channels</span><div className="flex flex-wrap gap-2 text-xs">{(['inApp', 'email', 'sms'] as DeliveryChannel[]).map(channel => <label key={channel} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2"><input type="checkbox" checked={row.channels.includes(channel)} onChange={() => toggleChannel(channel)} />{channel}</label>)}</div></div></Modal>
}

function Modal({ title, children, onClose, onSave }: { title: string; children: ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6">
        <h3 className="text-lg font-bold text-navy">{title}</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
        <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={onClose} className="btn-secondary justify-center">Cancel</button><button onClick={onSave} className="btn-primary bg-coop-blue justify-center"><Save size={14} /> Save</button></div>
      </div>
    </div>
  )
}
