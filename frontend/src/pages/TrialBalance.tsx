import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, Calendar, Check, CheckCircle, Download, Filter, Printer, Scale, Search, XCircle } from 'lucide-react'
import { accountsApi } from '../services/api'
import type { Account, AccountType } from '../types'

const currentYear = new Date().getFullYear()
const today = new Date().toISOString().slice(0, 10)
const fmtNGN = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value || 0)
const fmtAmount = (value: number) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function startOfYear(year: number) {
  return `${year}-01-01`
}

function endOfYear(year: number) {
  return `${year}-12-31`
}

function formatDate(value: string) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

function formatType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function SummaryCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: ReactNode; accent: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={`text-sm font-semibold ${accent}`}>{label}</div>
          <div className="text-2xl font-bold text-navy mt-2">{value}</div>
          {sub && <div className={`text-xs mt-2 ${accent}`}>{sub}</div>}
        </div>
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${accent === 'text-green-700' ? 'bg-green-100' : accent === 'text-red-600' ? 'bg-red-100' : accent === 'text-purple-700' ? 'bg-purple-100' : 'bg-blue-100'}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function TrialBalance() {
  const [year, setYear] = useState(currentYear)
  const [from, setFrom] = useState(startOfYear(currentYear))
  const [to, setTo] = useState(today)
  const [accountType, setAccountType] = useState<'all' | AccountType>('all')
  const [search, setSearch] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [totalDebit, setTotalDebit] = useState(0)
  const [totalCredit, setTotalCredit] = useState(0)
  const [isBalanced, setIsBalanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)

  const loadTrialBalance = async () => {
    try {
      setLoading(true)
      const result = await accountsApi.trialBalance({ from, to })
      setAccounts(result.accounts)
      setTotalDebit(Number(result.totalDebit || 0))
      setTotalCredit(Number(result.totalCredit || 0))
      setIsBalanced(Boolean(result.isBalanced))
      setGeneratedAt(new Date())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load trial balance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTrialBalance() }, [])

  const filteredAccounts = useMemo(() => accounts.filter(account => {
    const typeMatches = accountType === 'all' || account.type === accountType
    const term = search.trim().toLowerCase()
    const searchMatches = !term || account.name.toLowerCase().includes(term) || account.code.toLowerCase().includes(term) || account.type.toLowerCase().includes(term)
    return typeMatches && searchMatches
  }), [accounts, accountType, search])

  const filteredDebit = filteredAccounts.reduce((sum, account) => sum + Number(account.debit || 0), 0)
  const filteredCredit = filteredAccounts.reduce((sum, account) => sum + Number(account.credit || 0), 0)
  const difference = Math.abs(totalDebit - totalCredit)

  const changeYear = (value: number) => {
    setYear(value)
    setFrom(startOfYear(value))
    setTo(value === currentYear ? today : endOfYear(value))
  }

  const exportExcel = () => {
    const headers = ['#', 'Account Code', 'Account Name', 'Account Type', 'Debit', 'Credit', 'Balance']
    const rows = filteredAccounts.map((account, index) => [
      index + 1,
      account.code,
      account.name,
      formatType(account.type),
      account.debit || 0,
      account.credit || 0,
      account.balance || 0,
    ])
    const footer = ['', '', 'TOTAL', '', filteredDebit, filteredCredit, Math.abs(filteredDebit - filteredCredit)]
    const csv = [headers, ...rows, footer].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `trial-balance-${from}-to-${to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Trial Balance</h2>
          <p className="text-sm text-slate-500 mt-1">View trial balance of all ledger accounts for the selected period.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="btn-secondary"><Printer size={14} /> Print</button>
          <button onClick={exportExcel} className="btn-success"><Download size={14} /> Export Excel</button>
          <button onClick={loadTrialBalance} className="btn-secondary"><Filter size={14} /> Filter</button>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 divide-y xl:divide-y-0 xl:divide-x divide-slate-100">
          <div className="p-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">Financial Year</label>
            <select value={year} onChange={event => changeYear(Number(event.target.value))} className="input-field">
              {[0, 1, 2, 3, 4].map(offset => {
                const option = currentYear - offset
                return <option key={option} value={option}>{option}</option>
              })}
            </select>
          </div>
          <div className="p-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">From Date</label>
            <div className="relative">
              <input type="date" value={from} onChange={event => setFrom(event.target.value)} className="input-field pr-9" />
              <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="p-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">To Date</label>
            <div className="relative">
              <input type="date" value={to} onChange={event => setTo(event.target.value)} className="input-field pr-9" />
              <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="p-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">Department</label>
            <select className="input-field">
              <option>All Departments</option>
            </select>
          </div>
          <div className="p-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">Account Type</label>
            <select value={accountType} onChange={event => setAccountType(event.target.value as 'all' | AccountType)} className="input-field">
              <option value="all">All</option>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div className="p-4 flex items-end">
            <button onClick={loadTrialBalance} disabled={loading} className="btn-primary bg-navy w-full justify-center disabled:opacity-60"><Search size={15} /> {loading ? 'Loading...' : 'Apply Filter'}</button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <SummaryCard label="Total Debit (N)" value={fmtNGN(totalDebit)} icon={<ArrowDown size={26} className="text-blue-700" />} accent="text-coop-blue" />
        <SummaryCard label="Total Credit (N)" value={fmtNGN(totalCredit)} icon={<ArrowUp size={26} className="text-green-700" />} accent="text-green-700" />
        <SummaryCard label="Difference (N)" value={fmtNGN(difference)} icon={<Scale size={26} className="text-purple-700" />} accent="text-purple-700" />
        <SummaryCard
          label="Status"
          value={isBalanced ? 'BALANCED' : 'UNBALANCED'}
          sub={isBalanced ? 'Trial Balance is balanced' : 'Difference detected'}
          icon={isBalanced ? <Check size={28} className="text-green-700" /> : <XCircle size={28} className="text-red-600" />}
          accent={isBalanced ? 'text-green-700' : 'text-red-600'}
        />
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-navy">Trial Balance Details</h3>
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} className="input-field pl-9" placeholder="Search account code, name or type..." />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full">
            <thead>
              <tr>
                {['#', 'Account Code', 'Account Name', 'Account Type', 'Debit (N)', 'Credit (N)', 'Balance (N)'].map(header => (
                  <th key={header} className="text-left text-xs font-bold text-navy px-4 py-3 bg-slate-50 whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account, index) => {
                const balanceLabel = `${fmtAmount(Math.abs(account.balance || 0))} ${Number(account.balance || 0) >= 0 ? 'Dr' : 'Cr'}`
                return (
                  <tr key={`${account.code}-${account.id}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-navy">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-mono text-navy">{account.code}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-navy">{account.name}</td>
                    <td className="px-4 py-3 text-sm text-navy">{formatType(account.type)}</td>
                    <td className="px-4 py-3 text-sm text-right text-navy">{account.debit > 0 ? fmtAmount(account.debit) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-right text-navy">{account.credit > 0 ? fmtAmount(account.credit) : '-'}</td>
                    <td className={`px-4 py-3 text-sm text-right font-bold ${Number(account.balance || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>{balanceLabel}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={4} className="px-4 py-5 text-sm font-bold text-navy">TOTAL</td>
                <td className="px-4 py-5 text-sm text-right font-bold text-coop-blue">{fmtNGN(filteredDebit)}</td>
                <td className="px-4 py-5 text-sm text-right font-bold text-coop-blue">{fmtNGN(filteredCredit)}</td>
                <td className="px-4 py-5 text-sm text-right font-bold text-coop-blue">{fmtNGN(Math.abs(filteredDebit - filteredCredit))}</td>
              </tr>
            </tfoot>
          </table>
          {filteredAccounts.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No ledger accounts found for the selected filter.</div>}
        </div>

        <div className={`mt-5 rounded-lg border p-4 flex items-center gap-3 ${isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          {isBalanced ? <CheckCircle className="text-green-700" size={20} /> : <XCircle className="text-red-600" size={20} />}
          <span className={`text-sm font-medium ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>
            {isBalanced ? 'The trial balance is balanced. Total debits equal total credits.' : `The trial balance is not balanced. Difference: ${fmtNGN(difference)}.`}
          </span>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.</span>
        <span>Generated on: {generatedAt ? generatedAt.toLocaleString() : '-'}</span>
      </footer>
    </div>
  )
}
