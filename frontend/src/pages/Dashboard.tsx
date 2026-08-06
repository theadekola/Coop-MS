import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowRight, Banknote, Bell, CalendarDays, ClipboardList, FileText, Scale, ShieldAlert, Users, Wallet } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dashboardApi, isAuthError } from '../services/api'
import { useAuthStore } from '../store/authStore'

type DashboardData = {
  summary: Record<string, number>
  transactions: Record<string, unknown>[]
  approvals: Record<string, unknown>[]
  announcements: Record<string, unknown>[]
  dailyTrend: Record<string, unknown>[]
  staffActivity: Record<string, unknown>[]
}

const fmtNGN = (value: number) => new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
}).format(Number(value || 0))

const fmtPlain = (value: number) => Number(value || 0).toLocaleString()

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'U'
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-slate-400">{text}</div>
}

function MetricCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string | number; sub: string; tone: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 min-h-[104px]">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className="text-xl font-bold text-slate-950 mt-1 truncate">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{sub}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [data, setData] = useState<DashboardData>({
    summary: {},
    transactions: [],
    approvals: [],
    announcements: [],
    dailyTrend: [],
    staffActivity: [],
  })

  const loadDashboard = async () => {
    try {
      setData(await dashboardApi.get())
    } catch (err) {
      if (isAuthError(err)) return
      toast.error(err instanceof Error ? err.message : 'Unable to load dashboard')
    }
  }

  useEffect(() => { loadDashboard() }, [])

  const income = Number(data.summary.TotalIncome || 0)
  const expenses = Number(data.summary.TotalExpenses || 0)
  const todayIncome = Number(data.summary.TodayIncome || 0)
  const todayExpenses = Number(data.summary.TodayExpenses || 0)
  const trialDebit = Number(data.summary.TrialDebit || 0)
  const trialCredit = Number(data.summary.TrialCredit || 0)
  const isBalanced = Math.abs(trialDebit - trialCredit) < 0.01

  const weekData = useMemo(() => {
    const rows = new Map(data.dailyTrend.map(row => [
      new Date(String(row.TxnDate)).toISOString().slice(0, 10),
      row,
    ]))
    return Array.from({ length: 7 }).map((_, index) => {
      const day = subDays(new Date(), 6 - index)
      const key = day.toISOString().slice(0, 10)
      const row = rows.get(key)
      return {
        day: format(day, 'EEE'),
        income: Number(row?.Income || 0),
        expenses: Number(row?.Expenses || 0),
      }
    })
  }, [data.dailyTrend])

  const pieData = [
    { name: 'Total Income', value: income, color: '#16A34A' },
    { name: 'Total Expenses', value: expenses, color: '#EF4444' },
  ]
  const hasPieData = pieData.some(item => item.value > 0)

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Welcome back, {user?.fullName?.split(' ')[0] || 'Admin'}!</h2>
          <p className="text-sm text-slate-500 mt-1">Here is what is happening with Oshodi Isolo Excel Cooperative today.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-600">
          <span>{format(new Date(), 'EEEE, do MMMM yyyy')}</span>
          <CalendarDays size={16} className="text-slate-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <MetricCard icon={<Users size={22} />} tone="bg-purple-600" label="Total Staff" value={data.summary.TotalStaff || 0} sub="Active staff" />
        <MetricCard icon={<Wallet size={22} />} tone="bg-green-600" label="Cash Balance" value={fmtNGN(Number(data.summary.CashBalance || 0))} sub="Cash in hand" />
        <MetricCard icon={<Banknote size={22} />} tone="bg-blue-600" label="Bank Balance" value={fmtNGN(Number(data.summary.BankBalance || 0))} sub="In bank accounts" />
        <MetricCard icon={<ClipboardList size={22} />} tone="bg-orange-500" label="Pending Approvals" value={data.summary.PendingApprovals || 0} sub="Awaiting approval" />
        <MetricCard icon={<Scale size={28} />} tone="bg-teal-600" label="Trial Balance Status" value={isBalanced ? 'Balanced' : 'Unbalanced'} sub={`As at ${format(new Date(), 'dd/MM/yyyy')}`} />
        <MetricCard icon={<ShieldAlert size={22} />} tone="bg-red-600" label="Audit Alerts" value={data.summary.AuditAlerts || 0} sub="Requires attention" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">Recent Transactions</h3>
            <button onClick={() => navigate('/accounts')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Date', 'Description', 'Account', 'Debit', 'Credit', 'Balance'].map(header => (
                    <th key={header} className="text-left text-xs font-semibold text-slate-600 px-4 py-3 bg-slate-50">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((txn, index) => (
                  <tr key={String(txn.TxnID ?? index)} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{txn.TxnDate ? new Date(String(txn.TxnDate)).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 font-medium">{String(txn.Description ?? '')}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{String(txn.AccountName ?? '')}</td>
                    <td className="px-4 py-3 text-xs text-green-700 text-right">{Number(txn.DebitAmount || 0) ? fmtPlain(Number(txn.DebitAmount)) : '-'}</td>
                    <td className="px-4 py-3 text-xs text-red-600 text-right">{Number(txn.CreditAmount || 0) ? fmtPlain(Number(txn.CreditAmount)) : '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 text-right font-semibold">{fmtPlain(Number(txn.Balance || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.transactions.length === 0 && <EmptyState text="No transactions yet." />}
          </div>
        </section>

        <section className="xl:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-900">Income vs Expenses <span className="font-normal text-sm text-slate-500">(This Month)</span></h3>
          <div className="h-52 mt-4">
            {hasPieData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={54} outerRadius={82} paddingAngle={1}>
                    {pieData.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmtNGN(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState text="No income or expenses this month." />}
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-4">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-600"><span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />{item.name}</div>
                <span className="font-semibold text-slate-900">{fmtNGN(item.value)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/reports')} className="mt-4 flex items-center justify-between w-full text-sm text-coop-blue font-semibold">
            View Full Report <ArrowRight size={16} />
          </button>
        </section>

        <section className="xl:col-span-4 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Today&apos;s Income & Expenses</h3>
            <span className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600">This Week</span>
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            <span className="text-green-700 font-semibold">Income: {fmtNGN(todayIncome)}</span>
            <span className="text-red-600 font-semibold">Expenses: {fmtNGN(todayExpenses)}</span>
          </div>
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: number) => fmtNGN(value)} />
                <Bar dataKey="income" fill="#16A34A" radius={[5, 5, 0, 0]} />
                <Bar dataKey="expenses" fill="#EF4444" radius={[5, 5, 0, 0]} />
                <Line type="monotone" dataKey="income" stroke="#0F766E" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Staff Activity</h3>
            <button onClick={() => navigate('/audit')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">View All</button>
          </div>
          <div className="space-y-3">
            {data.staffActivity.map((activity, index) => (
              <div key={String(activity.LogID ?? index)} className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center text-white text-xs font-bold">{initials(String(activity.FullName ?? 'User'))}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 truncate">{String(activity.FullName ?? 'User')}</div>
                  <div className="text-xs text-slate-500 truncate">{String(activity.Description ?? '')}</div>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">{activity.CreatedAt ? format(new Date(String(activity.CreatedAt)), 'hh:mm a') : ''}</span>
              </div>
            ))}
            {data.staffActivity.length === 0 && <EmptyState text="No staff activity yet." />}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Pending Approvals</h3>
            <button onClick={() => navigate('/management')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">View All</button>
          </div>
          <div className="space-y-3">
            {data.approvals.map((approval, index) => (
              <div key={String(approval.ApprovalID ?? index)} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3">
                <FileText size={20} className="text-slate-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 truncate">{String(approval.ItemDescription ?? '')}</div>
                  <div className="text-xs text-slate-500">By: {String(approval.SubmittedBy ?? '')}</div>
                </div>
                <span className="text-xs font-semibold text-orange-600 capitalize">{String(approval.Status ?? 'pending')}</span>
              </div>
            ))}
            {data.approvals.length === 0 && <EmptyState text="No pending approvals." />}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Management Announcements</h3>
            <button onClick={() => navigate('/management')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-navy hover:bg-slate-50">View All</button>
          </div>
          <div className="space-y-3">
            {data.announcements.map((announcement, index) => (
              <div key={String(announcement.AnnouncementID ?? index)} className="border border-slate-100 rounded-xl p-3 flex gap-3">
                <Bell size={20} className="text-purple-600 mt-1" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{String(announcement.Title ?? '')}</div>
                  <div className="text-xs text-slate-500 line-clamp-2 mt-1">{String(announcement.Content ?? '')}</div>
                  <div className="text-xs text-slate-400 mt-2">By {String(announcement.PublishedBy ?? '')}</div>
                </div>
              </div>
            ))}
            {data.announcements.length === 0 && <EmptyState text="No active announcements." />}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap justify-between gap-3 text-xs text-slate-400 border-t border-slate-200 pt-4">
        <span>(c) 2026 Oshodi Isolo Excel Cooperative. All rights reserved.</span>
        <span>Version 1.0.0</span>
      </div>
    </div>
  )
}
