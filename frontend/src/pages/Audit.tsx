import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Calendar, ChevronLeft, ChevronRight, Download, Edit, FileText, Filter, RefreshCw, Search, Settings, ShieldCheck, Trash2, Users } from 'lucide-react'
import { actionBadge } from '../components/ui/Badge'
import { auditApi } from '../services/api'
import type { AuditLog } from '../types'

const today = new Date().toISOString().slice(0, 10)
const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

function StatBox({ icon, label, value, sub, tone, border }: { icon: ReactNode; label: string; value: number | string; sub: string; tone: string; border: string }) {
  return (
    <div className={`bg-white border ${border} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs text-navy font-medium">{label}</div>
          <div className="text-2xl font-bold text-navy mt-1">{value}</div>
          <div className="text-xs text-slate-500 mt-1">{sub}</div>
        </div>
      </div>
    </div>
  )
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function formatDateTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function Audit() {
  const navigate = useNavigate()
  const [module, setModule] = useState('All Modules')
  const [action, setAction] = useState('All Actions')
  const [staff, setStaff] = useState('All Staff')
  const [search, setSearch] = useState('')
  const [quickSearch, setQuickSearch] = useState('')
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [ip, setIp] = useState('')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const pageSize = 10

  const loadLogs = async () => {
    try {
      setLoading(true)
      const result = await auditApi.logs({
        from,
        to,
        module: module === 'All Modules' ? undefined : module,
        action: action === 'All Actions' ? undefined : action,
        search: search || quickSearch || undefined,
        ip: ip || undefined,
        limit: 500,
      })
      setLogs(result.data)
      setStats(result.stats)
      setPage(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLogs() }, [])

  const staffNames = useMemo(() => {
    const names = Array.from(new Set(logs.map(log => log.staffName).filter(Boolean)))
    return ['All Staff', ...names]
  }, [logs])

  const filteredLogs = useMemo(() => logs.filter(log => {
    const staffMatches = staff === 'All Staff' || log.staffName === staff
    const term = quickSearch.trim().toLowerCase()
    const quickMatches = !term || [log.staffName, log.action, log.module, log.description, log.oldValue, log.newValue, log.ipAddress].some(value => String(value || '').toLowerCase().includes(term))
    return staffMatches && quickMatches
  }), [logs, staff, quickSearch])

  const totalActivities = stats.TotalActivities ?? filteredLogs.length
  const activeUsers = stats.ActiveUsers ?? new Set(filteredLogs.map(log => log.staffName).filter(Boolean)).size
  const createActions = stats.CreateActions ?? filteredLogs.filter(log => log.action === 'CREATE').length
  const updateActions = stats.UpdateActions ?? filteredLogs.filter(log => log.action === 'UPDATE').length
  const deleteActions = stats.DeleteActions ?? filteredLogs.filter(log => log.action === 'DELETE').length
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize))
  const pagedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize)

  const exportAudit = () => {
    const headers = ['#', 'Date & Time', 'Staff Name', 'Action', 'Module', 'Description', 'Old Value', 'New Value', 'IP Address']
    const rows = filteredLogs.map((log, index) => [
      index + 1,
      formatDateTime(log.dateTime),
      log.staffName,
      log.action,
      log.module,
      log.description,
      log.oldValue || '-',
      log.newValue || '-',
      log.ipAddress || '-',
    ])
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-report-${from}-to-${to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const resetFilters = () => {
    setModule('All Modules')
    setAction('All Actions')
    setStaff('All Staff')
    setSearch('')
    setQuickSearch('')
    setIp('')
    setFrom(monthStart)
    setTo(today)
    setPage(1)
  }

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Audit Trail</h2>
          <p className="text-sm text-slate-500 mt-1">View all system activities and changes made by users.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportAudit} disabled={!filteredLogs.length} className="btn-secondary disabled:opacity-50"><Download size={14} /> Export Report</button>
          <button onClick={() => navigate('/settings/security')} className="btn-primary bg-navy"><Settings size={14} /> Audit Settings</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatBox icon={<FileText size={22} className="text-blue-700" />} tone="bg-blue-100" border="border-blue-100" label="Total Activities" value={totalActivities} sub="This Period" />
        <StatBox icon={<Users size={22} className="text-green-700" />} tone="bg-green-100" border="border-green-100" label="Active Users" value={activeUsers} sub="This Period" />
        <StatBox icon={<ShieldCheck size={22} className="text-purple-700" />} tone="bg-purple-100" border="border-purple-100" label="Create Actions" value={createActions} sub={`${totalActivities ? ((createActions / totalActivities) * 100).toFixed(2) : '0.00'}%`} />
        <StatBox icon={<Edit size={22} className="text-orange-700" />} tone="bg-orange-100" border="border-orange-100" label="Update Actions" value={updateActions} sub={`${totalActivities ? ((updateActions / totalActivities) * 100).toFixed(2) : '0.00'}%`} />
        <StatBox icon={<Trash2 size={22} className="text-red-700" />} tone="bg-red-100" border="border-red-100" label="Delete Actions" value={deleteActions} sub={`${totalActivities ? ((deleteActions / totalActivities) * 100).toFixed(2) : '0.00'}%`} />
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
            <div className="relative">
              <input type="date" value={from} onChange={event => setFrom(event.target.value)} className="input-field pr-9" />
              <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
            <div className="relative">
              <input type="date" value={to} onChange={event => setTo(event.target.value)} className="input-field pr-9" />
              <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Staff</label>
            <select value={staff} onChange={event => { setStaff(event.target.value); setPage(1) }} className="input-field">
              {staffNames.map(name => <option key={name}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Module</label>
            <select value={module} onChange={event => setModule(event.target.value)} className="input-field">
              {['All Modules', 'Accounts', 'Staff Management', 'Trading Account', 'Trial Balance', 'Management', 'Reports', 'Settings', 'Authentication'].map(option => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Action Type</label>
            <select value={action} onChange={event => setAction(event.target.value)} className="input-field">
              {['All Actions', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT'].map(option => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">IP Address</label>
            <input value={ip} onChange={event => setIp(event.target.value)} className="input-field" placeholder="All IP Addresses" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
          <div className="relative lg:col-span-7">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} className="input-field pl-9" placeholder="Search by description, old or new value..." />
          </div>
          <div className="lg:col-span-5 flex gap-3 lg:justify-end">
            <button onClick={loadLogs} disabled={loading} className="btn-primary bg-navy disabled:opacity-60"><Filter size={14} /> {loading ? 'Loading...' : 'Apply Filters'}</button>
            <button onClick={resetFilters} className="btn-secondary"><RefreshCw size={14} /> Reset</button>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-navy">Audit Log</h3>
          <div className="relative w-full sm:w-96">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={quickSearch} onChange={event => { setQuickSearch(event.target.value); setPage(1) }} className="input-field pl-9" placeholder="Search by staff name, action or module..." />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full">
            <thead>
              <tr>
                {['#', 'Date & Time', 'Staff Name', 'Action', 'Module', 'Description', 'Old Value', 'New Value', 'IP Address'].map(header => (
                  <th key={header} className="text-left text-xs font-bold text-navy px-4 py-3 bg-slate-50 whitespace-nowrap">{header}{header === 'Date & Time' && <span className="ml-1">v</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedLogs.map((log, index) => (
                <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-navy">{(page - 1) * pageSize + index + 1}</td>
                  <td className="px-4 py-3 text-xs text-navy whitespace-nowrap">{formatDateTime(log.dateTime)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{log.staffName.charAt(0) || '?'}</span>
                      </div>
                      <span className="text-sm font-medium text-navy whitespace-nowrap">{log.staffName || 'System'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{actionBadge(log.action)}</td>
                  <td className="px-4 py-3 text-sm text-navy whitespace-nowrap">{log.module || '-'}</td>
                  <td className="px-4 py-3 text-sm text-navy min-w-[220px]">{log.description || '-'}</td>
                  <td className="px-4 py-3 text-sm text-navy">{log.oldValue || '-'}</td>
                  <td className="px-4 py-3 text-sm text-navy">{log.newValue || '-'}</td>
                  <td className="px-4 py-3 text-xs font-mono text-navy whitespace-nowrap">{log.ipAddress || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagedLogs.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No audit logs found.</div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <span className="text-sm text-navy">Showing {filteredLogs.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredLogs.length)} of {filteredLogs.length} entries</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={14} /></button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
              const pageNo = index + 1
              return <button key={pageNo} onClick={() => setPage(pageNo)} className={`w-9 h-9 rounded-lg border text-sm font-semibold ${page === pageNo ? 'bg-navy text-white border-navy' : 'border-slate-200 text-navy'}`}>{pageNo}</button>
            })}
            {totalPages > 5 && <span className="text-sm text-slate-400 px-1">...</span>}
            {totalPages > 5 && <button onClick={() => setPage(totalPages)} className={`w-9 h-9 rounded-lg border text-sm font-semibold ${page === totalPages ? 'bg-navy text-white border-navy' : 'border-slate-200 text-navy'}`}>{totalPages}</button>}
            <button onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={14} /></button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.
      </footer>
    </div>
  )
}
