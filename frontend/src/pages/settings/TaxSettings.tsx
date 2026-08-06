import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import toast from 'react-hot-toast'
import {
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  Download,
  Edit,
  FileText,
  HelpCircle,
  Import,
  Info,
  Landmark,
  MoreVertical,
  Percent,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Shield,
  SlidersHorizontal,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react'
import { settingsApi } from '../../services/api'

type TaxTab = 'Tax Configuration' | 'Withholding Taxes' | 'Tax Codes' | 'Exemptions' | 'Reporting & Compliance'
type TaxRate = { id: number; name: string; description: string; rate: number; effectiveFrom: string; status: 'Active' | 'Inactive'; appliesTo: string }
type TaxCode = { id: number; code: string; description: string; category: string; rate: number; type: string; status: 'Active' | 'Inactive'; appliesTo: string }
type TaxExemption = { id: number; code: string; name: string; type: string; appliesTo: string; effectiveFrom: string; effectiveTo: string; status: 'Active' | 'Conditional' | 'Inactive' }
type TaxReport = { id: number; name: string; description: string; frequency: string; lastGenerated: string; period: string }
type TaxSettingsState = {
  taxSystem: string
  taxAuthority: string
  tin: string
  businessActivity: string
  registrationDate: string
  calculationMethod: string
  roundingMethod: string
  roundingDirection: string
  taxInclusivePricing: boolean
  autoCalculateTax: boolean
  vatRegistrationNumber: string
  vatAccountingMethod: string
  vatFlatRateScheme: boolean
  inputVatRecovery: boolean
  defaultVatCode: string
  companyFilingFrequency: string
  vatFilingFrequency: string
  returnDueDays: string
  penaltyRate: string
  gracePeriod: string
  whtApplicationMethod: 'payment' | 'invoice'
  roundWhtAmount: boolean
  includeVatInWht: boolean
  autoGenerateWhtCertificate: boolean
  allowWhtAdjustment: boolean
  minimumWhtThreshold: string
  whtPayableAccount: string
  whtExpenseAccount: string
  whtClearingAccount: string
  defaultRemittanceBank: string
  requireDocumentation: boolean
  requireApproval: boolean
  autoExpiryNotification: boolean
  reviewExemptionsAnnually: boolean
  taxRates: TaxRate[]
  withholdingRates: TaxRate[]
  taxCodes: TaxCode[]
  exemptions: TaxExemption[]
  reports: TaxReport[]
}

const tabs: TaxTab[] = ['Tax Configuration', 'Withholding Taxes', 'Tax Codes', 'Exemptions', 'Reporting & Compliance']

const defaults: TaxSettingsState = {
  taxSystem: '',
  taxAuthority: '',
  tin: '',
  businessActivity: '',
  registrationDate: '',
  calculationMethod: '',
  roundingMethod: '',
  roundingDirection: '',
  taxInclusivePricing: false,
  autoCalculateTax: false,
  vatRegistrationNumber: '',
  vatAccountingMethod: '',
  vatFlatRateScheme: false,
  inputVatRecovery: false,
  defaultVatCode: '',
  companyFilingFrequency: '',
  vatFilingFrequency: '',
  returnDueDays: '',
  penaltyRate: '',
  gracePeriod: '',
  whtApplicationMethod: 'payment',
  roundWhtAmount: false,
  includeVatInWht: false,
  autoGenerateWhtCertificate: false,
  allowWhtAdjustment: false,
  minimumWhtThreshold: '',
  whtPayableAccount: '',
  whtExpenseAccount: '',
  whtClearingAccount: '',
  defaultRemittanceBank: '',
  requireDocumentation: false,
  requireApproval: false,
  autoExpiryNotification: false,
  reviewExemptionsAnnually: false,
  taxRates: [],
  withholdingRates: [],
  taxCodes: [],
  exemptions: [],
  reports: [],
}

function money(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function Card({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-navy">{title}</h3>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-navy">{label}</span>{children}</label>
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? 'bg-coop-blue' : 'bg-slate-300'}`}>
      <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

function Stat({ icon, label, value, sub, tone = 'blue' }: { icon: ReactNode; label: string; value: string; sub?: string; tone?: 'blue' | 'green' | 'orange' | 'purple' | 'red' }) {
  const tones = { blue: 'bg-blue-50 text-coop-blue', green: 'bg-green-50 text-coop-green', orange: 'bg-orange-50 text-orange-500', purple: 'bg-purple-50 text-purple-600', red: 'bg-red-50 text-red-600' }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
        <span>
          <span className="block text-xs font-semibold text-slate-500">{label}</span>
          <span className="block text-xl font-bold text-navy">{value}</span>
          {sub && <span className="block text-xs text-slate-500">{sub}</span>}
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  const color = value === 'Active' || value === 'Accepted' || value === 'Compliant' || value === 'Valid' ? 'bg-green-100 text-green-700' : value === 'Conditional' || value === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
  return <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${color}`}>{value}</span>
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-bold text-coop-blue hover:bg-blue-50">{children}</button>
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{message}</div>
}

function downloadText(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function csv(rows: Record<string, string | number>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [headers, ...rows.map(row => headers.map(header => row[header]))].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function TaxSettings() {
  const importCodesRef = useRef<HTMLInputElement>(null)
  const importExemptionsRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<TaxTab>('Tax Configuration')
  const [settings, setSettings] = useState<TaxSettingsState>(defaults)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingRate, setEditingRate] = useState<{ type: 'tax' | 'wht'; row: TaxRate } | null>(null)
  const [editingCode, setEditingCode] = useState<TaxCode | null>(null)
  const [editingExemption, setEditingExemption] = useState<TaxExemption | null>(null)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [calculatorAmount, setCalculatorAmount] = useState('100000')
  const [calculatorRate, setCalculatorRate] = useState('7.5')

  const taxable = Number(calculatorAmount || 0)
  const taxDue = taxable * (Number(calculatorRate || 0) / 100)
  const totalTax = 0
  const paidTax = 0
  const outstandingTax = totalTax - paidTax
  const generatedReports = settings.reports.filter(report => report.lastGenerated).length
  const filteredCodes = settings.taxCodes.filter(row => `${row.code} ${row.description} ${row.category}`.toLowerCase().includes(search.toLowerCase()))
  const filteredExemptions = settings.exemptions.filter(row => `${row.code} ${row.name} ${row.type}`.toLowerCase().includes(search.toLowerCase()))
  const taxCodeCategories = Object.entries(settings.taxCodes.reduce<Record<string, { count: number; total: number }>>((items, item) => {
    const current = items[item.category] || { count: 0, total: 0 }
    return { ...items, [item.category]: { count: current.count + 1, total: current.total + item.rate } }
  }, {})).map(([category, item]) => [category, String(item.count), `${(item.total / Math.max(item.count, 1)).toFixed(2)}%`])
  const exemptionTypes = Object.entries(settings.exemptions.reduce<Record<string, number>>((items, item) => ({ ...items, [item.type]: (items[item.type] || 0) + 1 }), {})).map(([type, count]) => [type, String(count), `${((count / Math.max(settings.exemptions.length, 1)) * 100).toFixed(2)}%`])
  const expiringThisYear = settings.exemptions.filter(item => item.effectiveTo.startsWith(String(new Date().getFullYear()))).length

  useEffect(() => {
    settingsApi.get<TaxSettingsState>('tax-settings')
      .then(saved => setSettings({ ...defaults, ...saved, taxRates: saved.taxRates || defaults.taxRates, withholdingRates: saved.withholdingRates || defaults.withholdingRates, taxCodes: saved.taxCodes || defaults.taxCodes, exemptions: saved.exemptions || defaults.exemptions, reports: saved.reports || defaults.reports }))
      .catch(() => toast.error('Could not load tax settings'))
  }, [])

  const update = <K extends keyof TaxSettingsState>(key: K, value: TaxSettingsState[K]) => setSettings(prev => ({ ...prev, [key]: value }))

  const saveSettings = async (next = settings) => {
    try {
      setSaving(true)
      const saved = await settingsApi.save<TaxSettingsState>('tax-settings', next)
      setSettings({ ...defaults, ...saved })
      toast.success('Tax settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save tax settings')
    } finally {
      setSaving(false)
    }
  }

  const resetSettings = async () => {
    setSettings(defaults)
    await saveSettings(defaults)
    toast.success('Tax settings reset to default')
  }

  const saveRate = async (type: 'tax' | 'wht', row: TaxRate) => {
    const key = type === 'tax' ? 'taxRates' : 'withholdingRates'
    const exists = settings[key].some(item => item.id === row.id)
    const next = { ...settings, [key]: exists ? settings[key].map(item => item.id === row.id ? row : item) : [row, ...settings[key]] }
    setSettings(next)
    setEditingRate(null)
    await saveSettings(next)
  }

  const saveCode = async (row: TaxCode) => {
    const exists = settings.taxCodes.some(item => item.id === row.id)
    const next = { ...settings, taxCodes: exists ? settings.taxCodes.map(item => item.id === row.id ? row : item) : [row, ...settings.taxCodes] }
    setSettings(next)
    setEditingCode(null)
    await saveSettings(next)
  }

  const saveExemption = async (row: TaxExemption) => {
    const exists = settings.exemptions.some(item => item.id === row.id)
    const next = { ...settings, exemptions: exists ? settings.exemptions.map(item => item.id === row.id ? row : item) : [row, ...settings.exemptions] }
    setSettings(next)
    setEditingExemption(null)
    await saveSettings(next)
  }

  const removeCode = async (id: number) => {
    const next = { ...settings, taxCodes: settings.taxCodes.filter(item => item.id !== id) }
    setSettings(next)
    await saveSettings(next)
  }

  const removeExemption = async (id: number) => {
    const next = { ...settings, exemptions: settings.exemptions.filter(item => item.id !== id) }
    setSettings(next)
    await saveSettings(next)
  }

  const exportData = (kind: 'rates' | 'wht' | 'codes' | 'exemptions' | 'reports') => {
    const rows = kind === 'rates' ? settings.taxRates : kind === 'wht' ? settings.withholdingRates : kind === 'codes' ? settings.taxCodes : kind === 'exemptions' ? settings.exemptions : settings.reports
    downloadText(`tax-${kind}-${today()}.csv`, csv(rows as unknown as Record<string, string | number>[]), 'text/csv')
    toast.success('Export downloaded')
  }

  const generateReport = (name = 'Tax Report') => {
    const body = [
      name,
      `Generated: ${new Date().toLocaleString()}`,
      `TIN: ${settings.tin}`,
      `Total Tax Payable: ${money(totalTax)}`,
      `Total Tax Paid: ${money(paidTax)}`,
      `Outstanding Tax: ${money(outstandingTax)}`,
    ].join('\n')
    downloadText(`${name.toLowerCase().replace(/\s+/g, '-')}-${today()}.txt`, body)
    toast.success(`${name} generated`)
  }

  const importRows = async (event: ChangeEvent<HTMLInputElement>, kind: 'codes' | 'exemptions') => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    const rows = text.split(/\r?\n/).filter(Boolean).slice(1)
    if (kind === 'codes') {
      const imported = rows.map((line, index) => {
        const [code, description, category, rate, type] = line.split(',').map(item => item.replace(/^"|"$/g, ''))
        return { id: Date.now() + index, code: code || `CODE-${index + 1}`, description: description || 'Imported tax code', category: category || 'VAT', rate: Number(rate || 0), type: type || 'Percentage', status: 'Active' as const, appliesTo: 'Imported transactions' }
      })
      const next = { ...settings, taxCodes: [...imported, ...settings.taxCodes] }
      setSettings(next)
      await saveSettings(next)
    } else {
      const imported = rows.map((line, index) => {
        const [code, name, type, appliesTo] = line.split(',').map(item => item.replace(/^"|"$/g, ''))
        return { id: Date.now() + index, code: code || `EXEM-${index + 1}`, name: name || 'Imported exemption', type: type || 'Income Tax', appliesTo: appliesTo || 'All', effectiveFrom: today(), effectiveTo: 'No Expiry', status: 'Active' as const }
      })
      const next = { ...settings, exemptions: [...imported, ...settings.exemptions] }
      setSettings(next)
      await saveSettings(next)
    }
    toast.success('Import completed')
  }

  const selectedCode = settings.taxCodes[0]

  return (
    <div className="min-h-full space-y-4 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Tax Settings</h2>
          <p className="text-sm text-slate-500">Manage tax rates, rules and compliance settings for your cooperative.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={resetSettings} className="btn-secondary"><RefreshCw size={14} /> Reset to Default</button>
          <button onClick={() => saveSettings()} disabled={saving} className="btn-primary bg-coop-blue disabled:opacity-60"><Save size={14} /> Save Changes</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-slate-200 bg-white px-3">
        {tabs.map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`border-b-2 px-3 py-3 text-xs font-bold ${activeTab === tab ? 'border-coop-blue text-coop-blue' : 'border-transparent text-navy hover:text-coop-blue'}`}>{tab}</button>)}
      </div>

      {activeTab === 'Tax Configuration' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.4fr] gap-4">
              <Card title="Tax Profile" sub="Configure your primary tax information.">
                <div className="space-y-3">
                  <Field label="Tax System"><select value={settings.taxSystem} onChange={e => update('taxSystem', e.target.value)} className="input-field"><option value="">Select tax system</option><option>Self Assessment</option><option>Direct Assessment</option></select></Field>
                  <Field label="Tax Authority"><select value={settings.taxAuthority} onChange={e => update('taxAuthority', e.target.value)} className="input-field"><option value="">Select tax authority</option><option>Federal Inland Revenue Service (FIRS)</option><option>Lagos State Internal Revenue Service</option></select></Field>
                  <Field label="Tax Identification Number (TIN)"><input value={settings.tin} onChange={e => update('tin', e.target.value)} className="input-field" /></Field>
                  <Field label="Business Activity"><select value={settings.businessActivity} onChange={e => update('businessActivity', e.target.value)} className="input-field"><option value="">Select business activity</option><option>Cooperative Society</option><option>Trading</option><option>Services</option></select></Field>
                  <Field label="Tax Registration Date"><input type="date" value={settings.registrationDate} onChange={e => update('registrationDate', e.target.value)} className="input-field" /></Field>
                </div>
              </Card>
              <Card title="Tax Rates" sub="Manage your applicable tax rates.">
                <RatesTable rows={settings.taxRates} onEdit={row => setEditingRate({ type: 'tax', row })} onToggle={row => saveRate('tax', { ...row, status: row.status === 'Active' ? 'Inactive' : 'Active' })} />
                <button onClick={() => setEditingRate({ type: 'tax', row: { id: Date.now(), name: '', description: '', rate: 0, effectiveFrom: today(), status: 'Active', appliesTo: '' } })} className="mt-3 btn-secondary w-full justify-center"><Plus size={14} /> Add New Tax Rate</button>
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card title="Tax Calculation Settings" sub="Configure how taxes are calculated in the system.">
                <div className="space-y-3">
                  <Field label="Tax Calculation Method"><select value={settings.calculationMethod} onChange={e => update('calculationMethod', e.target.value)} className="input-field"><option value="">Select calculation method</option><option>On Net Amount (After Deductions)</option><option>On Gross Amount</option></select></Field>
                  <Field label="Rounding Method"><select value={settings.roundingMethod} onChange={e => update('roundingMethod', e.target.value)} className="input-field"><option value="">Select rounding method</option><option>Nearest Naira</option><option>Nearest Kobo</option></select></Field>
                  <Field label="Rounding Direction"><select value={settings.roundingDirection} onChange={e => update('roundingDirection', e.target.value)} className="input-field"><option value="">Select rounding direction</option><option>Round Half Up</option><option>Round Down</option><option>Round Up</option></select></Field>
                  <ToggleLine label="Tax Inclusive Pricing" checked={settings.taxInclusivePricing} onChange={value => update('taxInclusivePricing', value)} />
                  <ToggleLine label="Auto Calculate Tax" checked={settings.autoCalculateTax} onChange={value => update('autoCalculateTax', value)} />
                </div>
              </Card>
              <Card title="VAT Settings" sub="Configure VAT specific settings.">
                <div className="space-y-3">
                  <Field label="VAT Registration Number"><input value={settings.vatRegistrationNumber} onChange={e => update('vatRegistrationNumber', e.target.value)} className="input-field" /></Field>
                  <Field label="VAT Accounting Method"><select value={settings.vatAccountingMethod} onChange={e => update('vatAccountingMethod', e.target.value)} className="input-field"><option value="">Select VAT accounting method</option><option>Invoice Based</option><option>Cash Based</option></select></Field>
                  <ToggleLine label="VAT Flat Rate Scheme" checked={settings.vatFlatRateScheme} onChange={value => update('vatFlatRateScheme', value)} />
                  <ToggleLine label="Input VAT Recovery" checked={settings.inputVatRecovery} onChange={value => update('inputVatRecovery', value)} />
                  <Field label="Default VAT Code"><select value={settings.defaultVatCode} onChange={e => update('defaultVatCode', e.target.value)} className="input-field"><option value="">Select default VAT code</option>{settings.taxCodes.filter(code => code.category === 'VAT').map(code => <option key={code.id}>{code.description}</option>)}</select></Field>
                </div>
              </Card>
              <Card title="Tax Filing & Compliance" sub="Set up filing periods and compliance rules.">
                <div className="space-y-3">
                  <Field label="Company Income Tax Filing Frequency"><select value={settings.companyFilingFrequency} onChange={e => update('companyFilingFrequency', e.target.value)} className="input-field"><option value="">Select filing frequency</option><option>Annual</option><option>Quarterly</option></select></Field>
                  <Field label="VAT Filing Frequency"><select value={settings.vatFilingFrequency} onChange={e => update('vatFilingFrequency', e.target.value)} className="input-field"><option value="">Select VAT filing frequency</option><option>Monthly</option><option>Quarterly</option></select></Field>
                  <Field label="Tax Return Due (Days after period end)"><input value={settings.returnDueDays} onChange={e => update('returnDueDays', e.target.value)} className="input-field" /></Field>
                  <Field label="Penalty Rate (% per month)"><input value={settings.penaltyRate} onChange={e => update('penaltyRate', e.target.value)} className="input-field" /></Field>
                  <Field label="Grace Period (Days)"><input value={settings.gracePeriod} onChange={e => update('gracePeriod', e.target.value)} className="input-field" /></Field>
                </div>
              </Card>
            </div>
          </div>
          <TaxSidePanel totalTax={totalTax} paidTax={paidTax} outstandingTax={outstandingTax} onCalculate={() => setCalculatorOpen(true)} onReport={() => generateReport('Tax Report')} onExport={() => exportData('rates')} />
        </div>
      )}

      {activeTab === 'Withholding Taxes' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <div className="space-y-4">
            <Card title="Withholding Tax Settings" sub="Configure withholding tax rules, rates and applicable conditions for different payment types and vendors.">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Stat icon={<Landmark size={20} />} label="Total WHT Types" value={String(settings.withholdingRates.length)} sub="Active withholding tax types" />
                <Stat icon={<Receipt size={20} />} label="Active Rules" value={String(settings.withholdingRates.filter(item => item.status === 'Active').length)} sub="Withholding tax rules" tone="green" />
                <Stat icon={<Shield size={20} />} label="Applicable Vendors" value="0" sub="No vendors linked yet" tone="purple" />
                <Stat icon={<Building2 size={20} />} label="Total WHT Collected (YTD)" value={money(totalTax)} sub="Current year total" tone="orange" />
              </div>
            </Card>
            <Card title="Withholding Tax Rates" action={<select className="input-field w-40"><option>All Tax Types</option></select>}>
              <RatesTable rows={settings.withholdingRates} onEdit={row => setEditingRate({ type: 'wht', row })} onToggle={row => saveRate('wht', { ...row, status: row.status === 'Active' ? 'Inactive' : 'Active' })} />
              <button onClick={() => setEditingRate({ type: 'wht', row: { id: Date.now(), name: '', description: '', rate: 0, effectiveFrom: today(), status: 'Active', appliesTo: '' } })} className="mt-3 btn-secondary w-full justify-center"><Plus size={14} /> Add New Withholding Tax</button>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Withholding Tax Rules" sub="Configure general rules for withholding tax application.">
                <div className="space-y-3 text-xs">
                  <label className="flex gap-2 font-semibold text-navy"><input type="radio" checked={settings.whtApplicationMethod === 'payment'} onChange={() => update('whtApplicationMethod', 'payment')} /> Apply WHT on Payment</label>
                  <label className="flex gap-2 font-semibold text-navy"><input type="radio" checked={settings.whtApplicationMethod === 'invoice'} onChange={() => update('whtApplicationMethod', 'invoice')} /> Apply WHT on Invoice</label>
                  <Field label="Minimum WHT Threshold"><input value={settings.minimumWhtThreshold} onChange={e => update('minimumWhtThreshold', e.target.value)} className="input-field" /></Field>
                  <ToggleLine label="Round WHT Amount" checked={settings.roundWhtAmount} onChange={value => update('roundWhtAmount', value)} />
                  <ToggleLine label="Include VAT in WHT Calculation" checked={settings.includeVatInWht} onChange={value => update('includeVatInWht', value)} />
                  <ToggleLine label="Auto Generate WHT Certificate" checked={settings.autoGenerateWhtCertificate} onChange={value => update('autoGenerateWhtCertificate', value)} />
                  <ToggleLine label="Allow WHT Adjustment" checked={settings.allowWhtAdjustment} onChange={value => update('allowWhtAdjustment', value)} />
                  <button onClick={() => toast.success('Rule condition manager opened')} className="btn-secondary w-full justify-center"><SlidersHorizontal size={14} /> Manage Rule Conditions</button>
                </div>
              </Card>
              <Card title="Default WHT Account Settings" sub="Set default accounts for withholding tax transactions.">
                <div className="space-y-3">
                  <Field label="WHT Payable Account"><input value={settings.whtPayableAccount} onChange={e => update('whtPayableAccount', e.target.value)} className="input-field" /></Field>
                  <Field label="WHT Expense Account"><input value={settings.whtExpenseAccount} onChange={e => update('whtExpenseAccount', e.target.value)} className="input-field" /></Field>
                  <Field label="WHT Clearing Account"><input value={settings.whtClearingAccount} onChange={e => update('whtClearingAccount', e.target.value)} className="input-field" /></Field>
                  <Field label="Default Remittance Bank"><input value={settings.defaultRemittanceBank} onChange={e => update('defaultRemittanceBank', e.target.value)} className="input-field" /></Field>
                </div>
              </Card>
            </div>
          </div>
          <RightStack title="Withholding Tax Summary (YTD)" rows={[['Total Tax Withheld', money(totalTax)], ['Total Remitted', money(paidTax)], ['Outstanding', money(outstandingTax)], ['Vendors Subject to WHT', '0'], ['Transactions Subject to WHT', '0'], ['Compliance Rate', '0%']]} actions={[['Add Withholding Tax', () => setEditingRate({ type: 'wht', row: { id: Date.now(), name: '', description: '', rate: 0, effectiveFrom: today(), status: 'Active', appliesTo: '' } })], ['Withholding Tax Report', () => generateReport('Withholding Tax Report')], ['Vendor WHT Summary', () => generateReport('Vendor WHT Summary')], ['WHT Payment History', () => generateReport('WHT Payment History')], ['Tax Authority Guide', () => generateGuide('Withholding Tax Guide')]]} />
        </div>
      )}

      {activeTab === 'Tax Codes' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <div className="space-y-4">
            <Card title="Tax Codes Overview" sub="Configure and manage tax codes used for transactions and reporting.">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Stat icon={<FileText size={20} />} label="Total Tax Codes" value={String(settings.taxCodes.length)} sub="All active tax codes" />
                <Stat icon={<CheckCircle size={20} />} label="Active Tax Codes" value={String(settings.taxCodes.filter(item => item.status === 'Active').length)} sub="Currently in use" tone="green" />
                <Stat icon={<Receipt size={20} />} label="Inactive Tax Codes" value={String(settings.taxCodes.filter(item => item.status === 'Inactive').length)} sub="Not in use" tone="purple" />
                <Stat icon={<Percent size={20} />} label="Average Tax Rate" value={`${(settings.taxCodes.reduce((sum, item) => sum + item.rate, 0) / Math.max(settings.taxCodes.length, 1)).toFixed(2)}%`} sub="Across all tax codes" tone="orange" />
              </div>
            </Card>
            <Card title="Tax Codes" action={<div className="flex gap-2"><select className="input-field w-40"><option>All Categories</option></select><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tax codes..." className="input-field w-48" /></div>}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr>{['Code', 'Description', 'Category', 'Rate (%)', 'Type', 'Status', 'Actions'].map(h => <th key={h} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{h}</th>)}</tr></thead>
                  <tbody>{filteredCodes.length ? filteredCodes.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-coop-blue">{row.code}</td><td className="px-3 py-2">{row.description}</td><td className="px-3 py-2">{row.category}</td><td className="px-3 py-2">{row.rate.toFixed(2)}</td><td className="px-3 py-2">{row.type}</td><td className="px-3 py-2"><StatusBadge value={row.status} /></td><td className="px-3 py-2"><RowActions onEdit={() => setEditingCode(row)} onToggle={() => saveCode({ ...row, status: row.status === 'Active' ? 'Inactive' : 'Active' })} onDelete={() => removeCode(row.id)} /></td></tr>) : <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No tax codes configured.</td></tr>}</tbody>
                </table>
              </div>
              <button onClick={() => setEditingCode({ id: Date.now(), code: '', description: '', category: 'VAT', rate: 0, type: 'Percentage', status: 'Active', appliesTo: '' })} className="mt-3 btn-secondary"><Plus size={14} /> Add New Tax Code</button>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card title="Tax Code Categories" sub="Overview of tax code categories in the system.">{taxCodeCategories.length ? <MiniRows rows={taxCodeCategories} /> : <EmptyState message="No tax code categories yet." />}</Card>
              <Card title="Default Tax Code Mapping" sub="Map default tax codes to transaction types."><EmptyState message="No tax code mappings configured." /></Card>
              <Card title="Recent Changes"><EmptyState message="No tax code changes recorded." /></Card>
            </div>
          </div>
          <div className="space-y-4">
            <Card title="Quick Actions"><div className="space-y-2"><ActionButton onClick={() => setEditingCode({ id: Date.now(), code: '', description: '', category: 'VAT', rate: 0, type: 'Percentage', status: 'Active', appliesTo: '' })}><Plus size={14} /> Add New Tax Code</ActionButton><ActionButton onClick={() => importCodesRef.current?.click()}><Import size={14} /> Import Tax Codes</ActionButton><ActionButton onClick={() => exportData('codes')}><Download size={14} /> Export Tax Codes</ActionButton><ActionButton onClick={() => generateReport('Tax Code Report')}><FileText size={14} /> Tax Code Report</ActionButton></div></Card>
            <Card title="Tax Code Details">{selectedCode && <MiniRows rows={[['Code', selectedCode.code], ['Description', selectedCode.description], ['Category', selectedCode.category], ['Rate Type', selectedCode.type], ['Rate (%)', selectedCode.rate.toFixed(2)], ['Applies To', selectedCode.appliesTo], ['Status', selectedCode.status]]} />}<button onClick={() => selectedCode && setEditingCode(selectedCode)} className="mt-3 btn-secondary"><Edit size={14} /> Edit</button></Card>
            <Card title="Help & Guidance"><p className="text-xs text-slate-500">Tax codes categorize and calculate taxes on transactions.</p><button onClick={() => generateGuide('Tax Code Guide')} className="mt-3 btn-secondary"><BookOpen size={14} /> View Tax Code Guide</button></Card>
          </div>
          <input ref={importCodesRef} type="file" accept=".csv" className="hidden" onChange={event => importRows(event, 'codes')} />
        </div>
      )}

      {activeTab === 'Exemptions' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <div className="space-y-4">
            <Card title="Exemptions Overview" sub="Define and manage tax exemptions that reduce or eliminate tax liabilities.">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Stat icon={<FileText size={20} />} label="Total Exemptions" value={String(settings.exemptions.length)} sub="All exemptions in system" tone="purple" />
                <Stat icon={<CheckCircle size={20} />} label="Active Exemptions" value={String(settings.exemptions.filter(item => item.status === 'Active').length)} sub="Currently active" tone="green" />
                <Stat icon={<Info size={20} />} label="Conditional Exemptions" value={String(settings.exemptions.filter(item => item.status === 'Conditional').length)} sub="Require conditions" tone="orange" />
                <Stat icon={<Calendar size={20} />} label="Expiring This Year" value={String(expiringThisYear)} sub="Based on saved exemptions" />
              </div>
            </Card>
            <Card title="Exemptions List" action={<div className="flex gap-2"><select className="input-field w-36"><option>All Types</option></select><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exemptions..." className="input-field w-48" /></div>}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr>{['Exemption Code', 'Exemption Name', 'Type', 'Applies To', 'Effective From', 'Effective To', 'Status', 'Actions'].map(h => <th key={h} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{h}</th>)}</tr></thead>
                  <tbody>{filteredExemptions.length ? filteredExemptions.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-bold text-coop-blue">{row.code}</td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.type}</td><td className="px-3 py-2">{row.appliesTo}</td><td className="px-3 py-2">{row.effectiveFrom}</td><td className="px-3 py-2">{row.effectiveTo}</td><td className="px-3 py-2"><StatusBadge value={row.status} /></td><td className="px-3 py-2"><RowActions onEdit={() => setEditingExemption(row)} onToggle={() => saveExemption({ ...row, status: row.status === 'Active' ? 'Inactive' : 'Active' })} onDelete={() => removeExemption(row.id)} /></td></tr>) : <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No tax exemptions configured.</td></tr>}</tbody>
                </table>
              </div>
              <button onClick={() => setEditingExemption({ id: Date.now(), code: '', name: '', type: 'Income Tax', appliesTo: '', effectiveFrom: today(), effectiveTo: '', status: 'Active' })} className="mt-3 btn-secondary"><Plus size={14} /> Add New Exemption</button>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card title="Exemption Conditions"><div className="space-y-3"><ToggleLine label="Require Documentation" checked={settings.requireDocumentation} onChange={value => update('requireDocumentation', value)} /><ToggleLine label="Require Approval" checked={settings.requireApproval} onChange={value => update('requireApproval', value)} /><ToggleLine label="Auto Expiry Notification" checked={settings.autoExpiryNotification} onChange={value => update('autoExpiryNotification', value)} /><ToggleLine label="Review Exemptions Annually" checked={settings.reviewExemptionsAnnually} onChange={value => update('reviewExemptionsAnnually', value)} /><button onClick={() => toast.success('Exemption conditions updated')} className="btn-secondary w-full"><SlidersHorizontal size={14} /> Manage Conditions</button></div></Card>
              <Card title="Exemption Types">{exemptionTypes.length ? <MiniRows rows={exemptionTypes} /> : <EmptyState message="No exemption types yet." />}</Card>
              <Card title="Recent Activity"><EmptyState message="No exemption activity recorded." /></Card>
            </div>
          </div>
          <RightStack title="Exemption Summary" rows={[['Total Potential Savings (YTD)', money(0)], ['Utilized Savings (YTD)', money(0)], ['Available Savings (YTD)', money(0)], ['Exemptions Applied (YTD)', '0'], ['Compliance Status', '0%']]} actions={[['Add New Exemption', () => setEditingExemption({ id: Date.now(), code: '', name: '', type: 'Income Tax', appliesTo: '', effectiveFrom: today(), effectiveTo: '', status: 'Active' })], ['Import Exemptions', () => importExemptionsRef.current?.click()], ['Export Exemptions', () => exportData('exemptions')], ['Exemption Report', () => generateReport('Exemption Report')], ['Exemption Usage Report', () => generateReport('Exemption Usage Report')]]} />
          <input ref={importExemptionsRef} type="file" accept=".csv" className="hidden" onChange={event => importRows(event, 'exemptions')} />
        </div>
      )}

      {activeTab === 'Reporting & Compliance' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <div className="space-y-4">
            <Card title="Reporting & Compliance Overview" sub="Generate statutory tax reports and ensure compliance with tax regulations.">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Stat icon={<FileText size={20} />} label="Total Reports" value={String(settings.reports.length)} sub="All tax reports" tone="purple" />
                <Stat icon={<CheckCircle size={20} />} label="Reports Generated (YTD)" value={String(generatedReports)} sub="From saved report records" tone="green" />
                <Stat icon={<Calendar size={20} />} label="Pending Submissions" value="0" sub="Awaiting submission" tone="orange" />
                <Stat icon={<Calendar size={20} />} label="Next Filing Due" value="-" sub="No filing date configured" />
              </div>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-4">
              <Card title="Available Reports" action={<div className="flex gap-2"><select className="input-field w-36"><option>All Report Types</option></select><select className="input-field w-28"><option>This Year</option></select></div>}>
                <ReportTable rows={settings.reports} onGenerate={name => generateReport(name)} />
                <button onClick={() => generateReport('All Tax Reports')} className="mt-3 btn-secondary w-full justify-center"><FileText size={14} /> View All Reports</button>
              </Card>
              <Card title="Compliance Status" sub="Current compliance standing and obligations.">
                <div className="space-y-3">
                  <div><div className="text-xs text-slate-500">Overall Compliance</div><div className="text-3xl font-bold text-slate-500">0%</div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 w-0 rounded-full bg-coop-green" /></div></div>
                  <EmptyState message="No compliance records available yet." />
                  <button onClick={() => generateReport('Compliance Details')} className="btn-secondary w-full justify-center">View Compliance Details</button>
                </div>
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Recent Submissions"><EmptyState message="No tax submissions recorded." /><button onClick={() => generateReport('All Tax Submissions')} className="mt-3 btn-secondary w-full justify-center">View All Submissions</button></Card>
              <Card title="Required Documents"><EmptyState message="No compliance documents configured." /><button onClick={() => toast.success('Document manager opened')} className="mt-3 btn-secondary w-full justify-center">Manage Documents</button></Card>
            </div>
          </div>
          <RightStack title="Filing Calendar" rows={[['Upcoming Filings', '0'], ['Pending Filings', '0'], ['Overdue Filings', '0']]} actions={[['Generate Report', () => generateReport('Tax Compliance Report')], ['Schedule Report', () => toast.success('Report schedule saved')], ['Upload Compliance Document', () => toast.success('Document upload action ready')], ['View Filing Calendar', () => generateReport('Filing Calendar')], ['Download Tax Forms', () => generateGuide('Tax Forms')], ['Tax Authority Portal', () => window.open('https://www.firs.gov.ng', '_blank', 'noopener,noreferrer')]]} />
        </div>
      )}

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-navy"><Info size={17} className="mr-2 inline text-coop-blue" />Ensure your tax settings are accurate and up to date to avoid incorrect calculations and compliance issues.</div>
      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">&copy; {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.</footer>

      {editingRate && <RateModal data={editingRate.row} title={editingRate.type === 'tax' ? 'Tax Rate' : 'Withholding Tax'} onClose={() => setEditingRate(null)} onSave={row => saveRate(editingRate.type, row)} />}
      {editingCode && <CodeModal data={editingCode} onClose={() => setEditingCode(null)} onSave={saveCode} />}
      {editingExemption && <ExemptionModal data={editingExemption} onClose={() => setEditingExemption(null)} onSave={saveExemption} />}
      {calculatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="text-lg font-bold text-navy">Calculate Tax</h3>
            <div className="mt-4 space-y-3">
              <Field label="Taxable Amount"><input value={calculatorAmount} onChange={e => setCalculatorAmount(e.target.value)} className="input-field" /></Field>
              <Field label="Tax Rate (%)"><input value={calculatorRate} onChange={e => setCalculatorRate(e.target.value)} className="input-field" /></Field>
              <div className="rounded-lg bg-blue-50 p-4 text-center"><div className="text-xs text-slate-500">Tax Due</div><div className="text-2xl font-bold text-navy">{money(taxDue)}</div></div>
              <div className="grid grid-cols-2 gap-2"><button onClick={() => setCalculatorOpen(false)} className="btn-secondary justify-center">Close</button><button onClick={() => generateReport('Tax Calculation')} className="btn-primary bg-coop-blue justify-center">Download</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToggleLine({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-navy">{label}</span><Toggle checked={checked} onChange={onChange} /></div>
}

function RatesTable({ rows, onEdit, onToggle }: { rows: TaxRate[]; onEdit: (row: TaxRate) => void; onToggle: (row: TaxRate) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr>{['Tax Type', 'Rate (%)', 'Effective From', 'Status', 'Actions'].map(h => <th key={h} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{h}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.rate.toFixed(2)}</td><td className="px-3 py-2">{row.effectiveFrom}</td><td className="px-3 py-2"><StatusBadge value={row.status} /></td><td className="px-3 py-2"><RowActions onEdit={() => onEdit(row)} onToggle={() => onToggle(row)} /></td></tr>) : <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No tax rates configured.</td></tr>}</tbody>
      </table>
    </div>
  )
}

function RowActions({ onEdit, onToggle, onDelete }: { onEdit: () => void; onToggle: () => void; onDelete?: () => void }) {
  return <div className="flex gap-2"><button onClick={onEdit} className="rounded-md border border-slate-200 p-1.5 text-coop-blue hover:bg-blue-50"><Edit size={13} /></button><button onClick={onToggle} className="rounded-md border border-slate-200 p-1.5 text-navy hover:bg-slate-50"><MoreVertical size={13} /></button>{onDelete && <button onClick={onDelete} className="rounded-md border border-slate-200 p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>}</div>
}

function MiniRows({ rows }: { rows: string[][] }) {
  return <div className="divide-y divide-slate-100">{rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_auto_auto] gap-3 py-2 text-xs"><span className="font-semibold text-navy">{row[0]}</span><span className="text-navy">{row[1]}</span>{row[2] && <span className="font-bold text-navy">{row[2]}</span>}</div>)}</div>
}

function TaxSidePanel({ totalTax, paidTax, outstandingTax, onCalculate, onReport, onExport }: { totalTax: number; paidTax: number; outstandingTax: number; onCalculate: () => void; onReport: () => void; onExport: () => void }) {
  return <RightStack title="Tax Summary (Current Year)" rows={[['Total Tax Payable', money(totalTax)], ['Total Tax Paid', money(paidTax)], ['Outstanding Tax', money(outstandingTax)], ['Next Filing Due', '-']]} actions={[['Calculate Tax', onCalculate], ['Generate Tax Report', onReport], ['Export Tax Data', onExport], ['Tax Payment History', () => downloadText(`tax-payment-history-${today()}.txt`, 'No tax payment history has been posted yet.')], ['View Tax Guide', () => generateGuide('Tax Guide')]]} />
}

function RightStack({ title, rows, actions }: { title: string; rows: string[][]; actions: [string, () => void][] }) {
  return (
    <div className="space-y-4">
      <Card title={title}><MiniRows rows={rows} /><div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 w-[82%] rounded-full bg-coop-green" /></div></Card>
      <Card title="Quick Actions"><div className="space-y-2">{actions.map(([label, action]) => <ActionButton key={label} onClick={action}><Zap size={14} /> {label}</ActionButton>)}</div></Card>
      <Card title="Help & Guidance"><p className="text-xs text-slate-500">Manage all tax settings, rates and compliance information here.</p><button onClick={() => generateGuide(`${title} Guide`)} className="mt-3 btn-secondary"><BookOpen size={14} /> View Guide</button></Card>
    </div>
  )
}

function ReportTable({ rows, onGenerate }: { rows: TaxReport[]; onGenerate: (name: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr>{['Report Name', 'Description', 'Frequency', 'Last Generated', 'Period Covered', 'Actions'].map(h => <th key={h} className="bg-slate-50 px-3 py-2 text-left font-bold text-navy">{h}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold">{row.name}</td><td className="px-3 py-2">{row.description}</td><td className="px-3 py-2">{row.frequency}</td><td className="px-3 py-2">{row.lastGenerated}</td><td className="px-3 py-2">{row.period}</td><td className="px-3 py-2"><button onClick={() => onGenerate(row.name)} className="btn-secondary py-1 text-xs"><Play size={12} /> Generate</button></td></tr>) : <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No tax reports configured.</td></tr>}</tbody>
      </table>
    </div>
  )
}

function generateGuide(name: string) {
  downloadText(`${name.toLowerCase().replace(/\s+/g, '-')}.txt`, `${name}\n\nThis guide explains the selected tax setting, compliance process and recommended records to keep.`)
  toast.success(`${name} downloaded`)
}

function RateModal({ title, data, onSave, onClose }: { title: string; data: TaxRate; onSave: (row: TaxRate) => void; onClose: () => void }) {
  const [row, setRow] = useState(data)
  return <Modal title={title} onClose={onClose} onSave={() => onSave(row)}><Field label="Name"><input value={row.name} onChange={e => setRow({ ...row, name: e.target.value })} className="input-field" /></Field><Field label="Description"><input value={row.description} onChange={e => setRow({ ...row, description: e.target.value })} className="input-field" /></Field><Field label="Rate (%)"><input value={row.rate} onChange={e => setRow({ ...row, rate: Number(e.target.value) })} className="input-field" /></Field><Field label="Effective From"><input type="date" value={row.effectiveFrom} onChange={e => setRow({ ...row, effectiveFrom: e.target.value })} className="input-field" /></Field><Field label="Applies To"><input value={row.appliesTo} onChange={e => setRow({ ...row, appliesTo: e.target.value })} className="input-field" /></Field><Field label="Status"><select value={row.status} onChange={e => setRow({ ...row, status: e.target.value as TaxRate['status'] })} className="input-field"><option>Active</option><option>Inactive</option></select></Field></Modal>
}

function CodeModal({ data, onSave, onClose }: { data: TaxCode; onSave: (row: TaxCode) => void; onClose: () => void }) {
  const [row, setRow] = useState(data)
  return <Modal title="Tax Code" onClose={onClose} onSave={() => onSave(row)}><Field label="Code"><input value={row.code} onChange={e => setRow({ ...row, code: e.target.value })} className="input-field" /></Field><Field label="Description"><input value={row.description} onChange={e => setRow({ ...row, description: e.target.value })} className="input-field" /></Field><Field label="Category"><input value={row.category} onChange={e => setRow({ ...row, category: e.target.value })} className="input-field" /></Field><Field label="Rate (%)"><input value={row.rate} onChange={e => setRow({ ...row, rate: Number(e.target.value) })} className="input-field" /></Field><Field label="Type"><input value={row.type} onChange={e => setRow({ ...row, type: e.target.value })} className="input-field" /></Field><Field label="Applies To"><input value={row.appliesTo} onChange={e => setRow({ ...row, appliesTo: e.target.value })} className="input-field" /></Field></Modal>
}

function ExemptionModal({ data, onSave, onClose }: { data: TaxExemption; onSave: (row: TaxExemption) => void; onClose: () => void }) {
  const [row, setRow] = useState(data)
  return <Modal title="Tax Exemption" onClose={onClose} onSave={() => onSave(row)}><Field label="Code"><input value={row.code} onChange={e => setRow({ ...row, code: e.target.value })} className="input-field" /></Field><Field label="Name"><input value={row.name} onChange={e => setRow({ ...row, name: e.target.value })} className="input-field" /></Field><Field label="Type"><input value={row.type} onChange={e => setRow({ ...row, type: e.target.value })} className="input-field" /></Field><Field label="Applies To"><input value={row.appliesTo} onChange={e => setRow({ ...row, appliesTo: e.target.value })} className="input-field" /></Field><Field label="Effective From"><input type="date" value={row.effectiveFrom} onChange={e => setRow({ ...row, effectiveFrom: e.target.value })} className="input-field" /></Field><Field label="Effective To"><input value={row.effectiveTo} onChange={e => setRow({ ...row, effectiveTo: e.target.value })} className="input-field" /></Field><Field label="Status"><select value={row.status} onChange={e => setRow({ ...row, status: e.target.value as TaxExemption['status'] })} className="input-field"><option>Active</option><option>Conditional</option><option>Inactive</option></select></Field></Modal>
}

function Modal({ title, children, onClose, onSave }: { title: string; children: ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white p-6">
        <h3 className="text-lg font-bold text-navy">{title}</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
        <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={onClose} className="btn-secondary justify-center">Cancel</button><button onClick={onSave} className="btn-primary bg-coop-blue justify-center"><Save size={14} /> Save</button></div>
      </div>
    </div>
  )
}
