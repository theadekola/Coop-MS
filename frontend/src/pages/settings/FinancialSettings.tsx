import { FormEvent, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileText,
  Hash,
  Landmark,
  LineChart,
  Percent,
  Plus,
  RefreshCcw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { settingsApi } from '../../services/api'

type TabId =
  | 'currency'
  | 'accounting'
  | 'numbering'
  | 'banking'
  | 'fiscal'
  | 'interest'
  | 'approval'
  | 'budget'
  | 'alerts'

type TableKey =
  | 'numberingSequences'
  | 'referenceCodes'
  | 'bankAccounts'
  | 'paymentMethods'
  | 'paymentGateways'
  | 'fiscalYears'
  | 'accountingPeriods'
  | 'interestRates'
  | 'chargesFees'
  | 'approvalWorkflows'
  | 'approvalLevels'
  | 'pendingApprovals'
  | 'budgets'
  | 'forecasts'
  | 'financialAlerts'
  | 'alertHistory'

type FieldKind = 'text' | 'number' | 'date' | 'select'
type Row = { id: string; [key: string]: string }
type FieldDef = { key: string; label: string; kind?: FieldKind; options?: string[]; required?: boolean }
type FinancialState = {
  settings: Record<string, string | boolean>
  tables: Record<TableKey, Row[]>
  updatedAt: string
}
type ModalState = { table: TableKey; mode: 'add' | 'edit' | 'view'; row?: Row } | null

const STORAGE_KEY = 'oshodi_financial_settings_v2'
const SETTINGS_SCOPE = 'financial-settings'
const NAIRA = String.fromCharCode(0x20a6)

const tabs: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: 'currency', label: 'Currency & General', icon: Building2 },
  { id: 'accounting', label: 'Accounting Preferences', icon: FileText },
  { id: 'numbering', label: 'Numbering & Codes', icon: Hash },
  { id: 'banking', label: 'Bank & Payment Settings', icon: Landmark },
  { id: 'fiscal', label: 'Fiscal Year & Periods', icon: CalendarDays },
  { id: 'interest', label: 'Interest & Charges', icon: Percent },
  { id: 'approval', label: 'Financial Approval', icon: ShieldCheck },
  { id: 'budget', label: 'Budget & Forecasting', icon: LineChart },
  { id: 'alerts', label: 'Financial Alerts', icon: Bell },
]

const sectionTabs: Record<string, TabId> = {
  currency: 'currency',
  accounting: 'accounting',
  numbering: 'numbering',
  banking: 'banking',
  bank: 'banking',
  fiscal: 'fiscal',
  interest: 'interest',
  approval: 'approval',
  budget: 'budget',
  alerts: 'alerts',
}

const defaultSettings: Record<string, string | boolean> = {
  baseCurrency: `Nigerian Naira (${NAIRA}) - NGN`,
  currencySymbol: NAIRA,
  currencyPosition: `Before Amount (${NAIRA}100.00)`,
  decimalPlaces: '2',
  thousandsSeparator: 'Comma (,)',
  decimalSeparator: 'Period (.)',
  enableMultiCurrency: false,
  exchangeRateSource: 'Central Bank of Nigeria',
  exchangeRateUpdateFrequency: 'Daily',
  enableRounding: true,
  roundingType: 'Nearest Naira',
  negativeAmountDisplay: 'In Brackets (100.00)',
  defaultReportCurrency: 'Base Currency',
  defaultChartOfAccounts: 'Cooperative Standard Chart',
  financialYearStart: 'January',
  financialYearEnd: 'December',
  documentPrefix: 'OIEC',
  numberFormat: 'OIEC-YYYY-000001',
  defaultCashAccount: 'Cash at Bank',
  defaultRevenueAccount: 'Cooperative Revenue',
  defaultExpenseAccount: 'General Expense',
  defaultPaymentMethod: 'Bank Transfer',
  defaultReceiptMethod: 'Bank Transfer',
  dailyTransferLimit: '25000',
  singleTransactionLimit: '10000',
  receiptAutoNumber: true,
  paymentAutoNumber: true,
  accountingMethod: 'Accrual',
  accountingBasis: 'Historical Cost',
  revenueRecognition: 'When Earned',
  expenseRecognition: 'When Incurred',
  allowAccountDeletion: 'No',
  accountCodeSeparator: 'Dash (-)',
  accountCodeLength: 'Up to 10 Characters',
  showInactiveAccounts: true,
  requireAccountDescription: 'Hide in Reports',
  defaultPostingDate: 'Transaction Date',
  allowBackdatedTransactions: true,
  autoPostTransactions: true,
  postDeletesAsReversingEntries: false,
  warnOnUnbalancedTransactions: true,
  pricesIncludeTax: false,
  defaultTaxRate: '7.50',
  defaultTaxAccount: 'VAT Payable',
  accountingDefaultCurrency: 'NGN - Nigerian Naira',
  quantityDecimalPlaces: '2',
  displayNegativeNumbersAs: '-100.00',
  defaultReportBasis: 'Accrual',
  reportDateFormat: '28 Jun 2025',
  comparativeStatements: true,
  showZeroBalanceAccounts: false,
  allowMemoTransactions: true,
  requireNarration: false,
  defaultReferenceRequired: false,
  enableAuditTrail: true,
  lockClosedPeriods: true,
  notifyOnPeriodClose: true,
  sequenceDescription: 'Automatic numbering for receipt transactions',
  sequenceYearFormat: String(new Date().getFullYear()),
  sequenceStartingNumber: '1',
  enablePenalty: true,
  defaultInterestRate: '0.00',
  penaltyRate: '2.00',
  penaltyFrequency: 'Per Month',
  gracePeriod: '5',
  maximumPenaltyRate: '5.00',
  penaltyCap: '50000',
  dayCountConvention: 'Actual/365',
  postInterestFrequency: 'Monthly',
  applyInterestOn: 'Daily Closing Balance',
  capitaliseInterest: false,
  waiveInterestEarlyRepayment: true,
  applyInterestOnHolidays: true,
  interestInSuspension: false,
  printChargesOnReceipts: true,
  enforceApprovalWorkflows: true,
  allowRequesterApproval: false,
  approveByMajority: false,
  notifyApprovers: true,
  approvalExpiryDays: '7',
  inAppAlerts: true,
  emailAlerts: true,
  smsAlerts: false,
  dashboardAlerts: true,
}

const emptyTables: Record<TableKey, Row[]> = {
  numberingSequences: [],
  referenceCodes: [],
  bankAccounts: [],
  paymentMethods: [],
  paymentGateways: [],
  fiscalYears: [],
  accountingPeriods: [],
  interestRates: [],
  chargesFees: [],
  approvalWorkflows: [],
  approvalLevels: [],
  pendingApprovals: [],
  budgets: [],
  forecasts: [],
  financialAlerts: [],
  alertHistory: [],
}

const tableLabels: Record<TableKey, string> = {
  numberingSequences: 'Numbering Sequences',
  referenceCodes: 'Reference Codes',
  bankAccounts: 'Bank Accounts',
  paymentMethods: 'Payment Methods',
  paymentGateways: 'Payment Gateways',
  fiscalYears: 'Fiscal Years',
  accountingPeriods: 'Accounting Periods',
  interestRates: 'Interest Rates',
  chargesFees: 'Charges & Fees',
  approvalWorkflows: 'Approval Workflows',
  approvalLevels: 'Approval Levels',
  pendingApprovals: 'Pending Approvals',
  budgets: 'Budgets',
  forecasts: 'Forecasts',
  financialAlerts: 'Alerts List',
  alertHistory: 'Recent Alert History',
}

const tableFields: Record<TableKey, FieldDef[]> = {
  numberingSequences: [
    { key: 'name', label: 'Sequence Name', required: true },
    { key: 'prefix', label: 'Prefix', required: true },
    { key: 'format', label: 'Format' },
    { key: 'lastNumber', label: 'Last Number' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Inactive'] },
  ],
  referenceCodes: [
    { key: 'type', label: 'Code Type', required: true },
    { key: 'description', label: 'Description' },
    { key: 'format', label: 'Code Format' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Inactive'] },
  ],
  bankAccounts: [
    { key: 'bankName', label: 'Bank Name', required: true },
    { key: 'accountName', label: 'Account Name', required: true },
    { key: 'accountNumber', label: 'Account Number', required: true },
    { key: 'currency', label: 'Currency' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Inactive'] },
  ],
  paymentMethods: [
    { key: 'name', label: 'Method Name', required: true },
    { key: 'type', label: 'Type', kind: 'select', options: ['Bank', 'Cash', 'Card', 'Mobile', 'Cheque', 'Online'] },
    { key: 'provider', label: 'Provider / Details' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Enabled', 'Disabled'] },
  ],
  paymentGateways: [
    { key: 'name', label: 'Gateway Name', required: true },
    { key: 'provider', label: 'Provider' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Connected', 'Disconnected', 'Test Mode'] },
    { key: 'mode', label: 'Mode', kind: 'select', options: ['Live', 'Test'] },
  ],
  fiscalYears: [
    { key: 'year', label: 'Year', required: true },
    { key: 'startDate', label: 'Start Date', kind: 'date' },
    { key: 'endDate', label: 'End Date', kind: 'date' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Closed'] },
  ],
  accountingPeriods: [
    { key: 'period', label: 'Period', required: true },
    { key: 'periodStart', label: 'Period Start', kind: 'date' },
    { key: 'periodEnd', label: 'Period End', kind: 'date' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Open', 'Closed', 'Locked', 'Upcoming'] },
  ],
  interestRates: [
    { key: 'name', label: 'Rate Name', required: true },
    { key: 'appliesTo', label: 'Applies To' },
    { key: 'rateType', label: 'Rate Type', kind: 'select', options: ['Reducing Balance', 'Flat', 'Compound'] },
    { key: 'rate', label: 'Rate (%)', kind: 'number' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Inactive'] },
  ],
  chargesFees: [
    { key: 'name', label: 'Charge Name', required: true },
    { key: 'appliesTo', label: 'Applies To' },
    { key: 'amount', label: 'Amount', kind: 'number' },
    { key: 'chargeType', label: 'Charge Type', kind: 'select', options: ['One-time', 'Percentage', 'Flat', 'Per Transaction'] },
    { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Inactive'] },
  ],
  approvalWorkflows: [
    { key: 'name', label: 'Workflow Name', required: true },
    { key: 'module', label: 'Module' },
    { key: 'levels', label: 'Levels', kind: 'number' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Inactive'] },
  ],
  approvalLevels: [
    { key: 'level', label: 'Level', kind: 'number' },
    { key: 'name', label: 'Level Name', required: true },
    { key: 'approverRole', label: 'Approver Role' },
    { key: 'limit', label: 'Approval Limit', kind: 'number' },
    { key: 'required', label: 'Required', kind: 'select', options: ['Yes', 'No'] },
  ],
  pendingApprovals: [
    { key: 'reference', label: 'Reference', required: true },
    { key: 'module', label: 'Module' },
    { key: 'requester', label: 'Requester' },
    { key: 'amount', label: 'Amount', kind: 'number' },
    { key: 'requestedOn', label: 'Requested On', kind: 'date' },
  ],
  budgets: [
    { key: 'name', label: 'Budget Name', required: true },
    { key: 'department', label: 'Department / Project' },
    { key: 'amount', label: 'Budget Amount', kind: 'number' },
    { key: 'year', label: 'Fiscal Year' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Inactive'] },
  ],
  forecasts: [
    { key: 'category', label: 'Category', required: true },
    { key: 'budget', label: 'Budget', kind: 'number' },
    { key: 'forecast', label: 'Forecast', kind: 'number' },
    { key: 'variance', label: 'Variance', kind: 'number' },
  ],
  financialAlerts: [
    { key: 'name', label: 'Alert Name', required: true },
    { key: 'category', label: 'Category' },
    { key: 'condition', label: 'Trigger Condition' },
    { key: 'recipients', label: 'Recipients', kind: 'number' },
    { key: 'status', label: 'Status', kind: 'select', options: ['Active', 'Paused', 'Inactive'] },
  ],
  alertHistory: [
    { key: 'name', label: 'Alert Name', required: true },
    { key: 'triggeredOn', label: 'Triggered On', kind: 'date' },
    { key: 'severity', label: 'Severity', kind: 'select', options: ['Low', 'Medium', 'High'] },
    { key: 'message', label: 'Message' },
    { key: 'status', label: 'Status', kind: 'select', options: ['New', 'Acknowledged', 'Resolved'] },
  ],
}

const normalizeSettings = (settings: Record<string, string | boolean>) => ({
  ...settings,
  baseCurrency: `Nigerian Naira (${NAIRA}) - NGN`,
  currencySymbol: NAIRA,
  currencyPosition: `Before Amount (${NAIRA}100.00)`,
})

const createEmptyState = (): FinancialState => ({
  settings: normalizeSettings({ ...defaultSettings }),
  tables: { ...emptyTables },
  updatedAt: new Date().toISOString(),
})

const loadState = () => {localStorage.removeItem(STORAGE_KEY);return createEmptyState()}

const formatCurrency = (value: number) =>
  `${NAIRA}${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const toNumber = (value: string | undefined) => Number(String(value || '0').replace(/,/g, '')) || 0

const downloadCsv = (name: string, rows: Row[]) => {
  if (!rows.length) {
    toast.error('There is no data to export yet.')
    return
  }
  const headers = Object.keys(rows[0]).filter((key) => key !== 'id')
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [headers, ...rows.map((row) => headers.map((key) => row[key] || ''))]
    .map((line) => line.map(escape).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-coop-blue' : 'bg-slate-300'}`}
  >
    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
  </button>
)

const Card = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4">
      <h3 className="text-sm font-bold text-navy">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
    {children}
  </section>
)

const StatCard = ({
  icon: Icon,
  label,
  value,
  tone = 'blue',
  action,
  onClick,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  tone?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
  action?: string
  onClick?: () => void
}) => {
  const tones = {
    blue: 'bg-blue-100 text-coop-blue',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-coop-blue hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tones[tone]}`}>
          <Icon size={22} />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-black text-navy">{value}</p>
        </div>
      </div>
      {action && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-coop-blue">
          {action} <ChevronRight size={14} />
        </span>
      )}
    </button>
  )
}

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: FieldKind
  options?: string[]
}) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold text-navy">{label}</span>
    {type === 'select' ? (
      <select value={value} onChange={(event) => onChange(event.target.value)} className="input-field h-10 text-sm">
        {(options || []).map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    ) : (
      <input
        type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-field h-10 text-sm"
      />
    )}
  </label>
)

const StatusBadge = ({ value }: { value?: string }) => {
  const raw = value || 'Active'
  const tone =
    raw === 'Active' || raw === 'Enabled' || raw === 'Open' || raw === 'Connected'
      ? 'bg-green-100 text-green-700'
      : raw === 'Paused' || raw === 'Upcoming' || raw === 'Test Mode'
        ? 'bg-orange-100 text-orange-700'
        : 'bg-slate-100 text-slate-600'
  return <span className={`rounded px-2 py-1 text-[11px] font-bold ${tone}`}>{raw}</span>
}

function FinancialSettings() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>(() => sectionTabs[searchParams.get('section') || ''] || 'currency')
  const [state, setState] = useState<FinancialState>(() => loadState())
  const [modal, setModal] = useState<ModalState>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const section = searchParams.get('section')
    if (section && sectionTabs[section]) setActiveTab(sectionTabs[section])
  }, [searchParams])

  useEffect(() => {
    let mounted = true
    settingsApi.get<FinancialState>(SETTINGS_SCOPE)
      .then((saved) => {
        if (!mounted || !saved || !Object.keys(saved).length) return
        const next: FinancialState = {
          settings: normalizeSettings({ ...defaultSettings, ...(saved.settings || {}) }),
          tables: { ...emptyTables, ...(saved.tables || {}) },
          updatedAt: saved.updatedAt || new Date().toISOString(),
        }
        setState(next)
      })
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [])

  const setSetting = (key: string, value: string | boolean) =>
    setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } }))

  const saveAll = async () => {
    const next = { ...state, updatedAt: new Date().toISOString() }
    setSaving(true)
    try {
      const saved = await settingsApi.save<FinancialState>(SETTINGS_SCOPE, next)
      const merged: FinancialState = {
        settings: normalizeSettings({ ...defaultSettings, ...(saved.settings || next.settings) }),
        tables: { ...emptyTables, ...(saved.tables || next.tables) },
        updatedAt: saved.updatedAt || next.updatedAt,
      }
      setState(merged)
      toast.success('Financial settings saved.')
    } catch {
      toast.error('The server did not save financial settings. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    const next = createEmptyState()
    setSaving(true)
    try {
      const saved = await settingsApi.save<FinancialState>(SETTINGS_SCOPE, next)
      setState(saved)
      toast.success('Financial settings reset to default.')
    } catch {
      toast.error('The server did not reset financial settings. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  const saveRow = (table: TableKey, row: Row) => {
    setState((current) => {
      const rows = current.tables[table]
      const exists = rows.some((item) => item.id === row.id)
      return {
        ...current,
        tables: {
          ...current.tables,
          [table]: exists ? rows.map((item) => (item.id === row.id ? row : item)) : [...rows, row],
        },
      }
    })
    setModal(null)
    toast.success(`${tableLabels[table]} updated.`)
  }

  const deleteRow = (table: TableKey, rowId: string) => {
    setState((current) => ({
      ...current,
      tables: { ...current.tables, [table]: current.tables[table].filter((row) => row.id !== rowId) },
    }))
    toast.success('Record deleted.')
  }

  const updateFirstPeriodStatus = (status: string) => {
    const target = state.tables.accountingPeriods.find((row) => row.status === 'Open') || state.tables.accountingPeriods[0]
    if (!target) {
      toast.error('Add an accounting period first.')
      return
    }
    setState((current) => ({
      ...current,
      tables: {
        ...current.tables,
        accountingPeriods: current.tables.accountingPeriods.map((row) =>
          row.id === target.id ? { ...row, status } : row,
        ),
      },
    }))
    toast.success(`${target.period || 'Accounting period'} marked as ${status}.`)
  }

  const runPlanningAction = (label: string) => {
    if (label === 'Create Budget') {
      setModal({ table: 'budgets', mode: 'add' })
      return
    }
    if (label === 'Create Forecast') {
      setModal({ table: 'forecasts', mode: 'add' })
      return
    }
    if (label === 'Export Reports') {
      downloadCsv('Budget Forecast Report', [...state.tables.budgets, ...state.tables.forecasts])
      return
    }
    toast.success(`${label} is ready for saved financial settings.`)
  }

  const runAlertAction = (label: string) => {
    if (label === 'Create New Alert') {
      setModal({ table: 'financialAlerts', mode: 'add' })
      return
    }
    if (label === 'Alert Report') {
      downloadCsv('Financial Alert Report', [...state.tables.financialAlerts, ...state.tables.alertHistory])
      return
    }
    toast.success(`${label} is available from this alerts workspace.`)
  }

  const tableTotal = (table: TableKey, key: string) => state.tables[table].reduce((sum, row) => sum + toNumber(row[key]), 0)
  const activeRows = (table: TableKey) =>
    state.tables[table].filter((row) => !row.status || ['Active', 'Enabled', 'Open', 'Connected'].includes(row.status)).length

  const nextNumberPreview = `${state.settings.documentPrefix || 'OIEC'}-${new Date().getFullYear()}-000001`
  const currentYear = new Date().getFullYear()
  const openPeriods = state.tables.accountingPeriods.filter((row) => row.status === 'Open').length
  const bankBalance = tableTotal('bankAccounts', 'balance')
  const budgetTotal = tableTotal('budgets', 'amount')
  const forecastTotal = tableTotal('forecasts', 'forecast')
  const activeAlerts = activeRows('financialAlerts')

  const TablePanel = ({ table, title, description }: { table: TableKey; title?: string; description?: string }) => {
    const fields = tableFields[table]
    const rows = state.tables[table]
    const visibleFields = fields.slice(0, 5)
    return (
      <Card title={title || tableLabels[table]} subtitle={description}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setModal({ table, mode: 'add' })} className="btn-secondary">
            <Plus size={15} /> Add New
          </button>
          <button type="button" onClick={() => downloadCsv(tableLabels[table], rows)} className="btn-secondary">
            <Download size={15} /> Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                {visibleFields.map((field) => (
                  <th key={field.key} className="px-3 py-3 font-bold">
                    {field.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  {visibleFields.map((field) => (
                    <td key={field.key} className="px-3 py-3 text-navy">
                      {field.key === 'status' ? <StatusBadge value={row[field.key]} /> : row[field.key] || '-'}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setModal({ table, mode: 'view', row })} className="icon-btn">
                        <Eye size={14} />
                      </button>
                      <button type="button" onClick={() => setModal({ table, mode: 'edit', row })} className="icon-btn">
                        <Edit3 size={14} />
                      </button>
                      <button type="button" onClick={() => deleteRow(table, row.id)} className="icon-btn text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={visibleFields.length + 1} className="px-3 py-10 text-center text-sm text-slate-400">
                    No records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  const settings = state.settings

  return (
    <div className="space-y-5 p-4 lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-navy">Financial Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Configure your cooperative's financial preferences and default settings.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={resetToDefault} disabled={saving} className="btn-secondary disabled:opacity-60">
            <RefreshCcw size={16} /> Reset to Default
          </button>
          <button type="button" onClick={saveAll} disabled={saving} className="btn-primary disabled:opacity-60">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-slate-200 bg-white">
        <div className="flex min-w-max">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex min-w-[132px] items-center justify-center border-b-2 px-3 py-4 text-center text-xs font-bold leading-tight transition ${
                activeTab === id ? 'border-coop-blue text-coop-blue' : 'border-transparent text-navy hover:bg-slate-50'
              }`}
            >
              <span className="whitespace-pre-line">
                {label.includes(' & ') ? label.replace(' & ', ' &\n') : label.replace(' ', '\n')}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'currency' && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Currency Settings">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Base Currency" value={String(settings.baseCurrency)} onChange={(value) => setSetting('baseCurrency', value)} />
                <Field label="Currency Symbol" value={String(settings.currencySymbol)} onChange={(value) => setSetting('currencySymbol', value)} />
                <Field
                  label="Currency Position"
                  value={String(settings.currencyPosition)}
                  onChange={(value) => setSetting('currencyPosition', value)}
                  type="select"
                  options={[`Before Amount (${NAIRA}100.00)`, `After Amount (100.00${NAIRA})`]}
                />
                <Field label="Decimal Places" value={String(settings.decimalPlaces)} onChange={(value) => setSetting('decimalPlaces', value)} type="select" options={['0', '1', '2', '3']} />
                <Field label="Thousands Separator" value={String(settings.thousandsSeparator)} onChange={(value) => setSetting('thousandsSeparator', value)} type="select" options={['Comma (,)', 'Period (.)', 'Space']} />
                <Field label="Decimal Separator" value={String(settings.decimalSeparator)} onChange={(value) => setSetting('decimalSeparator', value)} type="select" options={['Period (.)', 'Comma (,)']} />
              </div>
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-coop-blue">
                All financial transactions and reports will use this currency as the base.
              </div>
            </Card>
            <Card title="General Financial Preferences">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['enableMultiCurrency', 'Enable Multi-Currency'],
                  ['enableRounding', 'Enable Rounding'],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                    <span className="text-sm font-semibold text-navy">{label}</span>
                    <Toggle checked={Boolean(settings[key])} onChange={(value) => setSetting(key, value)} />
                  </div>
                ))}
                <Field label="Exchange Rate Source" value={String(settings.exchangeRateSource)} onChange={(value) => setSetting('exchangeRateSource', value)} type="select" options={['Central Bank of Nigeria', 'Manual Entry', 'Commercial Bank Rate']} />
                <Field label="Exchange Rate Update Frequency" value={String(settings.exchangeRateUpdateFrequency)} onChange={(value) => setSetting('exchangeRateUpdateFrequency', value)} type="select" options={['Daily', 'Weekly', 'Monthly', 'Manual']} />
                <Field label="Rounding Type" value={String(settings.roundingType)} onChange={(value) => setSetting('roundingType', value)} type="select" options={['Nearest Naira', 'Nearest Kobo', 'Round Up', 'Round Down']} />
                <Field label="Negative Amount Display" value={String(settings.negativeAmountDisplay)} onChange={(value) => setSetting('negativeAmountDisplay', value)} type="select" options={['In Brackets (100.00)', 'Minus Sign -100.00']} />
              </div>
            </Card>
          </div>
          <Card title="Financial Year Settings">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Financial Year Start" value={String(settings.financialYearStart)} onChange={(value) => setSetting('financialYearStart', value)} type="select" options={['January', 'April', 'July', 'October']} />
              <Field label="Financial Year End" value={String(settings.financialYearEnd)} onChange={(value) => setSetting('financialYearEnd', value)} type="select" options={['December', 'March', 'June', 'September']} />
              <div>
                <span className="text-xs font-bold text-navy">Current Financial Year</span>
                <p className="mt-2 text-sm font-black text-navy">{currentYear}</p>
              </div>
              <button type="button" onClick={() => setActiveTab('fiscal')} className="btn-secondary justify-center">
                <CalendarDays size={16} /> Manage Periods
              </button>
            </div>
          </Card>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Document Number Settings">
              <div className="space-y-3">
                <Field label="Document Number Prefix" value={String(settings.documentPrefix)} onChange={(value) => setSetting('documentPrefix', value)} />
                <Field label="Number Format" value={String(settings.numberFormat)} onChange={(value) => setSetting('numberFormat', value)} />
                <div className="rounded bg-slate-50 p-3 text-sm font-bold text-navy">{nextNumberPreview}</div>
                <button type="button" onClick={() => setActiveTab('numbering')} className="btn-secondary w-full justify-center">
                  Configure All Document Numbers
                </button>
              </div>
            </Card>
            <Card title="Default Accounts">
              <div className="space-y-3">
                <Field label="Default Cash Account" value={String(settings.defaultCashAccount)} onChange={(value) => setSetting('defaultCashAccount', value)} />
                <Field label="Default Revenue Account" value={String(settings.defaultRevenueAccount)} onChange={(value) => setSetting('defaultRevenueAccount', value)} />
                <Field label="Default Expense Account" value={String(settings.defaultExpenseAccount)} onChange={(value) => setSetting('defaultExpenseAccount', value)} />
                <button type="button" onClick={() => toast.success('Chart of accounts opened from Accounts page.')} className="btn-secondary w-full justify-center">
                  Manage Chart of Accounts
                </button>
              </div>
            </Card>
            <Card title="Payment & Receipt Settings">
              <div className="space-y-3">
                <Field label="Default Payment Method" value={String(settings.defaultPaymentMethod)} onChange={(value) => setSetting('defaultPaymentMethod', value)} />
                <Field label="Default Receipt Method" value={String(settings.defaultReceiptMethod)} onChange={(value) => setSetting('defaultReceiptMethod', value)} />
                <div className="flex items-center justify-between text-sm font-semibold text-navy">
                  Receipt Auto Number <Toggle checked={Boolean(settings.receiptAutoNumber)} onChange={(value) => setSetting('receiptAutoNumber', value)} />
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-navy">
                  Payment Auto Number <Toggle checked={Boolean(settings.paymentAutoNumber)} onChange={(value) => setSetting('paymentAutoNumber', value)} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'accounting' && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Chart of Accounts Preferences">
              <div className="space-y-3">
                <Field label="Default Chart of Accounts" value={String(settings.defaultChartOfAccounts)} onChange={(value) => setSetting('defaultChartOfAccounts', value)} type="select" options={['Cooperative Standard Chart', 'Custom Chart']} />
                <Field label="Allow Account Deletion" value={String(settings.allowAccountDeletion)} onChange={(value) => setSetting('allowAccountDeletion', value)} type="select" options={['No', 'Yes']} />
                <Field label="Account Code Separator" value={String(settings.accountCodeSeparator)} onChange={(value) => setSetting('accountCodeSeparator', value)} type="select" options={['Dash (-)', 'Slash (/)', 'None']} />
                <Field label="Account Code Length" value={String(settings.accountCodeLength)} onChange={(value) => setSetting('accountCodeLength', value)} type="select" options={['Up to 10 Characters', 'Up to 15 Characters']} />
                <div className="flex items-center justify-between text-sm font-semibold text-navy">Show Inactive Accounts <Toggle checked={Boolean(settings.showInactiveAccounts)} onChange={(value) => setSetting('showInactiveAccounts', value)} /></div>
              </div>
            </Card>
            <Card title="Transaction & Posting Preferences">
              <div className="space-y-3">
                <Field label="Default Posting Date" value={String(settings.defaultPostingDate)} onChange={(value) => setSetting('defaultPostingDate', value)} type="select" options={['Transaction Date', 'Posting Date']} />
                {['allowBackdatedTransactions', 'autoPostTransactions', 'postDeletesAsReversingEntries', 'warnOnUnbalancedTransactions'].map((key) => (
                  <div key={key} className="flex items-center justify-between text-sm font-semibold text-navy">
                    {key.replace(/([A-Z])/g, ' $1')} <Toggle checked={Boolean(settings[key])} onChange={(value) => setSetting(key, value)} />
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Accounting Method & Basis">
              <div className="space-y-3">
                <Field label="Accounting Method" value={String(settings.accountingMethod)} onChange={(value) => setSetting('accountingMethod', value)} type="select" options={['Accrual', 'Cash']} />
                <Field label="Accounting Basis" value={String(settings.accountingBasis)} onChange={(value) => setSetting('accountingBasis', value)} type="select" options={['Historical Cost', 'Fair Value']} />
                <Field label="Revenue Recognition" value={String(settings.revenueRecognition)} onChange={(value) => setSetting('revenueRecognition', value)} type="select" options={['When Earned', 'When Received']} />
                <Field label="Expense Recognition" value={String(settings.expenseRecognition)} onChange={(value) => setSetting('expenseRecognition', value)} type="select" options={['When Incurred', 'When Paid']} />
              </div>
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Tax & VAT Preferences">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold text-navy">Prices Include Tax <Toggle checked={Boolean(settings.pricesIncludeTax)} onChange={(value) => setSetting('pricesIncludeTax', value)} /></div>
                <Field label="Default Tax Rate" value={String(settings.defaultTaxRate)} onChange={(value) => setSetting('defaultTaxRate', value)} type="number" />
                <Field label="Tax Account" value={String(settings.defaultTaxAccount)} onChange={(value) => setSetting('defaultTaxAccount', value)} />
              </div>
            </Card>
            <Card title="Measurement & Rounding">
              <div className="space-y-3">
                <Field label="Default Currency" value={String(settings.accountingDefaultCurrency)} onChange={(value) => setSetting('accountingDefaultCurrency', value)} />
                <Field label="Amount Rounding" value={String(settings.roundingType)} onChange={(value) => setSetting('roundingType', value)} type="select" options={['Nearest Naira', 'Nearest Kobo']} />
                <Field label="Quantity Decimal Places" value={String(settings.quantityDecimalPlaces)} onChange={(value) => setSetting('quantityDecimalPlaces', value)} type="select" options={['0', '1', '2', '3']} />
                <Field label="Display Negative Numbers As" value={String(settings.displayNegativeNumbersAs)} onChange={(value) => setSetting('displayNegativeNumbersAs', value)} type="select" options={['-100.00', '(100.00)']} />
              </div>
            </Card>
            <Card title="Reports & Financial Statements">
              <div className="space-y-3">
                <Field label="Default Report Basis" value={String(settings.defaultReportBasis)} onChange={(value) => setSetting('defaultReportBasis', value)} type="select" options={['Accrual', 'Cash']} />
                <div className="flex items-center justify-between text-sm font-semibold text-navy">Comparative Financial Statements <Toggle checked={Boolean(settings.comparativeStatements)} onChange={(value) => setSetting('comparativeStatements', value)} /></div>
                <div className="flex items-center justify-between text-sm font-semibold text-navy">Show Zero Balance Accounts <Toggle checked={Boolean(settings.showZeroBalanceAccounts)} onChange={(value) => setSetting('showZeroBalanceAccounts', value)} /></div>
              </div>
            </Card>
          </div>
          <Card title="Other Preferences">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {['allowMemoTransactions', 'requireNarration', 'defaultReferenceRequired', 'enableAuditTrail', 'lockClosedPeriods', 'notifyOnPeriodClose'].map((key) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-xs font-semibold text-navy">
                  {key.replace(/([A-Z])/g, ' $1')} <Toggle checked={Boolean(settings[key])} onChange={(value) => setSetting(key, value)} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'numbering' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={FileText} label="Numbering Sequences" value={state.tables.numberingSequences.length} action="View All" />
            <StatCard icon={Hash} label="Reference Codes" value={state.tables.referenceCodes.length} tone="green" action="View All" />
            <StatCard icon={RefreshCcw} label="Last Numbers Used" value={state.tables.numberingSequences.reduce((sum, row) => sum + toNumber(row.lastNumber), 0)} tone="purple" />
            <StatCard icon={CheckCircle2} label="Numbering Status" value="Auto" tone="orange" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TablePanel table="numberingSequences" description="Manage automatic numbering for transactions and documents." />
            <TablePanel table="referenceCodes" description="Manage reference codes used for classifications and tagging." />
          </div>
          <Card title="Sequence Details & Configuration">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Sequence Description" value={String(settings.sequenceDescription)} onChange={(value) => setSetting('sequenceDescription', value)} />
              <Field label="Prefix" value={String(settings.documentPrefix)} onChange={(value) => setSetting('documentPrefix', value)} />
              <Field label="Year Format" value={String(settings.sequenceYearFormat)} onChange={(value) => setSetting('sequenceYearFormat', value)} />
              <Field label="Starting Number" value={String(settings.sequenceStartingNumber)} onChange={(value) => setSetting('sequenceStartingNumber', value)} type="number" />
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'banking' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={Landmark} label="Bank Accounts" value={state.tables.bankAccounts.length} action="Manage Accounts" />
            <StatCard icon={CreditCard} label="Payment Methods" value={state.tables.paymentMethods.length} tone="blue" action="Manage Methods" />
            <StatCard icon={RefreshCcw} label="Payment Gateways" value={state.tables.paymentGateways.length} tone="purple" action="Manage Gateways" />
            <StatCard icon={ShieldCheck} label="Bank Balance" value={formatCurrency(bankBalance)} tone="orange" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TablePanel table="bankAccounts" description="Manage cooperative bank accounts and their details." />
            <TablePanel table="paymentMethods" description="Configure payment methods accepted by the cooperative." />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Default Banking Preferences">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Default Bank Account" value={String(settings.defaultCashAccount)} onChange={(value) => setSetting('defaultCashAccount', value)} />
                <Field label="Default Payment Method" value={String(settings.defaultPaymentMethod)} onChange={(value) => setSetting('defaultPaymentMethod', value)} />
                <Field label="Daily Transfer Limit" value={String(settings.dailyTransferLimit)} onChange={(value) => setSetting('dailyTransferLimit', value)} type="number" />
                <Field label="Single Transaction Limit" value={String(settings.singleTransactionLimit)} onChange={(value) => setSetting('singleTransactionLimit', value)} type="number" />
              </div>
            </Card>
            <TablePanel table="paymentGateways" description="Connect and manage online payment gateways." />
          </div>
        </div>
      )}

      {activeTab === 'fiscal' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={CalendarDays} label="Current Fiscal Year" value={currentYear} tone="green" />
            <StatCard icon={CalendarDays} label="Open Periods" value={openPeriods} />
            <StatCard icon={RefreshCcw} label="Total Periods" value={state.tables.accountingPeriods.length} tone="purple" />
            <StatCard icon={ShieldCheck} label="Fiscal Years" value={state.tables.fiscalYears.length} tone="orange" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TablePanel table="fiscalYears" description="Create, edit and manage fiscal years." />
            <TablePanel table="accountingPeriods" description="Manage periods within the selected fiscal year." />
          </div>
          <Card title="Selected Period Actions">
            <div className="flex flex-wrap gap-2">
              {[
                ['Close Period', 'Closed'],
                ['Lock Period', 'Locked'],
                ['Reopen Period', 'Open'],
              ].map(([label, status]) => (
                <button key={label} type="button" onClick={() => updateFirstPeriodStatus(status)} className="btn-secondary">
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'interest' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={Percent} label="Default Interest Rate" value={`${settings.defaultInterestRate}%`} tone="green" />
            <StatCard icon={FileText} label="Active Charges" value={activeRows('chargesFees')} />
            <StatCard icon={AlertTriangle} label="Penalty Rate" value={`${settings.penaltyRate}%`} tone="purple" />
            <StatCard icon={CreditCard} label="Charges Collected" value={formatCurrency(tableTotal('chargesFees', 'amount'))} tone="orange" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TablePanel table="interestRates" description="Define and manage interest rates for loans, savings and other products." />
            <TablePanel table="chargesFees" description="Manage charges and fees applicable to accounts and transactions." />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Penalty Settings">
              <div className="space-y-3">
                <Field label="Default Penalty Rate" value={String(settings.penaltyRate)} onChange={(value) => setSetting('penaltyRate', value)} type="number" />
                <Field label="Grace Period (Days)" value={String(settings.gracePeriod)} onChange={(value) => setSetting('gracePeriod', value)} type="number" />
                <div className="flex items-center justify-between text-sm font-semibold text-navy">Enable Penalty <Toggle checked={Boolean(settings.enablePenalty)} onChange={(value) => setSetting('enablePenalty', value)} /></div>
              </div>
            </Card>
            <Card title="Interest Calculation Settings">
              <div className="space-y-3">
                <Field label="Day Count Convention" value={String(settings.dayCountConvention)} onChange={(value) => setSetting('dayCountConvention', value)} type="select" options={['Actual/365', 'Actual/360', '30/360']} />
                <Field label="Post Interest Frequency" value={String(settings.postInterestFrequency)} onChange={(value) => setSetting('postInterestFrequency', value)} type="select" options={['Daily', 'Monthly', 'Quarterly']} />
                <div className="flex items-center justify-between text-sm font-semibold text-navy">Capitalise Interest <Toggle checked={Boolean(settings.capitaliseInterest)} onChange={(value) => setSetting('capitaliseInterest', value)} /></div>
              </div>
            </Card>
            <Card title="Other Settings">
              <div className="space-y-3">
                {['waiveInterestEarlyRepayment', 'applyInterestOnHolidays', 'interestInSuspension', 'printChargesOnReceipts'].map((key) => (
                  <div key={key} className="flex items-center justify-between text-sm font-semibold text-navy">
                    {key.replace(/([A-Z])/g, ' $1')} <Toggle checked={Boolean(settings[key])} onChange={(value) => setSetting(key, value)} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'approval' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={ShieldCheck} label="Active Approval Workflows" value={activeRows('approvalWorkflows')} tone="green" />
            <StatCard icon={CheckCircle2} label="Approval Levels" value={state.tables.approvalLevels.length} />
            <StatCard icon={Percent} label="Pending Approval" value={state.tables.pendingApprovals.length} tone="purple" />
            <StatCard icon={LineChart} label="Pending Amount" value={formatCurrency(tableTotal('pendingApprovals', 'amount'))} tone="orange" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TablePanel table="approvalWorkflows" description="Define approval workflows for different modules." />
            <TablePanel table="approvalLevels" description="Define approvers and limits for each approval level." />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TablePanel table="pendingApprovals" description="Transactions waiting for approval." />
            <Card title="Approval Settings">
              <div className="space-y-3">
                {['enforceApprovalWorkflows', 'allowRequesterApproval', 'approveByMajority', 'notifyApprovers'].map((key) => (
                  <div key={key} className="flex items-center justify-between text-sm font-semibold text-navy">
                    {key.replace(/([A-Z])/g, ' $1')} <Toggle checked={Boolean(settings[key])} onChange={(value) => setSetting(key, value)} />
                  </div>
                ))}
                <Field label="Approval Expiry (Days)" value={String(settings.approvalExpiryDays)} onChange={(value) => setSetting('approvalExpiryDays', value)} type="number" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'budget' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={CreditCard} label="Active Budgets" value={activeRows('budgets')} tone="green" />
            <StatCard icon={LineChart} label="Total Budget" value={formatCurrency(budgetTotal)} />
            <StatCard icon={LineChart} label="Forecast" value={formatCurrency(forecastTotal)} tone="purple" />
            <StatCard icon={Percent} label="Budget Utilization" value={budgetTotal ? `${Math.round((forecastTotal / budgetTotal) * 100)}%` : '0%'} tone="orange" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TablePanel table="budgets" description="Manage departmental and project budgets." />
            <TablePanel table="forecasts" description="Compare forecasted results with budgeted amounts." />
          </div>
          <Card title="Planning Tools">
            <div className="grid gap-3 md:grid-cols-3">
              {['Create Budget', 'Create Forecast', 'Budget Templates', 'Scenario Planning', 'Import Budget', 'Export Reports'].map((label) => (
                <button key={label} type="button" onClick={() => runPlanningAction(label)} className="btn-secondary justify-between">
                  {label} <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={Bell} label="Alerts Configured" value={state.tables.financialAlerts.length} />
            <StatCard icon={CheckCircle2} label="Active Alerts" value={activeAlerts} tone="green" />
            <StatCard icon={AlertTriangle} label="Paused Alerts" value={state.tables.financialAlerts.filter((row) => row.status === 'Paused').length} tone="orange" />
            <StatCard icon={AlertTriangle} label="Triggered This Month" value={state.tables.alertHistory.length} tone="red" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <TablePanel table="financialAlerts" description="Manage and configure your financial alerts." />
            <Card title="Alert Channels">
              <div className="space-y-3">
                {[
                  ['inAppAlerts', 'In-App Notifications'],
                  ['emailAlerts', 'Email Notifications'],
                  ['smsAlerts', 'SMS Notifications'],
                  ['dashboardAlerts', 'System Dashboard'],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between text-sm font-semibold text-navy">
                    {label} <Toggle checked={Boolean(settings[key])} onChange={(value) => setSetting(key, value)} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <TablePanel table="alertHistory" description="Latest triggered alerts and notifications." />
            <Card title="Quick Actions">
              <div className="space-y-2">
                {['Create New Alert', 'Alert Templates', 'Notification Settings', 'Alert Report'].map((label) => (
                  <button key={label} type="button" onClick={() => runAlertAction(label)} className="btn-secondary w-full justify-between">
                    {label} <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs text-navy">
        Changes to financial settings affect transactions and reports. Review carefully before saving.
      </div>

      {modal && (
        <RowModal
          modal={modal}
          fields={tableFields[modal.table]}
          title={tableLabels[modal.table]}
          onClose={() => setModal(null)}
          onSave={(row) => saveRow(modal.table, row)}
        />
      )}
    </div>
  )
}

function RowModal({
  modal,
  fields,
  title,
  onClose,
  onSave,
}: {
  modal: Exclude<ModalState, null>
  fields: FieldDef[]
  title: string
  onClose: () => void
  onSave: (row: Row) => void
}) {
  const [row, setRow] = useState<Row>(() => {
    if (modal.row) return modal.row
    return { id: crypto.randomUUID(), ...Object.fromEntries(fields.map((field) => [field.key, field.options?.[0] || ''])) }
  })
  const readOnly = modal.mode === 'view'
  const heading = modal.mode === 'add' ? `Add ${title}` : modal.mode === 'edit' ? `Edit ${title}` : `View ${title}`

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const missing = fields.find((field) => field.required && !String(row[field.key] || '').trim())
    if (missing) {
      toast.error(`${missing.label} is required.`)
      return
    }
    onSave(row)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-navy">{heading}</h2>
          <button type="button" onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              value={row[field.key] || ''}
              type={field.kind}
              options={field.options}
              onChange={(value) => !readOnly && setRow((current) => ({ ...current, [field.key]: value }))}
            />
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button type="submit" className="btn-primary">
              <Save size={16} /> Save
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default FinancialSettings
