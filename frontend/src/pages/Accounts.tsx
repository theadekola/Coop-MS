import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Banknote, ChevronLeft, ChevronRight, Download, Eye, FileText, Filter, Landmark, MoreVertical, PieChart as PieIcon, Plus, RefreshCw, Search, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import Badge from '../components/ui/Badge'
import { accountsApi } from '../services/api'
import type { Transaction, TransactionType } from '../types'

const distributionColors = ['#16A34A', '#2563EB']
const fmtNGN = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value || 0)
const fmtAmount = (value?: number) => value ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'
const today = new Date().toISOString().slice(0, 10)
const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`

function MetricCard({ icon, label, value, sub, tone, softTone }: { icon: ReactNode; label: string; value: string; sub: string; tone: string; softTone: string }) {
  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm ${softTone}`}>
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-600">{label}</div>
          <div className="text-xl font-bold text-slate-950 mt-1 truncate">{value}</div>
          <div className="text-xs text-slate-500 mt-1">{sub}</div>
        </div>
      </div>
    </div>
  )
}

function paymentVariant(method: string): 'green' | 'orange' | 'blue' {
  if (method === 'Cash') return 'green'
  if (method === 'Cheque') return 'orange'
  return 'blue'
}

export default function Accounts() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('All Accounts')
  const [typeFilter, setTypeFilter] = useState('All Types')
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [form, setForm] = useState({
    description: '',
    accountId: 1,
    txnType: 'income' as TransactionType,
    amount: '',
    paymentMethod: 'Cash',
    chequeNumber: '',
  })

  const pageSize = 8
  const cashBalance = summary.CashBalance || 0
  const bankBalance = summary.BankBalance || 0
  const income = summary.TotalIncomeMTD || 0
  const expenses = summary.TotalExpensesMTD || 0
  const net = income - expenses
  const totalBalance = cashBalance + bankBalance

  const accountDistribution = [
    { name: 'Cash Account', value: cashBalance, color: distributionColors[0] },
    { name: 'Bank Account', value: bankBalance, color: distributionColors[1] },
  ]

  const filteredTransactions = useMemo(() => transactions.filter(t => {
    const accountMatches = accountFilter === 'All Accounts' || t.account === accountFilter
    const typeMatches = typeFilter === 'All Types' || t.type === typeFilter.toLowerCase()
    const date = t.date ? new Date(t.date) : null
    const fromMatches = !from || (date && date >= new Date(from))
    const toMatches = !to || (date && date <= new Date(`${to}T23:59:59`))
    return accountMatches && typeMatches && Boolean(fromMatches) && Boolean(toMatches)
  }), [transactions, accountFilter, typeFilter, from, to])

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize))
  const pagedTransactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize)

  const loadAccounts = async () => {
    try {
      const [txns, accountSummary] = await Promise.all([
        accountsApi.transactions({ search: search || undefined, limit: 200 }),
        accountsApi.summary(),
      ])
      setTransactions(txns.data)
      setTotal(txns.total)
      setSummary(accountSummary)
      setPage(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load accounts')
    }
  }

  useEffect(() => { loadAccounts() }, [search])

  const openNewTransaction = (type: TransactionType = 'income') => {
    setForm({ description: '', accountId: 1, txnType: type, amount: '', paymentMethod: 'Cash', chequeNumber: '' })
    setShowModal(true)
  }

  const postTransaction = async () => {
    try {
      const amount = Number(form.amount)
      if (!form.description || !amount) throw new Error('Enter description and amount')
      if (form.paymentMethod === 'Cheque' && !form.chequeNumber.trim()) throw new Error('Enter cheque number')
      await accountsApi.createTransaction({ ...form, amount })
      toast.success(form.txnType==='expense'?'Expense submitted for independent approval':'Income posted')
      setShowModal(false)
      setForm({ description: '', accountId: 1, txnType: 'income', amount: '', paymentMethod: 'Cash', chequeNumber: '' })
      loadAccounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to post transaction')
    }
  }

  const exportRows = (rows: Transaction[], filename = 'transactions.csv') => {
    const headers = ['Date', 'Description', 'Account', 'Reference', 'Type', 'Debit', 'Credit', 'Balance', 'Payment Method', 'Cheque Number', 'Posted By']
    const body = rows.map(t => [t.date, t.description, t.account, t.reference, t.type, t.debit || 0, t.credit || 0, t.balance, t.paymentMethod, t.chequeNumber || '', t.postedBy])
    const csv = [headers, ...body].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSingle = (transaction: Transaction) => exportRows([transaction], `${transaction.reference || 'transaction'}.csv`)

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Accounts Overview</h2>
          <p className="text-sm text-slate-500 mt-1">View and manage all cooperative accounts and transactions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => openNewTransaction('income')} className="btn-success"><Plus size={15} /> New Transaction</button>
          <button onClick={() => toast.error('Transfers require a balanced ledger workflow and are not available yet')} className="btn-secondary"><RefreshCw size={14} /> Transfer Funds</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard icon={<Wallet size={22} className="text-green-700" />} tone="bg-green-100" softTone="border-green-100" label="Cash Account" value={fmtNGN(cashBalance)} sub="Current balance" />
        <MetricCard icon={<Landmark size={22} className="text-blue-700" />} tone="bg-blue-100" softTone="border-blue-100" label="Bank Account" value={fmtNGN(bankBalance)} sub="Current balance" />
        <MetricCard icon={<TrendingUp size={22} className="text-purple-700" />} tone="bg-purple-100" softTone="border-purple-100" label="Total Income (MTD)" value={fmtNGN(income)} sub="This month" />
        <MetricCard icon={<TrendingDown size={22} className="text-red-700" />} tone="bg-red-100" softTone="border-red-100" label="Total Expenses (MTD)" value={fmtNGN(expenses)} sub="This month" />
        <MetricCard icon={<PieIcon size={22} className="text-amber-700" />} tone="bg-amber-100" softTone="border-amber-100" label="Net Balance (MTD)" value={fmtNGN(net)} sub="This month" />
      </div>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
          <div className="relative md:col-span-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search transactions..." className="input-field pl-9" />
          </div>
          <select value={accountFilter} onChange={event => { setAccountFilter(event.target.value); setPage(1) }} className="input-field md:col-span-2">
            <option>All Accounts</option><option>Cash Account</option><option>Bank Account</option>
          </select>
          <div className="grid grid-cols-2 gap-2 md:col-span-3">
            <input type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1) }} className="input-field" />
            <input type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1) }} className="input-field" />
          </div>
          <select value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(1) }} className="input-field md:col-span-2">
            <option>All Types</option><option>Income</option><option>Expense</option><option>Transfer</option>
          </select>
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            <button onClick={loadAccounts} className="btn-secondary"><Filter size={14} /> Filter</button>
            <button onClick={() => exportRows(filteredTransactions)} className="btn-secondary"><Download size={14} /> Export</button>
          </div>
        </div>

        <h3 className="font-bold text-slate-900 mb-3">Account Transactions</h3>
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full">
            <thead><tr>
              {['Date', 'Description', 'Account', 'Reference', 'Type', 'Debit (N)', 'Credit (N)', 'Balance (N)', 'Payment Method', 'Posted By', 'Action'].map(header => (
                <th key={header} className="text-left text-xs font-semibold text-slate-600 px-4 py-3 bg-slate-50 whitespace-nowrap">{header}</th>
              ))}
            </tr></thead>
            <tbody>
              {pagedTransactions.map(transaction => (
                <tr key={transaction.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{transaction.date ? new Date(transaction.date).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{transaction.description}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{transaction.account}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-mono">{transaction.reference}</td>
                  <td className="px-4 py-3"><Badge label={transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)} variant={transaction.type === 'income' ? 'green' : transaction.type === 'expense' ? 'red' : 'blue'} /></td>
                  <td className="px-4 py-3 text-xs text-right text-green-700">{fmtAmount(transaction.debit)}</td>
                  <td className="px-4 py-3 text-xs text-right text-red-600">{fmtAmount(transaction.credit)}</td>
                  <td className="px-4 py-3 text-xs text-right font-semibold text-slate-800">{fmtAmount(transaction.balance)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <Badge label={transaction.paymentMethod || 'N/A'} variant={paymentVariant(transaction.paymentMethod)} />
                      {transaction.paymentMethod === 'Cheque' && transaction.chequeNumber && <div className="text-xs font-mono text-slate-500">#{transaction.chequeNumber}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{transaction.postedBy}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setSelectedTransaction(transaction)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" title="View transaction"><Eye size={13} /></button>
                      <button onClick={() => exportSingle(transaction)} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" title="Export transaction"><Download size={13} /></button>
                      <button onClick={() => { navigator.clipboard?.writeText(transaction.reference); toast.success('Reference copied') }} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50" title="Copy reference"><MoreVertical size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagedTransactions.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No transactions found.</div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <span className="text-sm text-slate-500">Showing {filteredTransactions.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredTransactions.length)} of {filteredTransactions.length || total} entries</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40" disabled={page === 1}><ChevronLeft size={14} /></button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
              const pageNo = index + 1
              return <button key={pageNo} onClick={() => setPage(pageNo)} className={`w-9 h-9 rounded-lg border text-sm font-semibold ${page === pageNo ? 'bg-navy text-white border-navy' : 'border-slate-200 text-slate-600'}`}>{pageNo}</button>
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40" disabled={page === totalPages}><ChevronRight size={14} /></button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-900 mb-4">Account Summary</h3>
          <div className="space-y-3">
            {[
              ['Total Cash Balance', fmtNGN(cashBalance), 'text-green-700'],
              ['Total Bank Balance', fmtNGN(bankBalance), 'text-blue-700'],
              ['Total Income (This Month)', fmtNGN(income), 'text-green-700'],
              ['Total Expenses (This Month)', fmtNGN(expenses), 'text-red-600'],
            ].map(([label, value, color]) => (
              <div key={label} className="flex justify-between text-sm border-b border-slate-100 pb-2">
                <span className="text-slate-600">{label}</span><span className={`font-bold ${color}`}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm bg-slate-50 rounded-lg p-3">
              <span className="font-bold text-slate-800">Net Balance (This Month)</span><span className="font-bold text-navy">{fmtNGN(net)}</span>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-900 mb-4">Account Distribution</h3>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={accountDistribution} cx="50%" cy="50%" innerRadius={42} outerRadius={64} dataKey="value">
                  {accountDistribution.map((entry, index) => <Cell key={entry.name} fill={distributionColors[index]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => fmtNGN(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-3">
            {accountDistribution.map(item => (
              <div key={item.name} className="flex justify-between text-xs">
                <span className="text-slate-600">{item.name}</span>
                <span className="font-semibold text-slate-800">{totalBalance ? Math.round((item.value / totalBalance) * 100) : 0}% ({fmtNGN(item.value)})</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold border-t pt-2"><span>Total</span><span>{fmtNGN(totalBalance)}</span></div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-900 mb-4">Recent Bank Reconciliation</h3>
          <div className="border border-green-100 bg-green-50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Banknote size={18} className="text-green-700 mt-1" />
              <div>
                <div className="font-bold text-slate-800 text-sm">Trial balance ready</div>
                <div className="text-xs text-slate-500 mt-1">Use posted transactions to reconcile cash and bank balances.</div>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/trial-balance')} className="mt-4 text-sm font-semibold text-coop-blue hover:underline">View Reconciliations</button>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button onClick={() => openNewTransaction('income')} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-medium hover:bg-slate-50"><Plus size={15} className="text-coop-blue" /> Add New Transaction</button>
            <button onClick={() => toast.error('Transfers require a balanced ledger workflow and are not available yet')} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-medium hover:bg-slate-50"><RefreshCw size={15} className="text-coop-blue" /> Transfer Between Accounts</button>
            <button onClick={() => navigate('/trial-balance')} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-medium hover:bg-slate-50"><Landmark size={15} className="text-coop-blue" /> Bank Reconciliation</button>
            <button onClick={() => navigate('/chart-of-accounts')} className="w-full flex items-center gap-3 border border-slate-200 rounded-lg p-3 text-left text-sm font-medium hover:bg-slate-50"><FileText size={15} className="text-coop-blue" /> Chart of Accounts</button>
          </div>
        </section>
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Transaction Details</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedTransaction.reference}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-slate-400">Date</div><div className="font-medium">{selectedTransaction.date ? new Date(selectedTransaction.date).toLocaleString() : '-'}</div></div>
              <div><div className="text-xs text-slate-400">Type</div><div className="font-medium capitalize">{selectedTransaction.type}</div></div>
              <div className="col-span-2"><div className="text-xs text-slate-400">Description</div><div className="font-medium">{selectedTransaction.description}</div></div>
              <div><div className="text-xs text-slate-400">Account</div><div className="font-medium">{selectedTransaction.account}</div></div>
              <div><div className="text-xs text-slate-400">Payment</div><div className="font-medium">{selectedTransaction.paymentMethod || '-'}</div></div>
              {selectedTransaction.paymentMethod === 'Cheque' && <div><div className="text-xs text-slate-400">Cheque Number</div><div className="font-medium font-mono">{selectedTransaction.chequeNumber || '-'}</div></div>}
              <div><div className="text-xs text-slate-400">Debit</div><div className="font-medium text-green-700">{selectedTransaction.debit ? fmtNGN(selectedTransaction.debit) : '-'}</div></div>
              <div><div className="text-xs text-slate-400">Credit</div><div className="font-medium text-red-600">{selectedTransaction.credit ? fmtNGN(selectedTransaction.credit) : '-'}</div></div>
              <div><div className="text-xs text-slate-400">Balance</div><div className="font-medium">{fmtNGN(selectedTransaction.balance)}</div></div>
              <div><div className="text-xs text-slate-400">Posted By</div><div className="font-medium">{selectedTransaction.postedBy || '-'}</div></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelectedTransaction(null)} className="flex-1 btn-secondary justify-center">Close</button>
              <button onClick={() => exportSingle(selectedTransaction)} className="flex-1 btn-success justify-center">Export</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 animate-fadeIn">
            <h3 className="text-lg font-bold text-slate-900 mb-4">New Transaction</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input type="text" value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} className="input-field" placeholder="Transaction description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
                  <select value={form.accountId} onChange={event => setForm(prev => ({ ...prev, accountId: Number(event.target.value) }))} className="input-field">
                    <option value={1}>Cash Account</option><option value={2}>Bank Account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select value={form.txnType} onChange={event => setForm(prev => ({ ...prev, txnType: event.target.value as TransactionType }))} className="input-field">
                    <option value="income">Income</option><option value="expense">Expense</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input type="number" value={form.amount} onChange={event => setForm(prev => ({ ...prev, amount: event.target.value }))} className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select value={form.paymentMethod} onChange={event => setForm(prev => ({ ...prev, paymentMethod: event.target.value, chequeNumber: event.target.value === 'Cheque' ? prev.chequeNumber : '' }))} className="input-field">
                  <option>Cash</option><option>Bank Transfer</option><option>Cheque</option>
                </select>
              </div>
              {form.paymentMethod === 'Cheque' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cheque Number</label>
                  <input type="text" value={form.chequeNumber} onChange={event => setForm(prev => ({ ...prev, chequeNumber: event.target.value }))} className="input-field" placeholder="Enter cheque number" />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary justify-center">Cancel</button>
              <button onClick={postTransaction} className="flex-1 btn-success justify-center">Post Transaction</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
