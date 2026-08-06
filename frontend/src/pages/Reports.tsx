import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BarChart3, Calendar, CheckCircle, ChevronRight, Download, Eye, FileText, Filter, MoreVertical, Plus, RefreshCw, Search, Settings, Shield, Trash2, XCircle } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { reportsApi, settingsApi } from '../services/api'
import type { Report } from '../types'

const currentYear = new Date().getFullYear()
const today = new Date().toISOString().slice(0, 10)
const monthStart = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

type ReportCategory = {
  name: string
  type: string
  description: string
  icon: ReactNode
  iconBg: string
}

type Schedule = {
  id: string
  name: string
  reportKind: string
  frequency: string
  time: string
  format: 'PDF' | 'Excel'
  recipients: string
  active: boolean
  createdAt: string
}

type ReportSchedulesSettings = { schedules: Schedule[] }

const categories: ReportCategory[] = [
  { name: 'Financial Reports', type: 'Financial', description: 'Reports on financial position, performance and cash flow.', icon: <FileText size={22} className="text-blue-700" />, iconBg: 'bg-blue-100' },
  { name: 'Accounting Reports', type: 'Accounting', description: 'General ledger, trial balance and account summaries.', icon: <BarChart3 size={22} className="text-green-700" />, iconBg: 'bg-green-100' },
  { name: 'Management Reports', type: 'Management', description: 'Performance, activity and management summary reports.', icon: <BarChart3 size={22} className="text-orange-700" />, iconBg: 'bg-orange-100' },
  { name: 'Audit Reports', type: 'Audit', description: 'Audit trails, system activities and compliance reports.', icon: <Shield size={22} className="text-purple-700" />, iconBg: 'bg-purple-100' },
  { name: 'Operational Reports', type: 'Operational', description: 'Daily operations, staff and departmental reports.', icon: <Settings size={22} className="text-teal-700" />, iconBg: 'bg-teal-100' },
]

function SummaryCard({ icon, label, value, sub, tone, border }: { icon: ReactNode; label: string; value: number; sub: string; tone: string; border: string }) {
  return (
    <div className={`bg-white border ${border} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${tone}`}>{icon}</div>
        <div>
          <div className="text-xs font-medium text-navy">{label}</div>
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

function safeDate(value: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function reportMatchesDate(report: Report, from: string, to: string) {
  if (!report.generatedOn) return true
  const date = new Date(report.generatedOn)
  if (Number.isNaN(date.getTime())) return true
  const fromDate = from ? new Date(`${from}T00:00:00`) : null
  const toDate = to ? new Date(`${to}T23:59:59`) : null
  return (!fromDate || date >= fromDate) && (!toDate || date <= toDate)
}

export default function Reports() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<Report[]>([])
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [type, setType] = useState('All Reports')
  const [department, setDepartment] = useState('All Departments')
  const [generatedBy, setGeneratedBy] = useState('All Users')
  const [search, setSearch] = useState('')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [downloaded, setDownloaded] = useState(0)
  const [failed, setFailed] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadReports = async () => {
    try {
      setLoading(true)
      const result = await reportsApi.list({
        type: type === 'All Reports' ? undefined : type,
        from,
        to,
        generatedBy: generatedBy === 'All Users' ? undefined : generatedBy,
        dept: department === 'All Departments' ? undefined : department,
      })
      setReports(result)
      const saved = await settingsApi.get<ReportSchedulesSettings>('report-schedules')
      setSchedules(saved.schedules || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReports() }, [])

  const users = useMemo(() => ['All Users', ...Array.from(new Set(reports.map(report => report.generatedBy).filter(Boolean)))], [reports])

  const filteredReports = useMemo(() => reports.filter(report => {
    const typeMatches = type === 'All Reports' || report.type === type
    const userMatches = generatedBy === 'All Users' || report.generatedBy === generatedBy
    const term = search.trim().toLowerCase()
    const searchMatches = !term || [report.name, report.type, report.period, report.generatedBy, report.format].some(value => String(value || '').toLowerCase().includes(term))
    return typeMatches && userMatches && reportMatchesDate(report, from, to) && searchMatches
  }), [reports, type, generatedBy, from, to, search])

  const generatedCount = filteredReports.length
  const scheduledCount = schedules.filter(schedule => schedule.active).length
  const popularReports = useMemo(() => Object.entries(filteredReports.reduce<Record<string, number>>((counts, report) => {
    counts[report.name] = (counts[report.name] || 0) + 1
    return counts
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5), [filteredReports])

  const generateTrialBalance = async () => {
    try {
      await reportsApi.generateTrialBalance({ from, to, format: 'PDF' })
      toast.success('Trial balance report generated')
      loadReports()
    } catch (err) {
      setFailed(count => count + 1)
      toast.error(err instanceof Error ? err.message : 'Unable to generate report')
    }
  }

  const generateIncomeExpense = async () => {
    try {
      await reportsApi.generateIncomeExpense({ from, to })
      toast.success('Income and expense report generated')
      loadReports()
    } catch (err) {
      setFailed(count => count + 1)
      toast.error(err instanceof Error ? err.message : 'Unable to generate report')
    }
  }

  const regenerateReport = async (report: Report) => {
    if (report.name.toLowerCase().includes('income') || report.type === 'Financial') {
      await generateIncomeExpense()
    } else {
      await generateTrialBalance()
    }
    setSelectedReport(null)
  }

  const exportReports = (rows = filteredReports, filename = 'reports.csv') => {
    const headers = ['Report Name', 'Report Type', 'Period', 'Generated By', 'Generated On', 'Format']
    const body = rows.map(report => [report.name, report.type, report.period, report.generatedBy, safeDate(report.generatedOn), report.format])
    const csv = [headers, ...body].map(row => row.map(csvEscape).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    setDownloaded(count => count + 1)
  }

  const exportSingleReport = (report: Report) => {
    const filename = `${report.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'report'}.csv`
    exportReports([report], filename)
  }

  const resetFilters = () => {
    setType('All Reports')
    setDepartment('All Departments')
    setGeneratedBy('All Users')
    setFrom(monthStart)
    setTo(today)
    setSearch('')
  }

  const openCategory = (categoryType: string) => {
    setType(categoryType)
    toast.success(`${categoryType} reports selected`)
  }

  const showAllReports = async () => {
    setType('All Reports')
    setDepartment('All Departments')
    setGeneratedBy('All Users')
    setFrom(monthStart)
    setTo(today)
    setSearch('')
    try {
      setLoading(true)
      const result = await reportsApi.list({})
      setReports(result)
      const saved = await settingsApi.get<ReportSchedulesSettings>('report-schedules')
      setSchedules(saved.schedules || [])
      toast.success('All reports loaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load reports')
    } finally {
      setLoading(false)
    }
  }

  const openPopularReport = (name: string) => {
    setSearch(name)
    toast.success(`${name} selected`)
  }

  const deleteSchedule = async (scheduleId: string) => {
    const nextSchedules = schedules.filter(schedule => schedule.id !== scheduleId)
    try {
      await settingsApi.save<ReportSchedulesSettings>('report-schedules', { schedules: nextSchedules })
      setSchedules(nextSchedules)
      toast.success('Schedule removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to remove schedule')
    }
  }

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div>
        <h2 className="text-xl font-bold text-navy">Reports</h2>
        <p className="text-sm text-slate-500 mt-1">Generate, view and export reports for analysis and decision making.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <SummaryCard icon={<FileText size={24} className="text-blue-700" />} tone="bg-blue-100" border="border-blue-100" label="Total Reports" value={reports.length} sub="This Month" />
        <SummaryCard icon={<CheckCircle size={24} className="text-green-700" />} tone="bg-green-100" border="border-green-100" label="Generated" value={generatedCount} sub="This Month" />
        <SummaryCard icon={<Calendar size={24} className="text-orange-700" />} tone="bg-orange-100" border="border-orange-100" label="Scheduled" value={scheduledCount} sub="Auto Reports" />
        <SummaryCard icon={<Download size={24} className="text-purple-700" />} tone="bg-purple-100" border="border-purple-100" label="Downloaded" value={downloaded} sub="This Session" />
        <SummaryCard icon={<XCircle size={24} className="text-red-700" />} tone="bg-red-100" border="border-red-100" label="Failed" value={failed} sub="This Session" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-4 space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Report Type</label>
                <select value={type} onChange={event => setType(event.target.value)} className="input-field">
                  <option>All Reports</option>
                  <option>Financial</option>
                  <option>Accounting</option>
                  <option>Management</option>
                  <option>Audit</option>
                  <option>Operational</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date From</label>
                <input type="date" value={from} onChange={event => setFrom(event.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date To</label>
                <input type="date" value={to} onChange={event => setTo(event.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                <select value={department} onChange={event => setDepartment(event.target.value)} className="input-field">
                  <option>All Departments</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Generated By</label>
                <select value={generatedBy} onChange={event => setGeneratedBy(event.target.value)} className="input-field">
                  {users.map(user => <option key={user}>{user}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={loadReports} disabled={loading} className="btn-primary bg-navy flex-1 justify-center disabled:opacity-60"><Filter size={14} /> {loading ? 'Loading...' : 'Apply Filters'}</button>
                <button onClick={resetFilters} className="btn-secondary"><RefreshCw size={14} /> Reset</button>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">Report Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {categories.map(category => {
                const count = reports.filter(report => report.type === category.type).length
                return (
                  <div key={category.type} className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${category.iconBg}`}>{category.icon}</div>
                    <h4 className="font-bold text-navy mt-4">{category.name}</h4>
                    <p className="text-xs text-slate-500 mt-2 min-h-[42px]">{category.description}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs font-semibold text-slate-500">{count} Reports</span>
                      <button onClick={() => openCategory(category.type)} className="text-xs font-semibold text-coop-blue inline-flex items-center gap-1">View Reports <ChevronRight size={13} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-bold text-navy">Recent Reports</h3>
              <div className="relative w-full sm:w-80">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={event => setSearch(event.target.value)} className="input-field pl-9" placeholder="Search reports..." />
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Report Name', 'Report Type', 'Period', 'Generated By', 'Generated On', 'Format', 'Action'].map(header => (
                      <th key={header} className="text-left text-xs font-bold text-navy px-4 py-3 bg-slate-50 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map(report => (
                    <tr key={report.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><FileText size={15} className="text-coop-blue" /></div>
                          <span className="text-sm font-semibold text-navy">{report.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-navy">{report.type || '-'}</td>
                      <td className="px-4 py-3 text-sm text-navy whitespace-nowrap">{report.period || '-'}</td>
                      <td className="px-4 py-3 text-sm text-navy">{report.generatedBy || '-'}</td>
                      <td className="px-4 py-3 text-sm text-navy whitespace-nowrap">{safeDate(report.generatedOn) || '-'}</td>
                      <td className="px-4 py-3"><Badge label={report.format} variant={report.format === 'PDF' ? 'red' : 'green'} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => exportSingleReport(report)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" title="Download"><Download size={13} /></button>
                          <button onClick={() => setSelectedReport(report)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" title="View"><Eye size={13} /></button>
                          <button onClick={() => { setSelectedReport(report); toast.success('Report options opened') }} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" title="More"><MoreVertical size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredReports.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No reports generated yet.</div>}
            </div>
            <button onClick={showAllReports} className="mt-4 text-sm font-semibold text-coop-blue inline-flex items-center gap-2">View All Reports <ChevronRight size={14} /></button>
          </section>

          <section className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
            <FileText size={20} className="text-coop-blue mt-1" />
            <div>
              <h3 className="font-bold text-navy">Report Information</h3>
              <p className="text-sm text-navy/80 mt-1">Reports are generated based on the data available in the system. Ensure all entries are up to date for accurate reporting.</p>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">Popular Reports</h3>
            <div className="space-y-3">
              {popularReports.map(([name, count]) => (
                <button key={name} onClick={() => openPopularReport(name)} className="w-full flex items-center gap-3 text-left rounded-lg hover:bg-slate-50">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><BarChart3 size={15} className="text-coop-blue" /></div>
                  <div>
                    <div className="text-sm font-semibold text-navy">{name}</div>
                    <div className="text-xs text-slate-500">Generated {count} time{count === 1 ? '' : 's'}</div>
                  </div>
                </button>
              ))}
              {popularReports.length === 0 && <div className="text-sm text-slate-400">No popular reports yet.</div>}
            </div>
            <button onClick={() => { setType('All Reports'); setSearch('') }} className="mt-4 text-sm font-semibold text-coop-blue inline-flex items-center gap-2">View All Popular Reports <ChevronRight size={14} /></button>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">Scheduled Reports</h3>
            <div className="space-y-3">
              {schedules.slice(0, 3).map(schedule => (
                <div key={schedule.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3">
                  <div>
                    <div className="text-sm font-semibold text-navy">{schedule.name}</div>
                    <div className="text-xs text-slate-500">{schedule.frequency} at {schedule.time}</div>
                    <Badge label={schedule.active ? 'Active' : 'Paused'} variant={schedule.active ? 'green' : 'gray'} />
                  </div>
                  <button onClick={() => deleteSchedule(schedule.id)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 text-red-600" title="Delete schedule"><Trash2 size={13} /></button>
                </div>
              ))}
              {schedules.length === 0 && <div className="text-sm text-slate-400">No scheduled reports configured.</div>}
            </div>
            <button onClick={() => navigate('/reports/schedule?mode=schedule')} className="mt-4 text-sm font-semibold text-coop-blue inline-flex items-center gap-2">View All Scheduled Reports <ChevronRight size={14} /></button>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={() => navigate('/reports/new')} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-medium hover:bg-slate-50"><Plus size={15} className="text-coop-blue" /> Create New Report</button>
              <button onClick={() => navigate('/reports/schedule?mode=schedule')} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-medium hover:bg-slate-50"><Calendar size={15} className="text-coop-blue" /> Schedule New Report</button>
              <button onClick={() => navigate('/reports/new?type=income-expense')} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-medium hover:bg-slate-50"><FileText size={15} className="text-coop-blue" /> Income & Expense Report</button>
              <button onClick={() => exportReports()} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-medium hover:bg-slate-50"><Download size={15} className="text-coop-blue" /> Export Data</button>
              <button onClick={() => navigate('/trial-balance')} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-medium hover:bg-slate-50"><BarChart3 size={15} className="text-coop-blue" /> Open Trial Balance</button>
            </div>
          </section>
        </aside>
      </div>

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.
      </footer>

      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 animate-fadeIn">
            <h3 className="text-lg font-bold text-navy mb-1">{selectedReport.name}</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedReport.type || 'Report'} report</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-slate-400">Period</div><div className="font-medium">{selectedReport.period || '-'}</div></div>
              <div><div className="text-xs text-slate-400">Format</div><div className="font-medium">{selectedReport.format}</div></div>
              <div><div className="text-xs text-slate-400">Generated By</div><div className="font-medium">{selectedReport.generatedBy || '-'}</div></div>
              <div><div className="text-xs text-slate-400">Generated On</div><div className="font-medium">{safeDate(selectedReport.generatedOn) || '-'}</div></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelectedReport(null)} className="flex-1 btn-secondary justify-center">Close</button>
              <button onClick={() => regenerateReport(selectedReport)} className="flex-1 btn-secondary justify-center">Regenerate</button>
              <button onClick={() => exportSingleReport(selectedReport)} className="flex-1 btn-success justify-center">Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
