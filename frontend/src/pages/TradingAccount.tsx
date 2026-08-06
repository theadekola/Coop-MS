import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import { Download, Eye, Info, Package, Printer, RefreshCw, ShoppingBag, ShoppingCart, TrendingUp } from 'lucide-react'
import { Area as ReArea, AreaChart as ReAreaChart, CartesianGrid as ReCartesianGrid, ResponsiveContainer as ReResponsiveContainer, Tooltip as ReTooltip, XAxis as ReXAxis, YAxis as ReYAxis } from 'recharts'
import { accountsApi } from '../services/api'
import type { TransactionType } from '../types'

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtNGN = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value || 0)
const fmtAmount = (value: number) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtShort = (value: number) => value >= 1000000 ? `${Math.round(value / 1000000)}M` : value >= 1000 ? `${Math.round(value / 1000)}K` : `${value}`
const currentYear = new Date().getFullYear()

type TradingData = Awaited<ReturnType<typeof accountsApi.tradingAccount>>
type AccountRow = { AccountName: string; Amount: number; TxnType: TransactionType }

function MetricCard({ icon, label, value, sub, tone, border }: { icon: ReactNode; label: string; value: string; sub: string; tone: string; border: string }) {
  return (
    <div className={`bg-white rounded-xl border ${border} p-4 shadow-sm`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-coop-blue">{label}</div>
          <div className="text-xl font-bold text-navy mt-1 truncate">{value}</div>
          <div className="text-xs text-slate-500 mt-1">{sub}</div>
        </div>
      </div>
    </div>
  )
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function extractAmount(rows: AccountRow[], patterns: RegExp[]) {
  return rows
    .filter(row => patterns.some(pattern => pattern.test(row.AccountName)))
    .reduce((sum, row) => sum + Number(row.Amount || 0), 0)
}

function DetailModal({ title, rows, total, onClose }: { title: string; rows: AccountRow[]; total: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-lg text-navy">{title}</h3>
            <p className="text-xs text-slate-500 mt-1">Breakdown from posted account transactions.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50">x</button>
        </div>
        <div className="p-5 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-slate-600 bg-slate-50 px-4 py-3">Description</th>
                <th className="text-right text-xs font-semibold text-slate-600 bg-slate-50 px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={`${title}-${row.AccountName}`} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-sm text-slate-700">{row.AccountName}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-navy">{fmtNGN(Number(row.Amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-4 py-3 text-sm font-bold text-navy">Total</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-coop-blue">{fmtNGN(total)}</td>
              </tr>
            </tfoot>
          </table>
          {rows.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No records found.</div>}
        </div>
      </div>
    </div>
  )
}

export default function TradingAccount() {
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<TradingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<'sales' | 'purchases' | 'items' | null>(null)

  const loadTradingAccount = async () => {
    try {
      setLoading(true)
      setData(await accountsApi.tradingAccount(year))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load trading account')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTradingAccount() }, [year])

  const chartData = useMemo(() => {
    const values = new Map((data?.monthly || []).map(row => [Number(row.MonthNo), Number(row.Profit)]))
    return monthNames.map((month, index) => ({ month, profit: values.get(index + 1) || 0 }))
  }, [data])

  const rows = data?.byAccount || []
  const incomeRows = rows.filter(row => row.TxnType === 'income')
  const expenseRows = rows.filter(row => row.TxnType === 'expense')
  const summary = data?.summary || { TotalSales: 0, TotalPurchases: 0, GrossProfit: 0 }
  const totalSales = Number(summary.TotalSales || 0)
  const totalPurchases = Number(summary.TotalPurchases || 0)
  const grossProfit = Number(summary.GrossProfit || 0)
  const openingStock = extractAmount(expenseRows, [/opening/i, /stock brought/i])
  const closingStock = extractAmount(incomeRows, [/closing/i, /stock carried/i])
  const purchaseReturns = extractAmount(incomeRows, [/purchase return/i])
  const salesReturns = extractAmount(expenseRows, [/sales return/i])
  const salesDiscounts = extractAmount(expenseRows, [/sales discount/i])
  const carriage = extractAmount(expenseRows, [/carriage/i, /freight/i, /transport/i])
  const netSales = Math.max(0, totalSales - salesReturns - salesDiscounts)
  const costAvailable = openingStock + totalPurchases + carriage - purchaseReturns
  const costOfGoodsSold = Math.max(0, costAvailable - closingStock)
  const displayedGrossProfit = netSales - costOfGoodsSold || grossProfit
  const margin = netSales ? (displayedGrossProfit / netSales) * 100 : 0
  const closingStockRatio = costAvailable ? (closingStock / costAvailable) * 100 : 0
  const hasTradingData = totalSales !== 0 || totalPurchases !== 0 || rows.length > 0
  const periodText = `01/01/${year} - 31/12/${year}`

  const exportCsv = () => {
    const csvRows = [
      ['Trading Account', year],
      ['Period', periodText],
      ['Total Sales', totalSales],
      ['Total Purchases', totalPurchases],
      ['Opening Stock', openingStock],
      ['Closing Stock', closingStock],
      ['Cost of Goods Sold', costOfGoodsSold],
      ['Net Sales', netSales],
      ['Gross Profit', displayedGrossProfit],
      ['Gross Profit Margin', `${margin.toFixed(2)}%`],
      [],
      ['Account Breakdown'],
      ['Account', 'Type', 'Amount'],
      ...rows.map(row => [row.AccountName, row.TxnType, Number(row.Amount || 0)]),
    ]
    const csv = csvRows.map(row => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `trading-account-${year}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const detailRows = detail === 'sales' ? incomeRows : detail === 'purchases' ? expenseRows : [...incomeRows, ...expenseRows].sort((a, b) => Number(b.Amount) - Number(a.Amount)).slice(0, 10)
  const detailTotal = detail === 'sales' ? totalSales : detail === 'purchases' ? totalPurchases : detailRows.reduce((sum, row) => sum + Number(row.Amount || 0), 0)

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Trading Account</h2>
          <p className="text-sm text-slate-500 mt-1">View summary of gross profit or loss for the selected financial year.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="trading-year">Select Financial Year</label>
          <select id="trading-year" value={year} onChange={event => setYear(Number(event.target.value))} className="input-field w-44">
            {[0, 1, 2, 3, 4].map(offset => {
              const option = currentYear - offset
              return <option key={option} value={option}>{option}</option>
            })}
          </select>
          <div className="input-field w-56 text-sm text-slate-700 flex items-center">{periodText}</div>
          <button onClick={loadTradingAccount} className="btn-secondary"><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => window.print()} className="btn-secondary"><Printer size={14} /> Print</button>
          <button onClick={exportCsv} className="btn-success"><Download size={14} /> Export</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard icon={<ShoppingBag size={23} className="text-blue-700" />} tone="bg-blue-100" border="border-blue-100" label="Total Sales (Income)" value={fmtNGN(totalSales)} sub={loading ? 'Loading...' : 'This year'} />
        <MetricCard icon={<ShoppingCart size={23} className="text-green-700" />} tone="bg-green-100" border="border-green-100" label="Total Purchases" value={fmtNGN(totalPurchases)} sub={loading ? 'Loading...' : 'This year'} />
        <MetricCard icon={<Package size={23} className="text-orange-700" />} tone="bg-orange-100" border="border-orange-100" label="Opening Stock" value={fmtNGN(openingStock)} sub={`As at 01/01/${year}`} />
        <MetricCard icon={<Package size={23} className="text-purple-700" />} tone="bg-purple-100" border="border-purple-100" label="Closing Stock" value={fmtNGN(closingStock)} sub={`As at 31/12/${year}`} />
        <MetricCard icon={<TrendingUp size={23} className={displayedGrossProfit >= 0 ? 'text-green-700' : 'text-red-700'} />} tone={displayedGrossProfit >= 0 ? 'bg-green-100' : 'bg-red-100'} border={displayedGrossProfit >= 0 ? 'border-green-100' : 'border-red-100'} label="Gross Profit" value={fmtNGN(displayedGrossProfit)} sub="This year" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <section className="xl:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <h3 className="font-bold text-navy mb-4">Trading Account Statement</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StatementTable rows={[
              ['Opening Stock', openingStock, 'normal'],
              ['Add: Purchases', totalPurchases, 'normal'],
              ['Add: Carriage Inwards', carriage, 'normal'],
              ['Less: Purchase Returns', purchaseReturns, 'danger'],
              ['Cost of Goods Available for Sale', costAvailable, 'primary'],
              ['Less: Closing Stock', closingStock, 'danger'],
              ['Cost of Goods Sold', costOfGoodsSold, 'primary'],
            ]} />
            <StatementTable rows={[
              ['Sales (Income)', totalSales, 'normal'],
              ['Less: Sales Returns', salesReturns, 'danger'],
              ['Less: Sales Discounts', salesDiscounts, 'danger'],
              ['Net Sales', netSales, 'primary'],
              ['Gross Profit', displayedGrossProfit, displayedGrossProfit >= 0 ? 'success' : 'danger'],
            ]} />
          </div>
          <div className={`mt-5 rounded-xl border p-4 flex items-center justify-between ${displayedGrossProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <span className={`font-bold ${displayedGrossProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>Trading Account Result ({displayedGrossProfit >= 0 ? 'Gross Profit' : 'Gross Loss'})</span>
            <span className={`text-2xl font-bold ${displayedGrossProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtNGN(displayedGrossProfit)}</span>
          </div>
        </section>

        <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy">Gross Profit Trend</h3>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium bg-white">
              <option>Monthly</option>
            </select>
          </div>
          <div className="h-64">
            <ReResponsiveContainer width="100%" height="100%">
              <ReAreaChart data={chartData}>
                <defs>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <ReCartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <ReXAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <ReYAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <ReTooltip formatter={(value: number) => [fmtNGN(value), 'Gross Profit']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <ReArea type="monotone" dataKey="profit" stroke="#16A34A" fill="url(#profitFill)" strokeWidth={2.5} dot={{ fill: '#16A34A', r: 3 }} />
              </ReAreaChart>
            </ReResponsiveContainer>
          </div>
          <h3 className="font-bold text-navy mt-6 mb-3">Key Ratios</h3>
          <RatioRow label="Gross Profit" value={fmtNGN(displayedGrossProfit)} />
          <RatioRow label="Gross Profit Margin" value={`${margin.toFixed(2)}%`} positive />
          <RatioRow label="Cost of Sales" value={fmtNGN(costOfGoodsSold)} />
          <RatioRow label="Net Sales" value={fmtNGN(netSales)} />
          <RatioRow label="Closing Stock Ratio" value={`${closingStockRatio.toFixed(2)}%`} />
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SummaryPanel title="Sales Summary" action="View Details" rows={incomeRows} totalLabel="Total Sales (Income)" total={totalSales} percentBase={totalSales} onAction={() => setDetail('sales')} />
        <SummaryPanel title="Purchases Summary" action="View Details" rows={expenseRows} totalLabel="Total Purchases" total={totalPurchases} percentBase={totalPurchases} onAction={() => setDetail('purchases')} />
        <SummaryPanel title="Top Selling Items" action="View All Items" rows={[...incomeRows].sort((a, b) => Number(b.Amount) - Number(a.Amount)).slice(0, 5)} totalLabel="Total" total={totalSales} percentBase={totalSales} onAction={() => setDetail('items')} />
      </div>

      {!loading && !hasTradingData && (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          No trading account entries found for {year}. Post income and expense transactions to populate this report.
        </div>
      )}

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.
      </footer>

      {detail && (
        <DetailModal
          title={detail === 'sales' ? 'Sales Details' : detail === 'purchases' ? 'Purchases Details' : 'Top Selling Items'}
          rows={detailRows}
          total={detailTotal}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

function StatementTable({ rows }: { rows: [string, number, 'normal' | 'primary' | 'success' | 'danger'][] }) {
  return (
    <table className="w-full border border-slate-100 rounded-xl overflow-hidden">
      <thead>
        <tr>
          <th className="text-left text-xs font-bold text-navy bg-slate-50 px-4 py-3">Particulars</th>
          <th className="text-right text-xs font-bold text-navy bg-slate-50 px-4 py-3">Amount (N)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value, tone]) => (
          <tr key={label} className={`border-t border-slate-100 ${tone === 'primary' || tone === 'success' ? 'bg-slate-50' : ''}`}>
            <td className={`px-4 py-3 text-sm ${tone === 'primary' ? 'font-bold text-coop-blue' : tone === 'success' ? 'font-bold text-green-700' : 'text-slate-700'}`}>{label}</td>
            <td className={`px-4 py-3 text-sm text-right ${tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-green-700 font-bold' : tone === 'primary' ? 'text-coop-blue font-bold' : 'text-navy'}`}>{fmtAmount(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RatioRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-600 flex items-center gap-1">{label}<Info size={12} className="text-slate-300" /></span>
      <span className={`font-bold ${positive ? 'text-green-700' : 'text-navy'}`}>{value}</span>
    </div>
  )
}

function SummaryPanel({ title, action, rows, totalLabel, total, percentBase, onAction }: { title: string; action: string; rows: AccountRow[]; totalLabel: string; total: number; percentBase: number; onAction: () => void }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-bold text-navy">{title}</h3>
        <button onClick={onAction} className="btn-secondary !py-1.5 !px-3 text-xs"><Eye size={13} /> {action}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-slate-600 bg-slate-50 px-4 py-3">Description</th>
              <th className="text-right text-xs font-semibold text-slate-600 bg-slate-50 px-4 py-3">Amount (N)</th>
              <th className="text-right text-xs font-semibold text-slate-600 bg-slate-50 px-4 py-3">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${title}-${row.AccountName}`} className="border-t border-slate-100">
                <td className="px-4 py-3 text-sm text-slate-700">{row.AccountName}</td>
                <td className="px-4 py-3 text-sm text-right text-navy">{fmtAmount(Number(row.Amount))}</td>
                <td className="px-4 py-3 text-sm text-right text-slate-600">{percentBase ? ((Number(row.Amount) / percentBase) * 100).toFixed(2) : '0.00'}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-4 py-3 text-sm font-bold text-coop-blue">{totalLabel}</td>
              <td className="px-4 py-3 text-sm text-right font-bold text-coop-blue">{fmtAmount(total)}</td>
              <td className="px-4 py-3 text-sm text-right font-bold text-navy">{percentBase ? '100%' : '0%'}</td>
            </tr>
          </tfoot>
        </table>
        {rows.length === 0 && <div className="py-8 text-center text-sm text-slate-400">No records found.</div>}
      </div>
    </section>
  )
}
