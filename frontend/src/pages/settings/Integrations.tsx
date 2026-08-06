import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  HelpCircle,
  KeyRound,
  Link2,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Webhook,
  XCircle,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { settingsApi } from '../../services/api'

type IntegrationTab = 'Overview' | 'Connected' | 'Available' | 'Webhook Logs' | 'API Keys'
type IntegrationStatus = 'Available' | 'Connected' | 'Disconnected' | 'Failed'
type HealthStatus = 'Success' | 'Failed' | 'Retried' | 'Cancelled'
type KeyStatus = 'Active' | 'Inactive' | 'Expired'

type IntegrationRecord = {
  id: number
  name: string
  provider: string
  category: string
  description: string
  endpoint: string
  status: IntegrationStatus
  connectedAt: string
  lastSync: string
  nextSync: string
  requestsThisMonth: number
  dataTransferredBytes: number
  syncFrequency: string
  autoSync: boolean
  errorAlerts: boolean
  twoWaySync: boolean
}

type WebhookLog = {
  id: number
  timestamp: string
  endpoint: string
  event: string
  status: HealthStatus
  response: string
  responseTimeMs: number
  attempts: number
  ipAddress: string
}

type ApiKeyRecord = {
  id: number
  name: string
  environment: string
  permissions: string[]
  lastUsed: string
  requestsThisMonth: number
  status: KeyStatus
  expiresOn: string
  key: string
  restrictByIp: boolean
  allowedIps: string
  createdAt: string
}

type IntegrationSettings = {
  integrations: IntegrationRecord[]
  webhookLogs: WebhookLog[]
  apiKeys: ApiKeyRecord[]
}

type IntegrationDraft = {
  name: string
  provider: string
  category: string
  description: string
  endpoint: string
  status: IntegrationStatus
  syncFrequency: string
}

type ApiKeyDraft = {
  name: string
  environment: string
  expiration: string
  permissions: string
  restrictByIp: boolean
  allowedIps: string
}

const emptySettings: IntegrationSettings = {
  integrations: [],
  webhookLogs: [],
  apiKeys: [],
}

const emptyIntegration: IntegrationDraft = {
  name: '',
  provider: '',
  category: '',
  description: '',
  endpoint: '',
  status: 'Available',
  syncFrequency: '',
}

const emptyKey: ApiKeyDraft = {
  name: '',
  environment: '',
  expiration: '',
  permissions: '',
  restrictByIp: false,
  allowedIps: '',
}

const tabs: IntegrationTab[] = ['Overview', 'Connected', 'Available', 'Webhook Logs', 'API Keys']
const categories = ['Communication', 'Finance', 'Accounting', 'Storage', 'Productivity', 'Other']
const environments = ['Production', 'Staging', 'Development', 'Sandbox']
const keyPermissions = ['Read Data', 'Write Data', 'Manage Users', 'Run Reports', 'Manage Settings']

function nowStamp() {
  return new Date().toLocaleString()
}

function addMinutes(minutes: number) {
  const next = new Date()
  next.setMinutes(next.getMinutes() + minutes)
  return next.toLocaleString()
}

function bytesToSize(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 2)} ${units[unit]}`
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportCsv(filename: string, headers: string[], rows: unknown[][]) {
  downloadText(filename, [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8')
}

function newSecret() {
  const raw = crypto.getRandomValues(new Uint8Array(24))
  return `oiec_${Array.from(raw).map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

function statusTone(status: string) {
  if (['Connected', 'Active', 'Success'].includes(status)) return 'bg-green-100 text-green-700'
  if (['Available', 'Retried', 'Inactive'].includes(status)) return 'bg-orange-100 text-orange-700'
  if (['Disconnected', 'Cancelled'].includes(status)) return 'bg-slate-100 text-slate-600'
  return 'bg-red-100 text-red-700'
}

function Card({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
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

function Stat({ icon, label, value, sub, tone = 'blue' }: { icon: ReactNode; label: string; value: string; sub?: string; tone?: 'blue' | 'green' | 'orange' | 'purple' | 'red' }) {
  const tones = {
    blue: 'bg-blue-50 text-coop-blue',
    green: 'bg-green-50 text-coop-green',
    orange: 'bg-orange-50 text-orange-500',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
        <span>
          <span className="block text-xs font-semibold text-slate-500">{label}</span>
          <span className="block text-lg font-bold text-navy">{value}</span>
          {sub && <span className="block text-xs text-slate-500">{sub}</span>}
        </span>
      </div>
    </div>
  )
}

function Badge({ value }: { value: string }) {
  return <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${statusTone(value)}`}>{value}</span>
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? 'bg-coop-blue' : 'bg-slate-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} /></button>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold text-navy">{label}</span>{children}</label>
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{message}</div>
}

function ActionButton({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-bold hover:bg-blue-50 ${danger ? 'text-red-600' : 'text-coop-blue'}`}>{children}</button>
}

export default function Integrations() {
  const [tab, setTab] = useState<IntegrationTab>('Overview')
  const [settings, setSettings] = useState<IntegrationSettings>(emptySettings)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showIntegrationForm, setShowIntegrationForm] = useState(false)
  const [showKeyForm, setShowKeyForm] = useState(false)
  const [draft, setDraft] = useState<IntegrationDraft>(emptyIntegration)
  const [keyDraft, setKeyDraft] = useState<ApiKeyDraft>(emptyKey)
  const [saving, setSaving] = useState(false)

  const connected = settings.integrations.filter(item => item.status === 'Connected')
  const available = settings.integrations.filter(item => item.status === 'Available' || item.status === 'Disconnected')
  const failed = settings.integrations.filter(item => item.status === 'Failed')
  const selected = settings.integrations.find(item => item.id === selectedId) || connected[0] || settings.integrations[0]
  const requests = settings.integrations.reduce((sum, item) => sum + item.requestsThisMonth, 0) + settings.apiKeys.reduce((sum, item) => sum + item.requestsThisMonth, 0)
  const transferred = settings.integrations.reduce((sum, item) => sum + item.dataTransferredBytes, 0)
  const latestSync = connected.map(item => item.lastSync).filter(Boolean)[0] || ''
  const filteredIntegrations = settings.integrations.filter(item => {
    const term = search.toLowerCase()
    const matchesSearch = !term || [item.name, item.provider, item.category, item.description, item.endpoint].some(value => value.toLowerCase().includes(term))
    const matchesCategory = !categoryFilter || item.category === categoryFilter
    const matchesStatus = !statusFilter || item.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })
  const visibleConnected = filteredIntegrations.filter(item => item.status === 'Connected')
  const visibleAvailable = filteredIntegrations.filter(item => item.status !== 'Connected')
  const visibleLogs = settings.webhookLogs.filter(item => {
    const matchesSearch = !search || [item.endpoint, item.event, item.status, item.response, item.ipAddress].some(value => String(value).toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = !statusFilter || item.status === statusFilter
    return matchesSearch && matchesStatus
  })
  const visibleKeys = settings.apiKeys.filter(item => !search || [item.name, item.environment, item.status, item.permissions.join(' ')].some(value => value.toLowerCase().includes(search.toLowerCase())))
  const statusPie = [
    { name: 'Connected', value: connected.length, color: '#16A34A' },
    { name: 'Available', value: available.length, color: '#93C5FD' },
    { name: 'Failed', value: failed.length, color: '#EF4444' },
  ].filter(item => item.value > 0)
  const keyPie = [
    { name: 'Active', value: settings.apiKeys.filter(item => item.status === 'Active').length, color: '#16A34A' },
    { name: 'Inactive', value: settings.apiKeys.filter(item => item.status === 'Inactive').length, color: '#F59E0B' },
    { name: 'Expired', value: settings.apiKeys.filter(item => item.status === 'Expired').length, color: '#EF4444' },
  ].filter(item => item.value > 0)

  useEffect(() => {
    settingsApi.get<IntegrationSettings>('integrations')
      .then(saved => setSettings({
        ...emptySettings,
        ...saved,
        integrations: saved.integrations || [],
        webhookLogs: saved.webhookLogs || [],
        apiKeys: saved.apiKeys || [],
      }))
      .catch(() => setSettings(emptySettings))
  }, [])

  const saveSettings = async (next = settings, message = 'Integration settings saved') => {
    try {
      setSaving(true)
      const saved = await settingsApi.save<IntegrationSettings>('integrations', next)
      setSettings({
        ...emptySettings,
        ...saved,
        integrations: saved.integrations || [],
        webhookLogs: saved.webhookLogs || [],
        apiKeys: saved.apiKeys || [],
      })
      toast.success(message)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save integrations')
    } finally {
      setSaving(false)
    }
  }

  const createLog = (integration: IntegrationRecord, status: HealthStatus = 'Success'): WebhookLog => ({
    id: Date.now(),
    timestamp: nowStamp(),
    endpoint: integration.endpoint || '/webhook',
    event: status === 'Success' ? 'manual.sync' : 'manual.sync_failed',
    status,
    response: status === 'Success' ? '200 OK' : 'Connection failed',
    responseTimeMs: status === 'Success' ? 180 : 0,
    attempts: status === 'Success' ? 1 : 3,
    ipAddress: window.location.hostname || 'local',
  })

  const addIntegration = async () => {
    if (!draft.name.trim()) return toast.error('Enter integration name')
    if (!draft.category.trim()) return toast.error('Select category')
    const record: IntegrationRecord = {
      id: Date.now(),
      name: draft.name.trim(),
      provider: draft.provider.trim(),
      category: draft.category,
      description: draft.description.trim(),
      endpoint: draft.endpoint.trim(),
      status: draft.status,
      connectedAt: draft.status === 'Connected' ? nowStamp() : '',
      lastSync: '',
      nextSync: '',
      requestsThisMonth: 0,
      dataTransferredBytes: 0,
      syncFrequency: draft.syncFrequency,
      autoSync: Boolean(draft.syncFrequency),
      errorAlerts: true,
      twoWaySync: false,
    }
    await saveSettings({ ...settings, integrations: [record, ...settings.integrations] }, 'Integration added')
    setDraft(emptyIntegration)
    setShowIntegrationForm(false)
    setSelectedId(record.id)
  }

  const updateIntegration = async (id: number, updates: Partial<IntegrationRecord>, message: string) => {
    const nextIntegrations = settings.integrations.map(item => item.id === id ? { ...item, ...updates } : item)
    await saveSettings({ ...settings, integrations: nextIntegrations }, message)
  }

  const connectIntegration = async (item: IntegrationRecord) => {
    await updateIntegration(item.id, { status: 'Connected', connectedAt: item.connectedAt || nowStamp(), nextSync: addMinutes(15) }, 'Integration connected')
  }

  const syncIntegration = async (item: IntegrationRecord) => {
    const updated = {
      ...item,
      status: 'Connected' as IntegrationStatus,
      lastSync: nowStamp(),
      nextSync: addMinutes(15),
      requestsThisMonth: item.requestsThisMonth + 1,
      dataTransferredBytes: item.dataTransferredBytes + 1024,
    }
    const next = {
      ...settings,
      integrations: settings.integrations.map(row => row.id === item.id ? updated : row),
      webhookLogs: [createLog(updated), ...settings.webhookLogs],
    }
    await saveSettings(next, 'Integration synced')
  }

  const disconnectIntegration = async (item: IntegrationRecord) => {
    await updateIntegration(item.id, { status: 'Disconnected', nextSync: '' }, 'Integration disconnected')
  }

  const deleteIntegration = async (item: IntegrationRecord) => {
    await saveSettings({ ...settings, integrations: settings.integrations.filter(row => row.id !== item.id) }, 'Integration removed')
  }

  const saveSelectedOptions = async (updates: Partial<IntegrationRecord>) => {
    if (!selected) return
    await updateIntegration(selected.id, updates, 'Integration configuration saved')
  }

  const createApiKey = async () => {
    if (!keyDraft.name.trim()) return toast.error('Enter API key name')
    if (!keyDraft.environment) return toast.error('Select environment')
    const record: ApiKeyRecord = {
      id: Date.now(),
      name: keyDraft.name.trim(),
      environment: keyDraft.environment,
      permissions: keyDraft.permissions ? keyDraft.permissions.split(',').map(item => item.trim()).filter(Boolean) : [],
      lastUsed: '',
      requestsThisMonth: 0,
      status: 'Active',
      expiresOn: keyDraft.expiration,
      key: newSecret(),
      restrictByIp: keyDraft.restrictByIp,
      allowedIps: keyDraft.allowedIps,
      createdAt: nowStamp(),
    }
    await saveSettings({ ...settings, apiKeys: [record, ...settings.apiKeys] }, 'API key generated')
    downloadText(`${record.name.replace(/\s+/g, '-').toLowerCase()}-api-key.txt`, record.key)
    setKeyDraft(emptyKey)
    setShowKeyForm(false)
  }

  const updateKeyStatus = async (item: ApiKeyRecord, status: KeyStatus) => {
    await saveSettings({ ...settings, apiKeys: settings.apiKeys.map(row => row.id === item.id ? { ...row, status } : row) }, status === 'Active' ? 'API key activated' : 'API key deactivated')
  }

  const deleteKey = async (item: ApiKeyRecord) => {
    await saveSettings({ ...settings, apiKeys: settings.apiKeys.filter(row => row.id !== item.id) }, 'API key removed')
  }

  const exportIntegrations = () => {
    exportCsv('integrations.csv', ['Name', 'Provider', 'Category', 'Status', 'Connected On', 'Last Sync', 'Requests'], settings.integrations.map(item => [item.name, item.provider, item.category, item.status, item.connectedAt, item.lastSync, item.requestsThisMonth]))
    toast.success('Integrations exported')
  }

  const exportLogs = () => {
    exportCsv('webhook-logs.csv', ['Timestamp', 'Endpoint', 'Event', 'Status', 'Response', 'Response Time', 'Attempts', 'IP Address'], settings.webhookLogs.map(item => [item.timestamp, item.endpoint, item.event, item.status, item.response, item.responseTimeMs, item.attempts, item.ipAddress]))
    toast.success('Webhook logs exported')
  }

  const exportKeys = () => {
    exportCsv('api-keys.csv', ['Name', 'Environment', 'Permissions', 'Last Used', 'Requests', 'Status', 'Expires On'], settings.apiKeys.map(item => [item.name, item.environment, item.permissions.join('; '), item.lastUsed, item.requestsThisMonth, item.status, item.expiresOn]))
    toast.success('API keys exported')
  }

  const clearLogs = async () => {
    await saveSettings({ ...settings, webhookLogs: [] }, 'Webhook logs cleared')
  }

  const testWebhook = async () => {
    if (!selected) return toast.error('Select or add an integration first')
    await saveSettings({ ...settings, webhookLogs: [createLog(selected), ...settings.webhookLogs] }, 'Webhook test completed')
  }

  const healthMessage = failed.length ? `${failed.length} integration needs attention.` : connected.length ? 'All connected integrations are active.' : 'No integrations connected yet.'

  return (
    <div className="space-y-4 p-3 md:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Integrations</h2>
          <p className="text-sm text-slate-500">Connect and manage third-party services to extend system functionality.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search integrations..." className="input-field w-64 pl-9" />
          </div>
          <button onClick={() => downloadText('integration-documentation.txt', 'Integration guide: add a service, enter endpoint details, connect it, sync it, review webhook logs, and create API keys for secure access.')} className="btn-secondary"><HelpCircle size={14} /> Documentation</button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto border-b border-slate-200 bg-white px-2">
        {tabs.map(item => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold ${tab === item ? 'border-coop-blue text-coop-blue' : 'border-transparent text-navy hover:text-coop-blue'}`}>{item}</button>)}
      </div>

      {tab === 'Overview' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Card title="Integration Overview">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Stat icon={<Database size={20} />} label="Total Integrations" value={String(settings.integrations.length)} sub="All integrations" />
                <Stat icon={<Link2 size={20} />} label="Connected" value={String(connected.length)} sub="Active integrations" tone="green" />
                <Stat icon={<PlayCircle size={20} />} label="Available" value={String(available.length)} sub="Ready to connect" tone="orange" />
                <Stat icon={<XCircle size={20} />} label="Failed" value={String(failed.length)} sub="Needs attention" tone="purple" />
                <Stat icon={<RefreshCw size={20} />} label="Requests" value={String(requests)} sub="This month" />
              </div>
            </Card>

            <Card title="Connected Integrations" sub="Manage and configure active integrations." action={<button onClick={() => setTab('Connected')} className="text-xs font-bold text-coop-blue">View All Connected</button>}>
              <IntegrationTable rows={connected.slice(0, 7)} onSelect={setSelectedId} onSync={syncIntegration} onConnect={connectIntegration} onDisconnect={disconnectIntegration} onDelete={deleteIntegration} />
            </Card>

            <Card title="Available Integrations" sub="Browse and connect saved integration records." action={<button onClick={() => setTab('Available')} className="text-xs font-bold text-coop-blue">View All Available</button>}>
              {available.length ? <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">{available.slice(0, 5).map(item => <IntegrationTile key={item.id} item={item} onConnect={connectIntegration} onView={() => { setSelectedId(item.id); setTab('Available') }} />)}</div> : <EmptyState message="No available integrations yet. Use Add Custom Integration to create one." />}
            </Card>

            <Card title="Integration Health" action={<button onClick={() => toast.success(healthMessage)} className="btn-secondary"><ShieldCheck size={14} /> View Health Details</button>}>
              <div className="flex items-center gap-3 text-sm text-navy"><CheckCircle size={22} className={failed.length ? 'text-orange-500' : 'text-coop-green'} /> {healthMessage}</div>
            </Card>
          </div>

          <SideOverview statusPie={statusPie} settings={settings} connected={connected.length} failed={failed.length} onAdd={() => setShowIntegrationForm(true)} onKeys={() => setTab('API Keys')} onLogs={() => setTab('Webhook Logs')} onExport={exportIntegrations} />
        </div>
      )}

      {tab === 'Connected' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Stat icon={<Link2 size={20} />} label="Total Connected" value={String(connected.length)} sub="Active integrations" tone="green" />
              <Stat icon={<RefreshCw size={20} />} label="Successful Syncs" value={String(settings.webhookLogs.filter(item => item.status === 'Success').length)} sub="All integrations" />
              <Stat icon={<ClockIcon />} label="Last Sync" value={latestSync || 'No sync'} sub={latestSync ? 'Latest successful sync' : 'Pending'} tone="purple" />
              <Stat icon={<AlertTriangle size={20} />} label="Sync Issues" value={String(failed.length)} sub={failed.length ? 'Review failed services' : 'All working well'} tone="orange" />
              <Stat icon={<Database size={20} />} label="Data Transferred" value={bytesToSize(transferred)} sub="This month" />
            </div>
            <Card title="Connected Integrations" sub="These are the services currently connected to your system." action={<div className="flex gap-2"><button onClick={() => Promise.all(connected.map(syncIntegration))} className="btn-secondary"><RefreshCw size={14} /> Refresh All</button><button onClick={exportIntegrations} className="btn-secondary"><Filter size={14} /> Export</button></div>}>
              <IntegrationTable rows={visibleConnected} onSelect={setSelectedId} onSync={syncIntegration} onConnect={connectIntegration} onDisconnect={disconnectIntegration} onDelete={deleteIntegration} />
            </Card>
            <IntegrationDetails selected={selected} onSave={saveSelectedOptions} />
          </div>
          <ConnectedSide statusPie={statusPie} logs={settings.webhookLogs} connected={connected.length} failed={failed.length} onLogs={() => setTab('Webhook Logs')} />
        </div>
      )}

      {tab === 'Available' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Stat icon={<Plus size={20} />} label="Total Available" value={String(available.length)} sub="Saved services" />
              <Stat icon={<ShieldCheck size={20} />} label="Categories" value={String(new Set(settings.integrations.map(item => item.category).filter(Boolean)).size)} sub="Service categories" tone="green" />
              <Stat icon={<Download size={20} />} label="Ready to Enable" value={String(available.length)} sub="Not connected" tone="purple" />
              <Stat icon={<Plus size={20} />} label="New This Month" value={String(settings.integrations.length)} sub="User-created" tone="orange" />
              <Stat icon={<Download size={20} />} label="Total Installs" value={String(connected.length)} sub="Connected services" />
            </div>
            <Card title="Available Integrations" sub="Add or enable third-party services to extend system functionality." action={<button onClick={() => setShowIntegrationForm(true)} className="btn-primary bg-coop-blue"><Plus size={14} /> Add Custom Integration</button>}>
              <FilterBar categoryFilter={categoryFilter} statusFilter={statusFilter} onCategory={setCategoryFilter} onStatus={setStatusFilter} onReset={() => { setCategoryFilter(''); setStatusFilter(''); setSearch('') }} />
              <IntegrationTable rows={visibleAvailable} onSelect={setSelectedId} onSync={syncIntegration} onConnect={connectIntegration} onDisconnect={disconnectIntegration} onDelete={deleteIntegration} />
            </Card>
          </div>
          <AvailableSide integrations={settings.integrations} onAdd={() => setShowIntegrationForm(true)} />
        </div>
      )}

      {tab === 'Webhook Logs' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <FilterBar categoryFilter={categoryFilter} statusFilter={statusFilter} onCategory={setCategoryFilter} onStatus={setStatusFilter} onReset={() => { setCategoryFilter(''); setStatusFilter(''); setSearch('') }} statusOptions={['Success', 'Failed', 'Retried', 'Cancelled']} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Stat icon={<Send size={20} />} label="Total Requests" value={String(settings.webhookLogs.length)} sub="All webhook attempts" />
              <Stat icon={<CheckCircle size={20} />} label="Successful" value={String(settings.webhookLogs.filter(item => item.status === 'Success').length)} sub="Delivered" tone="green" />
              <Stat icon={<AlertTriangle size={20} />} label="Failed" value={String(settings.webhookLogs.filter(item => item.status === 'Failed').length)} sub="Needs retry" tone="orange" />
              <Stat icon={<RefreshCw size={20} />} label="Retried" value={String(settings.webhookLogs.filter(item => item.status === 'Retried').length)} sub="Retry attempts" tone="purple" />
              <Stat icon={<ClockIcon />} label="Avg. Response" value={`${averageResponse(settings.webhookLogs)} ms`} sub="Successful requests" />
            </div>
            <Card title="Webhook Delivery Logs" sub="Detailed list of webhook events and delivery attempts." action={<div className="flex gap-2"><button onClick={testWebhook} className="btn-secondary"><Send size={14} /> Test Webhook</button><button onClick={exportLogs} className="btn-secondary"><Download size={14} /> Export Logs</button></div>}>
              <WebhookTable rows={visibleLogs} />
            </Card>
          </div>
          <WebhookSide logs={settings.webhookLogs} onClear={clearLogs} onExport={exportLogs} />
        </div>
      )}

      {tab === 'API Keys' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Stat icon={<KeyRound size={20} />} label="Total API Keys" value={String(settings.apiKeys.length)} sub="All environments" tone="purple" />
              <Stat icon={<ShieldCheck size={20} />} label="Active Keys" value={String(settings.apiKeys.filter(item => item.status === 'Active').length)} sub="Currently active" tone="green" />
              <Stat icon={<PauseCircle size={20} />} label="Inactive Keys" value={String(settings.apiKeys.filter(item => item.status === 'Inactive').length)} sub="Currently inactive" tone="orange" />
              <Stat icon={<CalendarIcon />} label="Expiring Soon" value={String(settings.apiKeys.filter(item => item.expiresOn).length)} sub="With expiry dates" />
              <Stat icon={<RefreshCw size={20} />} label="Requests" value={String(settings.apiKeys.reduce((sum, item) => sum + item.requestsThisMonth, 0))} sub="This month" tone="purple" />
            </div>
            <Card title="API Keys" sub="Create and manage API keys for secure access." action={<div className="flex gap-2"><button onClick={() => setShowKeyForm(true)} className="btn-primary bg-coop-blue"><Plus size={14} /> Create New API Key</button><button onClick={exportKeys} className="btn-secondary"><Download size={14} /> Export</button></div>}>
              <ApiKeyTable rows={visibleKeys} onCopy={key => navigator.clipboard.writeText(key).then(() => toast.success('API key copied'))} onToggle={updateKeyStatus} onDelete={deleteKey} />
            </Card>
            {showKeyForm && <ApiKeyForm draft={keyDraft} setDraft={setKeyDraft} onCancel={() => setShowKeyForm(false)} onCreate={createApiKey} />}
          </div>
          <ApiKeySide pie={keyPie} onDocumentation={() => downloadText('api-key-documentation.txt', 'API key guide: create keys per environment, grant only required permissions, rotate keys regularly, and deactivate unused keys.')} />
        </div>
      )}

      {showIntegrationForm && <IntegrationForm draft={draft} setDraft={setDraft} onCancel={() => setShowIntegrationForm(false)} onCreate={addIntegration} />}

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-navy"><HelpCircle size={14} className="mr-2 inline text-coop-blue" /> Integrations are saved from your own entries. Add service details before connecting or syncing.</div>
    </div>
  )
}

function ClockIcon() {
  return <RefreshCw size={20} />
}

function CalendarIcon() {
  return <FileText size={20} />
}

function FilterBar({ categoryFilter, statusFilter, onCategory, onStatus, onReset, statusOptions = ['Available', 'Connected', 'Disconnected', 'Failed'] }: { categoryFilter: string; statusFilter: string; onCategory: (value: string) => void; onStatus: (value: string) => void; onReset: () => void; statusOptions?: string[] }) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
      <select value={categoryFilter} onChange={e => onCategory(e.target.value)} className="input-field"><option value="">All Categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select>
      <select value={statusFilter} onChange={e => onStatus(e.target.value)} className="input-field"><option value="">All Statuses</option>{statusOptions.map(item => <option key={item}>{item}</option>)}</select>
      <button onClick={onReset} className="btn-secondary justify-center"><RefreshCw size={14} /> Reset</button>
    </div>
  )
}

function IntegrationForm({ draft, setDraft, onCancel, onCreate }: { draft: IntegrationDraft; setDraft: (draft: IntegrationDraft) => void; onCancel: () => void; onCreate: () => void }) {
  return (
    <Card title="Add Custom Integration" sub="Set up a service connection for your system.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Integration Name"><input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="input-field" placeholder="Enter service name" /></Field>
        <Field label="Provider"><input value={draft.provider} onChange={e => setDraft({ ...draft, provider: e.target.value })} className="input-field" placeholder="Provider name" /></Field>
        <Field label="Category"><select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} className="input-field"><option value="">Select category</option>{categories.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Endpoint URL"><input value={draft.endpoint} onChange={e => setDraft({ ...draft, endpoint: e.target.value })} className="input-field" placeholder="https://..." /></Field>
        <Field label="Status"><select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as IntegrationStatus })} className="input-field"><option>Available</option><option>Connected</option><option>Disconnected</option><option>Failed</option></select></Field>
        <Field label="Sync Frequency"><input value={draft.syncFrequency} onChange={e => setDraft({ ...draft, syncFrequency: e.target.value })} className="input-field" placeholder="Example: Every 15 minutes" /></Field>
      </div>
      <Field label="Description"><textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className="input-field min-h-20" placeholder="What this integration does" /></Field>
      <div className="mt-4 flex justify-end gap-2"><button onClick={onCancel} className="btn-secondary">Cancel</button><button onClick={onCreate} className="btn-primary bg-coop-blue"><Save size={14} /> Save Integration</button></div>
    </Card>
  )
}

function IntegrationTable({ rows, onSelect, onSync, onConnect, onDisconnect, onDelete }: { rows: IntegrationRecord[]; onSelect: (id: number) => void; onSync: (row: IntegrationRecord) => void; onConnect: (row: IntegrationRecord) => void; onDisconnect: (row: IntegrationRecord) => void; onDelete: (row: IntegrationRecord) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr>{['Integration', 'Category', 'Status', 'Last Sync', 'Next Sync', 'Data Sync', 'Actions'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map(row => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-3 py-2"><button onClick={() => onSelect(row.id)} className="text-left"><span className="block font-bold text-navy">{row.name}</span><span className="text-slate-500">{row.description || row.provider || '-'}</span></button></td>
              <td className="px-3 py-2"><span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-coop-blue">{row.category || '-'}</span></td>
              <td className="px-3 py-2"><Badge value={row.status} /></td>
              <td className="px-3 py-2">{row.lastSync || '-'}</td>
              <td className="px-3 py-2">{row.nextSync || '-'}</td>
              <td className="px-3 py-2">{bytesToSize(row.dataTransferredBytes)}</td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <button onClick={() => onSelect(row.id)} className="rounded-md border p-1.5 text-coop-blue"><Settings size={13} /></button>
                  {row.status === 'Connected' ? <button onClick={() => onSync(row)} className="rounded-md border p-1.5 text-coop-blue"><RefreshCw size={13} /></button> : <button onClick={() => onConnect(row)} className="rounded-md border p-1.5 text-coop-green"><PlayCircle size={13} /></button>}
                  {row.status === 'Connected' && <button onClick={() => onDisconnect(row)} className="rounded-md border p-1.5 text-orange-500"><PauseCircle size={13} /></button>}
                  <button onClick={() => onDelete(row)} className="rounded-md border p-1.5 text-red-600"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          )) : <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No integrations found.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function IntegrationTile({ item, onConnect, onView }: { item: IntegrationRecord; onConnect: (item: IntegrationRecord) => void; onView: () => void }) {
  return <div className="rounded-lg border border-slate-200 p-4"><Webhook size={24} className="text-coop-blue" /><h4 className="mt-3 text-sm font-bold text-navy">{item.name}</h4><p className="mt-1 min-h-10 text-xs text-slate-500">{item.description || item.provider || 'Saved integration'}</p><div className="mt-4 flex gap-2"><button onClick={onView} className="btn-secondary flex-1 justify-center text-xs">Details</button><button onClick={() => onConnect(item)} className="btn-primary flex-1 justify-center bg-coop-blue text-xs">Connect</button></div></div>
}

function IntegrationDetails({ selected, onSave }: { selected?: IntegrationRecord; onSave: (updates: Partial<IntegrationRecord>) => void }) {
  const [syncFrequency, setSyncFrequency] = useState('')
  useEffect(() => setSyncFrequency(selected?.syncFrequency || ''), [selected])
  if (!selected) return <Card title="Integration Details"><EmptyState message="Select an integration to view details." /></Card>
  return (
    <Card title="Integration Details" sub="View and update selected service configuration." action={<button onClick={() => onSave({ syncFrequency })} className="btn-secondary"><Save size={14} /> Configure Integration</button>}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MiniDetail label="Provider" value={selected.provider} />
        <MiniDetail label="Connected On" value={selected.connectedAt || '-'} />
        <MiniDetail label="Status" value={selected.status} />
        <MiniDetail label="Last Sync" value={selected.lastSync || '-'} />
        <MiniDetail label="Next Sync" value={selected.nextSync || '-'} />
        <Field label="Sync Frequency"><input value={syncFrequency} onChange={e => setSyncFrequency(e.target.value)} className="input-field" placeholder="Example: Every 15 minutes" /></Field>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <ToggleLine label="Auto Sync" checked={selected.autoSync} onChange={value => onSave({ autoSync: value })} />
        <ToggleLine label="Error Alerts" checked={selected.errorAlerts} onChange={value => onSave({ errorAlerts: value })} />
        <ToggleLine label="Two-way Sync" checked={selected.twoWaySync} onChange={value => onSave({ twoWaySync: value })} />
      </div>
    </Card>
  )
}

function MiniDetail({ label, value }: { label: string; value?: string }) {
  return <div><span className="block text-xs font-semibold text-slate-500">{label}</span><span className="block text-xs font-bold text-navy">{value || '-'}</span></div>
}

function ToggleLine({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-xs font-bold text-navy"><span>{label}</span><Toggle checked={checked} onChange={onChange} /></div>
}

function WebhookTable({ rows }: { rows: WebhookLog[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr>{['ID', 'Timestamp', 'Endpoint', 'Event', 'Status', 'Response', 'Response Time', 'Attempts', 'IP Address', 'Actions'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-coop-blue">wh_{row.id}</td><td className="px-3 py-2">{row.timestamp}</td><td className="px-3 py-2">{row.endpoint}</td><td className="px-3 py-2">{row.event}</td><td className="px-3 py-2"><Badge value={row.status} /></td><td className="px-3 py-2">{row.response}</td><td className="px-3 py-2">{row.responseTimeMs ? `${row.responseTimeMs} ms` : '-'}</td><td className="px-3 py-2">{row.attempts}</td><td className="px-3 py-2">{row.ipAddress}</td><td className="px-3 py-2"><button onClick={() => toast.success(`Viewing ${row.event}`)} className="rounded-md border p-1.5 text-coop-blue"><Eye size={13} /></button></td></tr>) : <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-400">No webhook logs found.</td></tr>}</tbody>
      </table>
    </div>
  )
}

function ApiKeyTable({ rows, onCopy, onToggle, onDelete }: { rows: ApiKeyRecord[]; onCopy: (key: string) => void; onToggle: (row: ApiKeyRecord, status: KeyStatus) => void; onDelete: (row: ApiKeyRecord) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr>{['Key Name', 'Environment', 'Permissions', 'Last Used', 'Requests', 'Status', 'Expires On', 'Actions'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2"><span className="block font-bold text-navy">{row.name}</span><span className="text-slate-400">{row.key.slice(0, 12)}...</span></td><td className="px-3 py-2">{row.environment}</td><td className="px-3 py-2"><div className="flex flex-wrap gap-1">{row.permissions.length ? row.permissions.map(item => <span key={item} className="rounded bg-green-50 px-1.5 py-1 text-[10px] font-bold text-green-700">{item}</span>) : '-'}</div></td><td className="px-3 py-2">{row.lastUsed || 'Never'}</td><td className="px-3 py-2">{row.requestsThisMonth}</td><td className="px-3 py-2"><Badge value={row.status} /></td><td className="px-3 py-2">{row.expiresOn || 'Never'}</td><td className="px-3 py-2"><div className="flex gap-2"><button onClick={() => onCopy(row.key)} className="rounded-md border p-1.5 text-coop-blue"><Copy size={13} /></button><button onClick={() => onToggle(row, row.status === 'Active' ? 'Inactive' : 'Active')} className="rounded-md border p-1.5 text-orange-500"><MoreVertical size={13} /></button><button onClick={() => onDelete(row)} className="rounded-md border p-1.5 text-red-600"><Trash2 size={13} /></button></div></td></tr>) : <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No API keys created.</td></tr>}</tbody>
      </table>
    </div>
  )
}

function ApiKeyForm({ draft, setDraft, onCancel, onCreate }: { draft: ApiKeyDraft; setDraft: (draft: ApiKeyDraft) => void; onCancel: () => void; onCreate: () => void }) {
  const togglePermission = (permission: string) => {
    const current = draft.permissions ? draft.permissions.split(',').map(item => item.trim()).filter(Boolean) : []
    const next = current.includes(permission) ? current.filter(item => item !== permission) : [...current, permission]
    setDraft({ ...draft, permissions: next.join(', ') })
  }
  return (
    <Card title="Create New API Key" sub="Generate a key with custom permissions and access settings.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Key Name"><input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="input-field" placeholder="Example: Mobile Application" /></Field>
        <Field label="Environment"><select value={draft.environment} onChange={e => setDraft({ ...draft, environment: e.target.value })} className="input-field"><option value="">Select environment</option>{environments.map(item => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Expiration"><input type="date" value={draft.expiration} onChange={e => setDraft({ ...draft, expiration: e.target.value })} className="input-field" /></Field>
      </div>
      <div className="mt-3"><span className="mb-2 block text-xs font-bold text-navy">Permissions</span><div className="flex flex-wrap gap-2">{keyPermissions.map(item => <button key={item} onClick={() => togglePermission(item)} className={`rounded-md border px-3 py-2 text-xs font-bold ${draft.permissions.includes(item) ? 'border-coop-blue bg-blue-50 text-coop-blue' : 'border-slate-200 text-slate-600'}`}>{item}</button>)}</div></div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[240px_1fr]"><ToggleLine label="Restrict by IP Address" checked={draft.restrictByIp} onChange={value => setDraft({ ...draft, restrictByIp: value })} /><Field label="Allowed IP Addresses"><input value={draft.allowedIps} onChange={e => setDraft({ ...draft, allowedIps: e.target.value })} className="input-field" placeholder="Comma-separated IP addresses" /></Field></div>
      <div className="mt-4 flex justify-end gap-2"><button onClick={onCancel} className="btn-secondary">Cancel</button><button onClick={onCreate} className="btn-primary bg-coop-blue"><KeyRound size={14} /> Generate API Key</button></div>
    </Card>
  )
}

function SideOverview({ statusPie, settings, connected, failed, onAdd, onKeys, onLogs, onExport }: { statusPie: Array<{ name: string; value: number; color: string }>; settings: IntegrationSettings; connected: number; failed: number; onAdd: () => void; onKeys: () => void; onLogs: () => void; onExport: () => void }) {
  return (
    <div className="space-y-4">
      <PieCard title="Integration Status" data={statusPie} total={settings.integrations.length} />
      <Card title="Categories"><div className="space-y-2">{categories.map(category => <MiniDetail key={category} label={category} value={String(settings.integrations.filter(item => item.category === category).length)} />)}</div></Card>
      <Card title="Quick Actions"><div className="space-y-2"><ActionButton onClick={onAdd}><Plus size={14} /> Add Custom Integration</ActionButton><ActionButton onClick={onKeys}><KeyRound size={14} /> Manage API Keys</ActionButton><ActionButton onClick={onLogs}><Webhook size={14} /> View Webhook Logs</ActionButton><ActionButton onClick={onExport}><Download size={14} /> Export Integrations</ActionButton></div></Card>
      <Card title="Need Help?"><p className="text-xs text-slate-600">{connected} connected, {failed} failed.</p><button onClick={() => downloadText('integration-help.txt', 'Add an integration, connect it, sync it, and review delivery logs.')} className="mt-3 btn-secondary w-full justify-center"><HelpCircle size={14} /> View Documentation</button></Card>
    </div>
  )
}

function ConnectedSide({ statusPie, logs, connected, failed, onLogs }: { statusPie: Array<{ name: string; value: number; color: string }>; logs: WebhookLog[]; connected: number; failed: number; onLogs: () => void }) {
  return <div className="space-y-4"><PieCard title="Connection Health" data={statusPie} total={connected + failed} /><Card title="Recent Syncs">{logs.length ? <div className="space-y-2">{logs.slice(0, 5).map(item => <MiniDetail key={item.id} label={item.event} value={item.timestamp} />)}</div> : <EmptyState message="No sync activity yet." />}<button onClick={onLogs} className="mt-3 text-xs font-bold text-coop-blue">View All Sync History</button></Card></div>
}

function AvailableSide({ integrations, onAdd }: { integrations: IntegrationRecord[]; onAdd: () => void }) {
  return <div className="space-y-4"><Card title="Categories"><div className="space-y-2">{categories.map(category => <MiniDetail key={category} label={category} value={String(integrations.filter(item => item.category === category).length)} />)}</div></Card><Card title="How it works"><div className="space-y-3 text-xs text-slate-600"><p>1. Add your integration details.</p><p>2. Review endpoint, pricing and requirements.</p><p>3. Connect and test sync.</p></div></Card><Card title="Request an Integration"><button onClick={onAdd} className="btn-secondary w-full justify-center"><Send size={14} /> Request Integration</button></Card></div>
}

function WebhookSide({ logs, onClear, onExport }: { logs: WebhookLog[]; onClear: () => void; onExport: () => void }) {
  const pie = [
    { name: 'Successful', value: logs.filter(item => item.status === 'Success').length, color: '#16A34A' },
    { name: 'Failed', value: logs.filter(item => item.status === 'Failed').length, color: '#EF4444' },
    { name: 'Retried', value: logs.filter(item => item.status === 'Retried').length, color: '#F59E0B' },
  ].filter(item => item.value > 0)
  return <div className="space-y-4"><PieCard title="Delivery Summary" data={pie} total={logs.length} /><Card title="Recent Failures">{logs.filter(item => item.status === 'Failed').length ? logs.filter(item => item.status === 'Failed').slice(0, 5).map(item => <MiniDetail key={item.id} label={item.event} value={item.timestamp} />) : <EmptyState message="No failed deliveries." />}</Card><Card title="Quick Actions"><div className="space-y-2"><ActionButton onClick={onExport}><Download size={14} /> Export Logs</ActionButton><ActionButton onClick={onClear} danger><Trash2 size={14} /> Clear Logs</ActionButton></div></Card></div>
}

function ApiKeySide({ pie, onDocumentation }: { pie: Array<{ name: string; value: number; color: string }>; onDocumentation: () => void }) {
  return <div className="space-y-4"><PieCard title="API Usage Summary" data={pie} total={pie.reduce((sum, item) => sum + item.value, 0)} /><Card title="Key Security Best Practices"><div className="space-y-3 text-xs text-slate-600"><p>Keep API keys private.</p><p>Use least privilege permissions.</p><p>Rotate and deactivate unused keys.</p><p>Monitor key usage and activity.</p></div><button onClick={onDocumentation} className="mt-3 btn-secondary w-full justify-center"><FileText size={14} /> View Documentation</button></Card></div>
}

function PieCard({ title, data, total }: { title: string; data: Array<{ name: string; value: number; color: string }>; total: number }) {
  return (
    <Card title={title}>
      {data.length ? <><div className="h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" innerRadius={45} outerRadius={70}>{data.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="space-y-2">{data.map(item => <div key={item.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><b>{item.value}</b></div>)}</div><p className="mt-3 text-center text-xs text-slate-500">{total} total</p></> : <EmptyState message="No data available." />}
    </Card>
  )
}

function averageResponse(logs: WebhookLog[]) {
  const successful = logs.filter(item => item.status === 'Success' && item.responseTimeMs)
  if (!successful.length) return 0
  return Math.round(successful.reduce((sum, item) => sum + item.responseTimeMs, 0) / successful.length)
}
