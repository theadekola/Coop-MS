import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import { accountsApi } from '../services/api'
import type { Account } from '../types'

const today = new Date().toISOString().slice(0, 10)
const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
const fmtNGN = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value || 0)

function accountTypeVariant(type: string): 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gray' | 'teal' | 'yellow' {
  const map: Record<string, 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gray' | 'teal' | 'yellow'> = {
    asset: 'green',
    liability: 'orange',
    equity: 'purple',
    income: 'blue',
    expense: 'red',
  }
  return map[type] || 'gray'
}

function formatAccountType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] || char))
}

export default function ChartOfAccounts() {
  const navigate = useNavigate()
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])

  const groupedAccounts = useMemo(() => accounts.reduce<Record<string, Account[]>>((groups, account) => {
    const key = account.type || 'asset'
    groups[key] = groups[key] || []
    groups[key].push(account)
    return groups
  }, {}), [accounts])

  const totals = useMemo(() => accounts.reduce((sum, account) => ({
    debit: sum.debit + Number(account.debit || 0),
    credit: sum.credit + Number(account.credit || 0),
    balance: sum.balance + Number(account.balance || 0),
  }), { debit: 0, credit: 0, balance: 0 }), [accounts])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const result = await accountsApi.trialBalance({ from, to })
      setAccounts(result.accounts)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load chart of accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts() }, [])

  const exportExcel = () => {
    const headers = ['Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Balance']
    const body = accounts.map(account => [
      account.code,
      account.name,
      formatAccountType(account.type),
      account.debit || 0,
      account.credit || 0,
      account.balance || 0,
    ])
    const csv = [headers, ...body].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'chart-of-accounts.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const rows = accounts.map(account => `
      <tr>
        <td>${escapeHtml(account.code)}</td>
        <td>${escapeHtml(account.name)}</td>
        <td>${escapeHtml(formatAccountType(account.type))}</td>
        <td>${escapeHtml(fmtNGN(account.debit || 0))}</td>
        <td>${escapeHtml(fmtNGN(account.credit || 0))}</td>
        <td>${escapeHtml(fmtNGN(account.balance || 0))}</td>
      </tr>
    `).join('')
    const win = window.open('', '_blank')
    if (!win) {
      toast.error('Allow pop-ups to export PDF')
      return
    }
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Chart of Accounts</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1 { margin: 0 0 4px; font-size: 24px; }
            p { margin: 0 0 20px; color: #64748b; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 9px; text-align: left; }
            th { background: #f8fafc; color: #475569; }
            tfoot td { font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Chart of Accounts</h1>
          <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
          <table>
            <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6">No accounts found.</td></tr>'}</tbody>
            <tfoot><tr><td colspan="3">Total</td><td>${escapeHtml(fmtNGN(totals.debit))}</td><td>${escapeHtml(fmtNGN(totals.credit))}</td><td>${escapeHtml(fmtNGN(totals.balance))}</td></tr></tfoot>
          </table>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => navigate('/accounts')} className="inline-flex items-center gap-2 text-sm font-semibold text-coop-blue mb-3 hover:underline">
            <ArrowLeft size={15} /> Back to Accounts
          </button>
          <h2 className="text-xl font-bold text-slate-950">Chart of Accounts</h2>
          <p className="text-sm text-slate-500 mt-1">Visual list of all ledger accounts from the database.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={loadAccounts} className="btn-secondary"><RefreshCw size={14} /> Refresh</button>
          <button onClick={exportExcel} disabled={!accounts.length} className="btn-secondary disabled:opacity-50"><FileSpreadsheet size={14} /> Export Excel</button>
          <button onClick={exportPdf} disabled={!accounts.length} className="btn-success disabled:opacity-50"><Printer size={14} /> Export PDF</button>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
            <input type="date" value={from} onChange={event => setFrom(event.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
            <input type="date" value={to} onChange={event => setTo(event.target.value)} className="input-field" />
          </div>
          <div className="flex items-end">
            <button onClick={loadAccounts} disabled={loading} className="btn-primary bg-navy w-full justify-center disabled:opacity-60">
              <Download size={14} /> {loading ? 'Loading...' : 'Load Chart'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-500">Total Accounts</div>
          <div className="text-2xl font-bold text-slate-950 mt-1">{accounts.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-500">Total Debit</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{fmtNGN(totals.debit)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-500">Total Credit</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{fmtNGN(totals.credit)}</div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl py-14 text-center text-sm text-slate-500 shadow-sm">Loading chart of accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl py-14 text-center text-sm text-slate-500 shadow-sm">No chart of accounts found.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(groupedAccounts).map(([type, group]) => (
              <section key={type} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-bold text-slate-900">{formatAccountType(type)}</h3>
                  <Badge label={`${group.length} account${group.length === 1 ? '' : 's'}`} variant={accountTypeVariant(type)} />
                </div>
                <div className="space-y-2">
                  {group.map(account => (
                    <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
                      <div>
                        <div className="text-xs font-mono text-slate-500">{account.code}</div>
                        <div className="text-sm font-semibold text-slate-800">{account.name}</div>
                      </div>
                      <div className="text-sm font-bold text-slate-900">{fmtNGN(account.balance || 0)}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-slate-900 mb-3">Account List</h3>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Balance'].map(header => (
                      <th key={header} className="text-left text-xs font-semibold text-slate-600 px-4 py-3 bg-slate-50 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(account => (
                    <tr key={account.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">{account.code}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{account.name}</td>
                      <td className="px-4 py-3"><Badge label={formatAccountType(account.type)} variant={accountTypeVariant(account.type)} /></td>
                      <td className="px-4 py-3 text-xs text-right text-green-700">{fmtNGN(account.debit || 0)}</td>
                      <td className="px-4 py-3 text-xs text-right text-red-600">{fmtNGN(account.credit || 0)}</td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-slate-900">{fmtNGN(account.balance || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-slate-900">Total</td>
                    <td className="px-4 py-3 text-xs text-right font-bold text-green-700">{fmtNGN(totals.debit)}</td>
                    <td className="px-4 py-3 text-xs text-right font-bold text-red-600">{fmtNGN(totals.credit)}</td>
                    <td className="px-4 py-3 text-xs text-right font-bold text-slate-900">{fmtNGN(totals.balance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
