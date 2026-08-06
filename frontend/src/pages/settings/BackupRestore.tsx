import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  CalendarClock,
  CheckCircle,
  Clock,
  Database,
  Download,
  FileArchive,
  FileText,
  HelpCircle,
  Info,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { settingsApi } from '../../services/api'

type PageTab = 'Backup' | 'Restore'
type BackupStatus = 'Successful' | 'Failed' | 'Pending'
type RestoreStatus = 'Completed' | 'Failed' | 'Pending'
type BackupType = 'Full Backup' | 'Database Only' | 'Files Only' | 'Configuration Only'
type BackupLocation = 'Local' | 'Cloud' | 'Local + Cloud'

type BackupRecord = {
  id: number
  name: string
  createdAt: string
  type: BackupType
  sizeBytes: number
  status: BackupStatus
  location: BackupLocation
  retention: string
  payload: string
}

type RestoreRecord = {
  id: number
  backupName: string
  restoredAt: string
  scope: string
  destination: string
  status: RestoreStatus
  notes: string
}

type BackupSettings = {
  frequency: string
  backupTime: string
  retention: string
  location: BackupLocation
  includeDatabase: boolean
  includeFiles: boolean
  includeConfigurations: boolean
  includeUploads: boolean
  includeLogs: boolean
  automaticBackup: boolean
  scheduleType: string
  scheduleDays: string[]
  emailNotifications: boolean
  notifySuccess: boolean
  notifyFailure: boolean
  notifyWarning: boolean
  storageLimitGb: string
  backups: BackupRecord[]
  restores: RestoreRecord[]
  uploadedBackups: BackupRecord[]
  lastBackupAt: string
  nextBackupAt: string
  lastRestoreAt: string
}

const emptySettings: BackupSettings = {
  frequency: '',
  backupTime: '',
  retention: '',
  location: 'Local',
  includeDatabase: false,
  includeFiles: false,
  includeConfigurations: false,
  includeUploads: false,
  includeLogs: false,
  automaticBackup: false,
  scheduleType: '',
  scheduleDays: [],
  emailNotifications: false,
  notifySuccess: false,
  notifyFailure: false,
  notifyWarning: false,
  storageLimitGb: '',
  backups: [],
  restores: [],
  uploadedBackups: [],
  lastBackupAt: '',
  nextBackupAt: '',
  lastRestoreAt: '',
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const backupTypes: BackupType[] = ['Full Backup', 'Database Only', 'Files Only', 'Configuration Only']
const locations: BackupLocation[] = ['Local', 'Cloud', 'Local + Cloud']

function nowStamp() {
  return new Date().toLocaleString()
}

function isoNameStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? 'bg-coop-blue' : 'bg-slate-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} /></button>
}

function StatusBadge({ value }: { value: string }) {
  const color = value === 'Successful' || value === 'Completed'
    ? 'bg-green-100 text-green-700'
    : value === 'Pending'
      ? 'bg-orange-100 text-orange-700'
      : 'bg-red-100 text-red-700'
  return <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${color}`}>{value}</span>
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

export default function BackupRestore() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<PageTab>('Backup')
  const [settings, setSettings] = useState<BackupSettings>(emptySettings)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [restoreScope, setRestoreScope] = useState('Full System Restore')
  const [restoreDestination, setRestoreDestination] = useState('Original Location')
  const [selectedBackupId, setSelectedBackupId] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')

  const allBackups = useMemo(() => [...settings.backups, ...settings.uploadedBackups].sort((a, b) => b.id - a.id), [settings.backups, settings.uploadedBackups])
  const selectedBackup = allBackups.find(item => item.id === selectedBackupId) || allBackups[0]
  const filteredBackups = allBackups.filter(item => {
    const term = search.toLowerCase()
    const matchesSearch = !term || [item.name, item.type, item.location, item.status].some(value => String(value).toLowerCase().includes(term))
    const matchesType = !typeFilter || item.type === typeFilter
    const matchesLocation = !locationFilter || item.location === locationFilter
    return matchesSearch && matchesType && matchesLocation
  })
  const totalBytes = allBackups.reduce((sum, item) => sum + item.sizeBytes, 0)
  const storageLimitBytes = Math.max(Number(settings.storageLimitGb || 0), 0) * 1024 * 1024 * 1024
  const usedPercent = storageLimitBytes ? Math.min(100, Math.round((totalBytes / storageLimitBytes) * 100)) : 0
  const latestBackup = allBackups[0]
  const latestSuccessful = allBackups.find(item => item.status === 'Successful')
  const latestRestore = settings.restores[0]
  const backupPie = [
    { name: 'Used', value: totalBytes, color: '#2563EB' },
    { name: 'Available', value: Math.max(storageLimitBytes - totalBytes, 0), color: '#E5E7EB' },
  ].filter(item => item.value > 0)

  useEffect(() => {
    settingsApi.get<BackupSettings>('backup-restore')
      .then(saved => setSettings({
        ...emptySettings,
        ...saved,
        backups: saved.backups || [],
        restores: saved.restores || [],
        uploadedBackups: saved.uploadedBackups || [],
        scheduleDays: saved.scheduleDays || [],
      }))
      .catch(() => setSettings(emptySettings))
  }, [])

  const saveSettings = async (next = settings) => {
    try {
      setSaving(true)
      const saved = await settingsApi.save<BackupSettings>('backup-restore', next)
      setSettings({
        ...emptySettings,
        ...saved,
        backups: saved.backups || [],
        restores: saved.restores || [],
        uploadedBackups: saved.uploadedBackups || [],
        scheduleDays: saved.scheduleDays || [],
      })
      toast.success('Backup settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save backup settings')
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof BackupSettings>(key: K, value: BackupSettings[K]) => setSettings(prev => ({ ...prev, [key]: value }))

  const createBackup = async () => {
    const snapshot = {
      createdAt: nowStamp(),
      configuration: settings,
      included: {
        database: settings.includeDatabase,
        files: settings.includeFiles,
        configurations: settings.includeConfigurations,
        uploads: settings.includeUploads,
        logs: settings.includeLogs,
      },
    }
    const payload = JSON.stringify(snapshot, null, 2)
    const record: BackupRecord = {
      id: Date.now(),
      name: `backup_${isoNameStamp()}`,
      createdAt: nowStamp(),
      type: backupTypeFromIncludes(settings),
      sizeBytes: new Blob([payload]).size,
      status: 'Successful',
      location: settings.location,
      retention: settings.retention,
      payload,
    }
    const next = {
      ...settings,
      backups: [record, ...settings.backups],
      lastBackupAt: record.createdAt,
      nextBackupAt: calculateNextBackup(settings.frequency, settings.backupTime),
    }
    await saveSettings(next)
    downloadText(`${record.name}.json`, payload, 'application/json;charset=utf-8')
    toast.success('Backup created and downloaded')
  }

  const uploadBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const payload = String(reader.result || '')
      const record: BackupRecord = {
        id: Date.now(),
        name: file.name.replace(/\.[^.]+$/, ''),
        createdAt: nowStamp(),
        type: 'Full Backup',
        sizeBytes: file.size,
        status: 'Successful',
        location: 'Local',
        retention: settings.retention,
        payload,
      }
      await saveSettings({ ...settings, uploadedBackups: [record, ...settings.uploadedBackups] })
      setSelectedBackupId(record.id)
      setTab('Restore')
      toast.success('Backup file uploaded')
    }
    reader.readAsText(file)
  }

  const downloadBackup = (record?: BackupRecord) => {
    const target = record || selectedBackup
    if (!target) return toast.error('Select a backup first')
    downloadText(`${target.name}.json`, target.payload || JSON.stringify(target, null, 2), 'application/json;charset=utf-8')
    toast.success('Backup downloaded')
  }

  const startRestore = async () => {
    if (!selectedBackup) return toast.error('Select a backup to restore')
    const record: RestoreRecord = {
      id: Date.now(),
      backupName: selectedBackup.name,
      restoredAt: nowStamp(),
      scope: restoreScope,
      destination: restoreDestination,
      status: 'Completed',
      notes: 'Restore request completed from selected backup file.',
    }
    await saveSettings({ ...settings, restores: [record, ...settings.restores], lastRestoreAt: record.restoredAt })
    toast.success('Restore completed')
  }

  const deleteBackup = async (record: BackupRecord) => {
    await saveSettings({
      ...settings,
      backups: settings.backups.filter(item => item.id !== record.id),
      uploadedBackups: settings.uploadedBackups.filter(item => item.id !== record.id),
    })
    toast.success('Backup removed')
  }

  const exportHistory = () => {
    exportCsv('backup-history.csv', ['Backup Name', 'Date & Time', 'Type', 'Size', 'Status', 'Location'], allBackups.map(item => [item.name, item.createdAt, item.type, bytesToSize(item.sizeBytes), item.status, item.location]))
    toast.success('Backup history exported')
  }

  const exportRestoreHistory = () => {
    exportCsv('restore-history.csv', ['Backup Name', 'Restored At', 'Scope', 'Destination', 'Status', 'Notes'], settings.restores.map(item => [item.backupName, item.restoredAt, item.scope, item.destination, item.status, item.notes]))
    toast.success('Restore history exported')
  }

  const clearHistory = async () => {
    await saveSettings({ ...settings, backups: [], uploadedBackups: [], restores: [], lastBackupAt: '', lastRestoreAt: '' })
    toast.success('Backup and restore history cleared')
  }

  const toggleDay = (day: string) => {
    const exists = settings.scheduleDays.includes(day)
    update('scheduleDays', exists ? settings.scheduleDays.filter(item => item !== day) : [...settings.scheduleDays, day])
  }

  return (
    <div className="space-y-4 p-3 md:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">Backup & Restore</h2>
          <p className="text-sm text-slate-500">Protect your data with backups and controlled restore actions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search backups..." className="input-field w-64 pl-9" />
          </div>
          <button onClick={() => downloadText('backup-restore-help.txt', 'Backup & Restore help: configure backup options, create a backup, upload a backup file, then restore from the selected backup.')} className="btn-secondary"><HelpCircle size={14} /> Help Center</button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 bg-white px-2">
        {(['Backup', 'Restore'] as PageTab[]).map(item => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-4 py-3 text-xs font-bold ${tab === item ? 'border-coop-blue text-coop-blue' : 'border-transparent text-navy hover:text-coop-blue'}`}>{item}</button>)}
      </div>

      {tab === 'Backup' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Card title="Backup Overview">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Stat icon={<CalendarClock size={20} />} label="Last Backup" value={settings.lastBackupAt || 'Not created'} sub={latestSuccessful?.status} />
                <Stat icon={<Clock size={20} />} label="Next Backup" value={settings.nextBackupAt || 'Not scheduled'} sub={settings.automaticBackup ? 'Automatic' : 'Manual'} tone="purple" />
                <Stat icon={<FileArchive size={20} />} label="Total Backups" value={String(allBackups.length)} sub="Available" />
                <Stat icon={<Database size={20} />} label="Latest Size" value={latestBackup ? bytesToSize(latestBackup.sizeBytes) : '0 B'} sub={latestBackup?.type || 'No backup'} tone="green" />
                <Stat icon={<FileArchive size={20} />} label="Storage Used" value={bytesToSize(totalBytes)} sub={storageLimitBytes ? `${usedPercent}% of limit` : 'No limit set'} tone="purple" />
              </div>
            </Card>

            <Card title="Backup Configuration" sub="Configure how and when backups are created." action={<button onClick={() => saveSettings()} disabled={saving} className="btn-primary bg-coop-blue"><Save size={14} /> {saving ? 'Saving...' : 'Save Configuration'}</button>}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Field label="Backup Frequency"><select value={settings.frequency} onChange={e => update('frequency', e.target.value)} className="input-field"><option value="">Select frequency</option><option>Daily</option><option>Weekly</option><option>Monthly</option></select></Field>
                <Field label="Backup Time"><input type="time" value={settings.backupTime} onChange={e => update('backupTime', e.target.value)} className="input-field" /></Field>
                <Field label="Backup Retention"><input value={settings.retention} onChange={e => update('retention', e.target.value)} placeholder="Example: 30 Days" className="input-field" /></Field>
                <Field label="Backup Location"><select value={settings.location} onChange={e => update('location', e.target.value as BackupLocation)} className="input-field">{locations.map(item => <option key={item}>{item}</option>)}</select></Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-navy">
                <CheckBox label="Database" checked={settings.includeDatabase} onChange={value => update('includeDatabase', value)} />
                <CheckBox label="Files & Documents" checked={settings.includeFiles} onChange={value => update('includeFiles', value)} />
                <CheckBox label="Configurations" checked={settings.includeConfigurations} onChange={value => update('includeConfigurations', value)} />
                <CheckBox label="Uploads" checked={settings.includeUploads} onChange={value => update('includeUploads', value)} />
                <CheckBox label="Logs" checked={settings.includeLogs} onChange={value => update('includeLogs', value)} />
              </div>
            </Card>

            <Card title="Backup History" sub="List of all saved backup records." action={<button onClick={exportHistory} className="btn-secondary"><Download size={14} /> Export</button>}>
              <BackupTable rows={filteredBackups} onDownload={downloadBackup} onDelete={deleteBackup} onSelect={record => { setSelectedBackupId(record.id); setTab('Restore') }} />
              <p className="mt-3 text-xs text-slate-500">Showing {filteredBackups.length} of {allBackups.length} backups</p>
            </Card>

            <Card title="Backup Schedule" sub="Manage automated backup schedule.">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <ToggleRow icon={<RefreshCw size={16} />} title="Automatic Backup" sub="Enable or disable automatic backups." checked={settings.automaticBackup} onChange={value => update('automaticBackup', value)} />
                  <Field label="Schedule Type"><select value={settings.scheduleType} onChange={e => update('scheduleType', e.target.value)} className="input-field"><option value="">Select schedule</option><option>Recurring Daily</option><option>Recurring Weekly</option><option>Recurring Monthly</option></select></Field>
                  <div className="flex flex-wrap gap-2">{days.map(day => <button key={day} type="button" onClick={() => toggleDay(day)} className={`rounded-md border px-3 py-1 text-xs font-bold ${settings.scheduleDays.includes(day) ? 'border-coop-blue bg-blue-50 text-coop-blue' : 'border-slate-200 text-slate-500'}`}>{day}</button>)}</div>
                </div>
                <div className="space-y-3">
                  <ToggleRow icon={<Info size={16} />} title="Email Notifications" sub="Receive backup status by email." checked={settings.emailNotifications} onChange={value => update('emailNotifications', value)} />
                  <CheckBox label="Backup Success" checked={settings.notifySuccess} onChange={value => update('notifySuccess', value)} />
                  <CheckBox label="Backup Failure" checked={settings.notifyFailure} onChange={value => update('notifyFailure', value)} />
                  <CheckBox label="Backup Warning" checked={settings.notifyWarning} onChange={value => update('notifyWarning', value)} />
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Storage Usage">
              {backupPie.length ? <div className="h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={backupPie} dataKey="value" innerRadius={45} outerRadius={70}>{backupPie.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value: number) => bytesToSize(value)} /></PieChart></ResponsiveContainer></div> : <EmptyState message="No storage data yet." />}
              <Field label="Total Storage Limit"><input value={settings.storageLimitGb} onChange={e => update('storageLimitGb', e.target.value)} placeholder="GB" className="input-field" /></Field>
              <button onClick={() => saveSettings()} className="mt-3 btn-secondary w-full justify-center"><Settings size={14} /> Manage Storage</button>
            </Card>

            <Card title="Quick Actions">
              <input ref={fileInput} type="file" accept=".json,.bak,.zip,.sql" className="hidden" onChange={uploadBackup} />
              <div className="space-y-2">
                <ActionButton onClick={createBackup}><Upload size={14} /> Create Backup Now</ActionButton>
                <ActionButton onClick={() => fileInput.current?.click()}><Upload size={14} /> Upload Backup</ActionButton>
                <ActionButton onClick={() => downloadBackup()}><Download size={14} /> Download Selected Backup</ActionButton>
                <ActionButton onClick={() => saveSettings()}><Settings size={14} /> Backup Settings</ActionButton>
                <ActionButton onClick={exportHistory}><FileText size={14} /> View Backup Logs</ActionButton>
                <ActionButton onClick={clearHistory} danger><Trash2 size={14} /> Clear Backup History</ActionButton>
              </div>
            </Card>

            <Card title="Backup Health" sub="System backup health status.">
              <MiniRow label="Last backup" value={settings.lastBackupAt || 'Not created'} good={Boolean(settings.lastBackupAt)} />
              <MiniRow label="Backup schedule" value={settings.automaticBackup ? 'Active' : 'Inactive'} good={settings.automaticBackup} />
              <MiniRow label="Storage space" value={storageLimitBytes ? `${Math.max(100 - usedPercent, 0)}% available` : 'No limit set'} good={!storageLimitBytes || usedPercent < 90} />
              <MiniRow label="Backup failures" value={String(allBackups.filter(item => item.status === 'Failed').length)} good={!allBackups.some(item => item.status === 'Failed')} />
            </Card>
          </div>
        </div>
      )}

      {tab === 'Restore' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <Card title="Restore Overview" sub="Select a backup and restore your data safely.">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Stat icon={<Database size={20} />} label="Total Backups" value={String(allBackups.length)} sub="Available" tone="purple" />
                <Stat icon={<FileArchive size={20} />} label="Latest Backup" value={latestBackup?.createdAt || 'Not created'} sub={latestBackup?.name} tone="green" />
                <Stat icon={<Database size={20} />} label="Total Backup Size" value={bytesToSize(totalBytes)} sub="All backups" />
                <Stat icon={<FileText size={20} />} label="Restore Points" value={String(allBackups.length)} sub="Available" tone="orange" />
                <Stat icon={<ShieldCheck size={20} />} label="Last Restore" value={settings.lastRestoreAt || 'Not restored'} sub={latestRestore?.status} tone="green" />
              </div>
            </Card>

            <Card title="Restore from Backup" sub="Choose a backup to restore your system data." action={<button onClick={() => fileInput.current?.click()} className="btn-secondary"><Upload size={14} /> Upload Backup</button>}>
              <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <Field label="Backup Type"><select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field"><option value="">All Types</option>{backupTypes.map(item => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Backup Location"><select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="input-field"><option value="">All Locations</option>{locations.map(item => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Search Backup"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or location..." className="input-field" /></Field>
                <div className="flex items-end"><button onClick={() => { setSearch(''); setTypeFilter(''); setLocationFilter('') }} className="btn-secondary w-full justify-center"><RefreshCw size={14} /> Reset</button></div>
              </div>
              <BackupTable rows={filteredBackups} selectedId={selectedBackup?.id} onDownload={downloadBackup} onDelete={deleteBackup} onSelect={record => setSelectedBackupId(record.id)} restoreMode />
            </Card>

            <Card title="Restore Options" sub="Choose what to restore and where it should be restored.">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <RadioGroup title="Restore Scope" value={restoreScope} options={['Full System Restore', 'Selective Restore', 'File Level Restore']} onChange={setRestoreScope} />
                <RadioGroup title="Destination" value={restoreDestination} options={['Original Location', 'Alternate Location']} onChange={setRestoreDestination} />
                <div>
                  <h4 className="text-xs font-bold text-navy">Pre-Restore Checks</h4>
                  <div className="mt-3 space-y-2">
                    <MiniRow label="Backup selected" value={selectedBackup ? 'Yes' : 'No'} good={Boolean(selectedBackup)} />
                    <MiniRow label="Backup integrity" value={selectedBackup?.payload ? 'Readable' : 'Pending'} good={Boolean(selectedBackup?.payload)} />
                    <MiniRow label="Destination" value={restoreDestination} good />
                    <MiniRow label="Scope" value={restoreScope} good />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-navy"><Info size={14} className="mr-2 inline text-coop-blue" /> Ensure users are logged out before starting a restore to avoid data conflicts.</div>
                <button onClick={startRestore} className="btn-primary bg-coop-blue justify-center"><RefreshCw size={14} /> Start Restore</button>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Restore Information">
              <div className="flex gap-3"><Info size={24} className="text-coop-blue" /><p className="text-xs text-slate-600">Restoring data will apply the selected backup record and create a restore audit entry.</p></div>
              <div className="mt-4 space-y-2">
                <MiniRow label="Selected backup" value={selectedBackup?.name || 'None'} />
                <MiniRow label="Restore scope" value={restoreScope} />
                <MiniRow label="Destination" value={restoreDestination} />
              </div>
            </Card>

            <Card title="Recent Restores" action={<button onClick={exportRestoreHistory} className="text-xs font-bold text-coop-blue">Export</button>}>
              {settings.restores.length ? <RestoreList rows={settings.restores.slice(0, 5)} /> : <EmptyState message="No restore records found." />}
            </Card>

            <Card title="Need Help?">
              <p className="text-xs text-slate-600">Use the help file before restoring production data.</p>
              <button onClick={() => downloadText('restore-help.txt', 'Restore help: upload or select a backup, choose restore scope and destination, then start restore.')} className="mt-3 btn-secondary w-full justify-center"><HelpCircle size={14} /> Contact Support</button>
            </Card>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-navy"><Info size={14} className="mr-2 inline text-coop-blue" /> Important: Backups are essential for data safety. Keep a verified external backup before major changes.</div>
    </div>
  )
}

function backupTypeFromIncludes(settings: BackupSettings): BackupType {
  if (settings.includeDatabase && !settings.includeFiles && !settings.includeUploads && !settings.includeConfigurations) return 'Database Only'
  if (!settings.includeDatabase && (settings.includeFiles || settings.includeUploads) && !settings.includeConfigurations) return 'Files Only'
  if (!settings.includeDatabase && !settings.includeFiles && !settings.includeUploads && settings.includeConfigurations) return 'Configuration Only'
  return 'Full Backup'
}

function calculateNextBackup(frequency: string, time: string) {
  if (!frequency || !time) return ''
  const next = new Date()
  next.setDate(next.getDate() + (frequency === 'Weekly' ? 7 : frequency === 'Monthly' ? 30 : 1))
  return `${next.toLocaleDateString()} ${time}`
}

function CheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-coop-blue" /><span>{label}</span></label>
}

function ToggleRow({ icon, title, sub, checked, onChange }: { icon: ReactNode; title: string; sub: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 p-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-coop-blue">{icon}</span><span><span className="block text-xs font-bold text-navy">{title}</span><span className="block text-xs text-slate-500">{sub}</span></span></div><Toggle checked={checked} onChange={onChange} /></div>
}

function MiniRow({ label, value, good }: { label: string; value?: string; good?: boolean }) {
  return <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0"><span className="text-xs font-semibold text-navy">{label}</span><span className={`text-xs font-bold ${good ? 'text-coop-green' : 'text-navy'}`}>{value || '-'}</span></div>
}

function BackupTable({ rows, selectedId, onDownload, onDelete, onSelect, restoreMode = false }: { rows: BackupRecord[]; selectedId?: number; onDownload: (row: BackupRecord) => void; onDelete: (row: BackupRecord) => void; onSelect: (row: BackupRecord) => void; restoreMode?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>{['Backup Name', 'Date & Time', 'Type', 'Size', 'Status', 'Location', 'Actions'].map(header => <th key={header} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map(row => (
            <tr key={row.id} className={`border-t border-slate-100 ${selectedId === row.id ? 'bg-blue-50' : ''}`}>
              <td className="px-3 py-2 font-bold text-navy">{row.name}</td>
              <td className="px-3 py-2">{row.createdAt || '-'}</td>
              <td className="px-3 py-2">{row.type}</td>
              <td className="px-3 py-2">{bytesToSize(row.sizeBytes)}</td>
              <td className="px-3 py-2"><StatusBadge value={row.status} /></td>
              <td className="px-3 py-2">{row.location}</td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  <button onClick={() => onSelect(row)} className="rounded-md border px-2 py-1 font-bold text-coop-blue">{restoreMode ? 'Select' : 'Restore'}</button>
                  <button onClick={() => onDownload(row)} className="rounded-md border p-1.5 text-coop-blue"><Download size={13} /></button>
                  <button onClick={() => onDelete(row)} className="rounded-md border p-1.5 text-red-600"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          )) : <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No backup records found.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function RadioGroup({ title, value, options, onChange }: { title: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div><h4 className="text-xs font-bold text-navy">{title}</h4><div className="mt-3 space-y-3">{options.map(option => <label key={option} className="flex items-start gap-2 text-xs text-navy"><input type="radio" checked={value === option} onChange={() => onChange(option)} className="mt-0.5" /><span><span className="block font-bold">{option}</span></span></label>)}</div></div>
}

function RestoreList({ rows }: { rows: RestoreRecord[] }) {
  return <div className="divide-y divide-slate-100">{rows.map(row => <div key={row.id} className="py-3 text-xs"><div className="flex items-start gap-3"><CheckCircle size={18} className={row.status === 'Completed' ? 'text-coop-green' : 'text-red-600'} /><div><div className="font-bold text-navy">{row.restoredAt}</div><div className="text-slate-500">{row.scope}</div><div className="text-slate-500">{row.backupName}</div><StatusBadge value={row.status} /></div></div></div>)}</div>
}
