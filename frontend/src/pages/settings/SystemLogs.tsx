import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Download, Eye, FileText, Filter, Info, RefreshCw, Settings, ShieldAlert, Trash2, XCircle } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import Badge from '../../components/ui/Badge'
import { auditApi, settingsApi } from '../../services/api'
import type { AuditLog } from '../../types'

type LogLevel = 'info' | 'warning' | 'error' | 'critical'
type LogCategory = 'Login & Access' | 'Data Changes' | 'System Events' | 'Security' | 'Errors'
type RetentionSettings = { days: number; autoArchive: boolean }

const today = new Date().toISOString().slice(0, 10)
const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
const defaultRetention: RetentionSettings = { days: 90, autoArchive: true }
const levelColors: Record<LogLevel, string> = { info: '#2563EB', warning: '#F59E0B', error: '#EF4444', critical: '#DC2626' }

function deriveLevel(log: AuditLog): LogLevel {
  const text = `${log.action} ${log.module} ${log.description}`.toLowerCase()
  if (text.includes('critical') || text.includes('disk') || text.includes('delete')) return 'critical'
  if (text.includes('failed') || text.includes('error')) return 'error'
  if (text.includes('warning') || text.includes('password') || text.includes('low')) return 'warning'
  return 'info'
}

function deriveCategory(log: AuditLog): LogCategory {
  const text = `${log.action} ${log.module} ${log.description}`.toLowerCase()
  if (text.includes('login') || text.includes('logout')) return 'Login & Access'
  if (text.includes('security') || text.includes('password') || text.includes('permission')) return 'Security'
  if (text.includes('error') || text.includes('failed')) return 'Errors'
  if (['create', 'update', 'delete'].includes(log.action.toLowerCase())) return 'Data Changes'
  return 'System Events'
}

function levelVariant(level: LogLevel): 'blue' | 'orange' | 'red' {
  if (level === 'info') return 'blue'
  if (level === 'warning') return 'orange'
  return 'red'
}

function categoryVariant(category: LogCategory): 'blue' | 'green' | 'orange' | 'purple' | 'red' {
  if (category === 'Login & Access') return 'purple'
  if (category === 'Data Changes') return 'green'
  if (category === 'Security') return 'orange'
  if (category === 'Errors') return 'red'
  return 'blue'
}

function formatDateTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function StatCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: number; sub: string; tone: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-4">
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>{icon}</span>
        <span>
          <span className="block text-sm font-semibold text-navy">{label}</span>
          <span className="block text-2xl font-bold text-navy mt-1">{value.toLocaleString()}</span>
          <span className="block text-xs text-slate-500 mt-1">{sub}</span>
        </span>
      </div>
    </div>
  )
}

export default function SystemLogs() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [level, setLevel] = useState<'All Levels' | LogLevel>('All Levels')
  const [category, setCategory] = useState<'All Categories' | LogCategory>('All Categories')
  const [userFilter, setUserFilter] = useState('All Users')
  const [ip, setIp] = useState('')
  const [keyword, setKeyword] = useState('')
  const [activeTab, setActiveTab] = useState<'All Logs' | LogCategory>('All Logs')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [retention, setRetention] = useState<RetentionSettings>(defaultRetention)
  const [showRetention, setShowRetention] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadLogs = async () => {
    try {
      setLoading(true)
      const result = await auditApi.logs({ from, to, ip: ip || undefined, search: keyword || undefined, limit: 1000 })
      setLogs(result.data)
      setSelectedIds([])
      setPage(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load system logs')
    } finally {
      setLoading(false)
    }
  }

  const loadRetention = async () => {
    try {
      const saved = await settingsApi.get<RetentionSettings>('log-retention')
      setRetention({ ...defaultRetention, ...saved })
    } catch {
      toast.error('Could not load log retention settings')
    }
  }

  useEffect(() => { loadLogs(); loadRetention() }, [])

  const enrichedLogs = useMemo(() => logs.map(log => ({ ...log, level: deriveLevel(log), category: deriveCategory(log) })), [logs])
  const users = useMemo(() => ['All Users', ...Array.from(new Set(enrichedLogs.map(log => log.staffName || 'System')))], [enrichedLogs])

  const filteredLogs = useMemo(() => enrichedLogs.filter(log => {
    const tabMatches = activeTab === 'All Logs' || log.category === activeTab
    const levelMatches = level === 'All Levels' || log.level === level
    const categoryMatches = category === 'All Categories' || log.category === category
    const userMatches = userFilter === 'All Users' || (log.staffName || 'System') === userFilter
    const ipMatches = !ip || log.ipAddress.includes(ip)
    const term = keyword.trim().toLowerCase()
    const keywordMatches = !term || [log.description, log.oldValue, log.newValue, log.module, log.action, log.staffName, log.ipAddress].some(value => String(value || '').toLowerCase().includes(term))
    return tabMatches && levelMatches && categoryMatches && userMatches && ipMatches && keywordMatches
  }), [enrichedLogs, activeTab, level, category, userFilter, ip, keyword])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize))
  const pagedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize)
  const infoCount = enrichedLogs.filter(log => log.level === 'info').length
  const warningCount = enrichedLogs.filter(log => log.level === 'warning').length
  const errorCount = enrichedLogs.filter(log => log.level === 'error').length
  const criticalCount = enrichedLogs.filter(log => log.level === 'critical').length
  const summaryData = [
    { name: 'Info', value: infoCount, color: levelColors.info },
    { name: 'Warning', value: warningCount, color: levelColors.warning },
    { name: 'Error', value: errorCount, color: levelColors.error },
    { name: 'Critical', value: criticalCount, color: levelColors.critical },
  ].filter(item => item.value > 0)

  const exportLogs = (rows = filteredLogs, filename = 'system-logs.csv') => {
    const headers = ['Date & Time', 'Level', 'Category', 'Event Description', 'User', 'IP Address', 'Action', 'Old Value', 'New Value']
    const body = rows.map(log => [formatDateTime(log.dateTime), log.level, log.category, log.description, log.staffName || 'System', log.ipAddress, log.action, log.oldValue || '', log.newValue || ''])
    const csv = [headers, ...body].map(row => row.map(csvEscape).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const runBulkAction = (action: string) => {
    const selected = filteredLogs.filter(log => selectedIds.includes(log.id))
    if (!selected.length) {
      toast.error('Select at least one log')
      return
    }
    if (action === 'export') exportLogs(selected, 'selected-system-logs.csv')
    if (action === 'copy') {
      navigator.clipboard?.writeText(selected.map(log => `${formatDateTime(log.dateTime)} ${log.level.toUpperCase()} ${log.description}`).join('\n'))
      toast.success('Selected logs copied')
    }
  }

  const clearFilters = () => {
    setFrom(monthStart)
    setTo(today)
    setLevel('All Levels')
    setCategory('All Categories')
    setUserFilter('All Users')
    setIp('')
    setKeyword('')
    setActiveTab('All Logs')
    setPage(1)
  }

  const saveRetention = async () => {
    try {
      const saved = await settingsApi.save<RetentionSettings>('log-retention', retention)
      setRetention(saved)
      setShowRetention(false)
      toast.success('Log retention settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save retention settings')
    }
  }

  const clearOldLogs = async () => {
    try {
      const result = await auditApi.clearOld(retention.days)
      toast.success(`${result.deleted} old log(s) cleared`)
      loadLogs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not clear old logs')
    }
  }

  const toggleSelected = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  const toggleAllPage = () => {
    const pageIds = pagedLogs.map(log => log.id)
    const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))
    setSelectedIds(prev => allSelected ? prev.filter(id => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds])))
  }

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div>
        <h2 className="text-xl font-bold text-navy">System Logs</h2>
        <p className="text-sm text-slate-500 mt-1">View and monitor all system activities and events.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard icon={<FileText size={22} className="text-blue-700" />} label="All Logs" value={enrichedLogs.length} sub="Loaded logs" tone="bg-blue-100" />
        <StatCard icon={<Calendar size={22} className="text-blue-700" />} label="Today's Logs" value={enrichedLogs.filter(log => log.dateTime?.slice(0, 10) === today).length} sub="Today" tone="bg-blue-100" />
        <StatCard icon={<Info size={22} className="text-blue-700" />} label="Info" value={infoCount} sub={`${enrichedLogs.length ? ((infoCount / enrichedLogs.length) * 100).toFixed(1) : '0.0'}%`} tone="bg-blue-100" />
        <StatCard icon={<AlertTriangle size={22} className="text-orange-700" />} label="Warning" value={warningCount} sub={`${enrichedLogs.length ? ((warningCount / enrichedLogs.length) * 100).toFixed(1) : '0.0'}%`} tone="bg-orange-100" />
        <StatCard icon={<XCircle size={22} className="text-red-700" />} label="Error" value={errorCount} sub={`${enrichedLogs.length ? ((errorCount / enrichedLogs.length) * 100).toFixed(1) : '0.0'}%`} tone="bg-red-100" />
        <StatCard icon={<ShieldAlert size={22} className="text-red-700" />} label="Critical" value={criticalCount} sub={`${enrichedLogs.length ? ((criticalCount / enrichedLogs.length) * 100).toFixed(1) : '0.0'}%`} tone="bg-red-100" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-5">
        <div className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
              {(['All Logs', 'Login & Access', 'Data Changes', 'System Events', 'Security', 'Errors'] as Array<'All Logs' | LogCategory>).map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); setPage(1) }} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === tab ? 'text-coop-blue border-coop-blue' : 'text-navy border-transparent hover:text-coop-blue'}`}>{tab}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-4">
              <div className="flex items-center gap-3">
                <select onChange={event => event.target.value && runBulkAction(event.target.value)} className="input-field w-40">
                  <option value="">Bulk Actions</option>
                  <option value="export">Export Selected</option>
                  <option value="copy">Copy Selected</option>
                </select>
                <span className="text-sm text-slate-500">{selectedIds.length} items selected</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={loadLogs} disabled={loading} className="btn-secondary disabled:opacity-60"><RefreshCw size={14} /> {loading ? 'Loading...' : 'Refresh'}</button>
                <button onClick={() => exportLogs()} className="btn-secondary"><Download size={14} /> Export</button>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 bg-slate-50"><input type="checkbox" checked={pagedLogs.length > 0 && pagedLogs.every(log => selectedIds.includes(log.id))} onChange={toggleAllPage} /></th>
                    {['Date & Time', 'Level', 'Category', 'Event Description', 'User', 'IP Address', 'Action'].map(header => (
                      <th key={header} className="text-left text-xs font-bold text-navy px-4 py-3 bg-slate-50 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedLogs.map(log => (
                    <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(log.id)} onChange={() => toggleSelected(log.id)} /></td>
                      <td className="px-4 py-3 text-sm text-navy whitespace-nowrap">{formatDateTime(log.dateTime)}</td>
                      <td className="px-4 py-3"><Badge label={log.level.charAt(0).toUpperCase() + log.level.slice(1)} variant={levelVariant(log.level)} /></td>
                      <td className="px-4 py-3"><Badge label={log.category} variant={categoryVariant(log.category)} /></td>
                      <td className="px-4 py-3 text-sm text-navy min-w-[240px]">{log.description || '-'}</td>
                      <td className="px-4 py-3 text-sm text-navy whitespace-nowrap">{log.staffName || 'System'}</td>
                      <td className="px-4 py-3 text-sm text-navy font-mono whitespace-nowrap">{log.ipAddress || '-'}</td>
                      <td className="px-4 py-3"><button onClick={() => setSelectedLog(log)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" title="View log"><Eye size={13} className="text-coop-blue" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pagedLogs.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No system logs found.</div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <span className="text-sm text-navy">Showing {filteredLogs.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredLogs.length)} of {filteredLogs.length} logs</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
                  const pageNo = index + 1
                  return <button key={pageNo} onClick={() => setPage(pageNo)} className={`w-9 h-9 rounded-lg border text-sm font-semibold ${page === pageNo ? 'bg-coop-blue text-white border-coop-blue' : 'border-slate-200 text-navy'}`}>{pageNo}</button>
                })}
                <button onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={14} /></button>
                <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} className="input-field w-28">
                  {[10, 25, 50].map(size => <option key={size} value={size}>{size} / page</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3">
              <Info size={20} className="text-coop-blue mt-0.5" />
              <div>
                <h3 className="font-bold text-navy">About System Logs</h3>
                <p className="text-sm text-navy/80 mt-1">System logs help you track activities, troubleshoot issues, and support security and compliance.</p>
              </div>
            </div>
            <button onClick={() => setShowRetention(true)} className="btn-secondary"><Settings size={14} /> Log Retention Settings</button>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy flex items-center gap-2"><Filter size={17} className="text-coop-blue" /> Filter Logs</h3>
              <button onClick={clearFilters} className="text-xs font-semibold text-coop-blue">Clear</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={from} onChange={event => setFrom(event.target.value)} className="input-field" />
                <input type="date" value={to} onChange={event => setTo(event.target.value)} className="input-field" />
              </div>
              <select value={level} onChange={event => setLevel(event.target.value as 'All Levels' | LogLevel)} className="input-field">
                <option>All Levels</option><option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option><option value="critical">Critical</option>
              </select>
              <select value={category} onChange={event => setCategory(event.target.value as 'All Categories' | LogCategory)} className="input-field">
                <option>All Categories</option><option>Login & Access</option><option>Data Changes</option><option>System Events</option><option>Security</option><option>Errors</option>
              </select>
              <select value={userFilter} onChange={event => setUserFilter(event.target.value)} className="input-field">{users.map(name => <option key={name}>{name}</option>)}</select>
              <input value={ip} onChange={event => setIp(event.target.value)} className="input-field" placeholder="Search IP address..." />
              <input value={keyword} onChange={event => setKeyword(event.target.value)} className="input-field" placeholder="Search in description..." />
              <button onClick={loadLogs} className="btn-primary bg-coop-blue w-full justify-center">Apply Filters</button>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">Log Summary</h3>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summaryData} dataKey="value" innerRadius={42} outerRadius={62}>
                    {summaryData.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-3">
              {summaryData.map(item => <div key={item.name} className="flex justify-between text-xs"><span>{item.name}</span><span className="font-bold text-navy">{item.value.toLocaleString()}</span></div>)}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={() => navigate('/audit')} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-semibold hover:bg-slate-50"><Eye size={15} className="text-green-700" /> View Audit Logs</button>
              <button onClick={() => exportLogs()} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-semibold hover:bg-slate-50"><Download size={15} className="text-coop-blue" /> Download Logs</button>
              <button onClick={clearOldLogs} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-semibold hover:bg-red-50 text-red-600"><Trash2 size={15} /> Clear Old Logs</button>
              <button onClick={() => setShowRetention(true)} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-semibold hover:bg-slate-50"><Settings size={15} className="text-orange-700" /> Log Retention Settings</button>
            </div>
          </section>
        </aside>
      </div>

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">&copy; {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.</footer>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-navy">Log Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm mt-5">
              <Detail label="Date & Time" value={formatDateTime(selectedLog.dateTime)} />
              <Detail label="Level" value={deriveLevel(selectedLog).toUpperCase()} />
              <Detail label="Category" value={deriveCategory(selectedLog)} />
              <Detail label="User" value={selectedLog.staffName || 'System'} />
              <Detail label="Action" value={selectedLog.action} />
              <Detail label="Module" value={selectedLog.module || '-'} />
              <Detail label="IP Address" value={selectedLog.ipAddress || '-'} />
              <Detail label="Description" value={selectedLog.description || '-'} wide />
              <Detail label="Old Value" value={selectedLog.oldValue || '-'} wide />
              <Detail label="New Value" value={selectedLog.newValue || '-'} wide />
            </div>
            <button onClick={() => setSelectedLog(null)} className="btn-primary bg-navy w-full justify-center mt-5">Close</button>
          </div>
        </div>
      )}

      {showRetention && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-navy">Log Retention Settings</h3>
            <label className="block text-sm font-medium text-slate-700 mt-5 mb-1">Keep logs for days</label>
            <input type="number" min={1} value={retention.days} onChange={event => setRetention(prev => ({ ...prev, days: Number(event.target.value) }))} className="input-field" />
            <label className="flex items-center gap-3 mt-4 text-sm text-navy"><input type="checkbox" checked={retention.autoArchive} onChange={event => setRetention(prev => ({ ...prev, autoArchive: event.target.checked }))} /> Auto archive old logs</label>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowRetention(false)} className="flex-1 btn-secondary justify-center">Cancel</button>
              <button onClick={saveRetention} className="flex-1 btn-primary bg-navy justify-center">Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? 'col-span-2' : ''}><div className="text-xs text-slate-400">{label}</div><div className="font-medium text-navy break-words">{value}</div></div>
}
