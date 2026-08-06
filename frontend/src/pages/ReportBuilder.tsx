import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Calendar, CheckCircle, FileText, Save, Send } from 'lucide-react'
import { reportsApi, settingsApi } from '../services/api'

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

const currentYear = new Date().getFullYear()
const today = new Date().toISOString().slice(0, 10)
const monthStart = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

const reportKinds = [
  { value: 'trial-balance', label: 'Trial Balance Report', type: 'Accounting' },
  { value: 'income-expense', label: 'Income & Expense Report', type: 'Financial' },
]

export default function ReportBuilder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'schedule' ? 'schedule' : 'generate'
  const initialType = searchParams.get('type') || 'trial-balance'
  const [mode, setMode] = useState<'generate' | 'schedule'>(initialMode)
  const [reportKind, setReportKind] = useState(initialType)
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [format, setFormat] = useState<'PDF' | 'Excel'>('PDF')
  const [frequency, setFrequency] = useState('Monthly')
  const [time, setTime] = useState('08:00')
  const [recipients, setRecipients] = useState('')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [saving, setSaving] = useState(false)

  const selectedKind = useMemo(() => reportKinds.find(item => item.value === reportKind) || reportKinds[0], [reportKind])

  useEffect(() => {
    settingsApi.get<ReportSchedulesSettings>('report-schedules')
      .then(saved => setSchedules(saved.schedules || []))
      .catch(() => toast.error('Could not load report schedules'))
  }, [])

  const generateReport = async () => {
    try {
      setSaving(true)
      if (reportKind === 'income-expense') {
        await reportsApi.generateIncomeExpense({ from, to, format })
      } else {
        await reportsApi.generateTrialBalance({ from, to, format })
      }
      toast.success(`${selectedKind.label} generated`)
      navigate('/reports')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate report')
    } finally {
      setSaving(false)
    }
  }

  const saveSchedule = async () => {
    try {
      setSaving(true)
      const schedule: Schedule = {
        id: `${Date.now()}`,
        name: selectedKind.label,
        reportKind,
        frequency,
        time,
        format,
        recipients,
        active: true,
        createdAt: new Date().toISOString(),
      }
      await settingsApi.save<ReportSchedulesSettings>('report-schedules', { schedules: [schedule, ...schedules] })
      toast.success('Report schedule saved')
      navigate('/reports')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate('/reports')} className="text-sm font-semibold text-coop-blue inline-flex items-center gap-2 mb-2"><ArrowLeft size={15} /> Back to Reports</button>
          <h2 className="text-xl font-bold text-navy">{mode === 'schedule' ? 'Schedule Report' : 'Create New Report'}</h2>
          <p className="text-sm text-slate-500 mt-1">Generate reports from live system records or create an automatic schedule.</p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button onClick={() => setMode('generate')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === 'generate' ? 'bg-coop-blue text-white' : 'text-navy'}`}>Generate</button>
          <button onClick={() => setMode('schedule')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === 'schedule' ? 'bg-coop-blue text-white' : 'text-navy'}`}>Schedule</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-navy mb-1">Report Details</h3>
          <p className="text-sm text-slate-500 mb-5">Choose report type, period and output format.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Report Type</span>
              <select value={reportKind} onChange={event => setReportKind(event.target.value)} className="input-field">
                {reportKinds.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Format</span>
              <select value={format} onChange={event => setFormat(event.target.value as 'PDF' | 'Excel')} className="input-field">
                <option>PDF</option>
                <option>Excel</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Date From</span>
              <input type="date" value={from} onChange={event => setFrom(event.target.value)} className="input-field" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Date To</span>
              <input type="date" value={to} onChange={event => setTo(event.target.value)} className="input-field" />
            </label>
          </div>

          {mode === 'schedule' && (
            <div className="border-t border-slate-100 mt-6 pt-6">
              <h3 className="font-bold text-navy mb-4">Schedule Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Frequency</span>
                  <select value={frequency} onChange={event => setFrequency(event.target.value)} className="input-field">
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                    <option>Quarterly</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Run Time</span>
                  <input type="time" value={time} onChange={event => setTime(event.target.value)} className="input-field" />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Recipients</span>
                  <input value={recipients} onChange={event => setRecipients(event.target.value)} className="input-field" placeholder="email@example.com" />
                </label>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3 mt-6">
            <button onClick={() => navigate('/reports')} className="btn-secondary">Cancel</button>
            {mode === 'schedule'
              ? <button onClick={saveSchedule} disabled={saving} className="btn-primary bg-coop-blue disabled:opacity-60"><Save size={15} /> Save Schedule</button>
              : <button onClick={generateReport} disabled={saving} className="btn-primary bg-coop-blue disabled:opacity-60"><Send size={15} /> Generate Report</button>}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-coop-blue flex items-center justify-center"><FileText size={22} /></div>
            <h3 className="font-bold text-navy mt-4">{selectedKind.label}</h3>
            <p className="text-sm text-slate-500 mt-2">This report will be created from live transactions and account records in the selected date range.</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-semibold text-navy">{selectedKind.type}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Format</span><span className="font-semibold text-navy">{format}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Period</span><span className="font-semibold text-navy">{from} to {to}</span></div>
            </div>
          </section>

          <section className="bg-green-50 border border-green-100 rounded-xl p-4">
            <h3 className="font-bold text-navy flex items-center gap-2"><CheckCircle size={16} className="text-green-700" /> Action Ready</h3>
            <p className="text-sm text-navy/80 mt-2">{mode === 'schedule' ? 'This schedule will be saved and displayed on the Reports page.' : 'Click Generate Report to create a report record immediately.'}</p>
          </section>
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-navy flex items-center gap-2"><Calendar size={16} /> Existing Schedules</h3>
            <div className="mt-3 space-y-2">
              {schedules.slice(0, 5).map(schedule => <div key={schedule.id} className="text-sm border border-slate-100 rounded-lg p-3"><div className="font-semibold text-navy">{schedule.name}</div><div className="text-xs text-slate-500">{schedule.frequency} at {schedule.time}</div></div>)}
              {schedules.length === 0 && <p className="text-sm text-slate-400">No schedules saved yet.</p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
