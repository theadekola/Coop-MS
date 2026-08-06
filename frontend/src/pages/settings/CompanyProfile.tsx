import { openSupportEmail } from '../../utils/support'
﻿import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode, RefObject } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Banknote,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Edit,
  Eye,
  FileText,
  Filter,
  Headphones,
  Info,
  KeyRound,
  Link,
  Mail,
  MapPin,
  MoreVertical,
  Palette,
  Phone,
  Plus,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import CoopLogo from '../../components/ui/CoopLogo'
import { accountsApi, settingsApi, staffApi } from '../../services/api'
import { applyBrowserBrandIcon, cacheCompanyBrand } from '../../utils/branding'

type Tab = 'Overview' | 'Branches' | 'Bank Accounts' | 'Signatories' | 'Preferences' | 'Subscription'
type CompanyDocument = { id: number; name: string; type: string; uploadedOn: string; size: number; dataUrl: string }
type Activity = { id: number; title: string; description: string; at: string; by: string }
type Branch = { id: number; name: string; code: string; address: string; location: string; manager: string; contact: string; email: string; staff: number; status: 'Active' | 'Inactive' }
type BankAccount = { id: number; accountName: string; bankName: string; branch: string; accountNumber: string; accountType: string; balance: number; status: 'Active' | 'Inactive'; currency: string; openedOn: string; lastTransaction: string; primary?: boolean }
type Signatory = { id: number; name: string; role: string; branch: string; email: string; phone: string; status: 'Active' | 'Inactive'; dateAdded: string; idType: string; idNumber: string; address: string; signatureDataUrl: string }
type Subscription = { id: number; name: string; tier: string; plan: string; status: 'Active' | 'Inactive' | 'Expired'; billingCycle: string; nextBillingDate: string; amount: number; description: string }
type Invoice = { id: number; date: string; amount: number; status: 'Paid' | 'Pending' }

type Preferences = {
  defaultDashboard: string
  itemsPerPage: string
  dateFormat: string
  timeFormat: '12 Hours' | '24 Hours'
  language: string
  theme: 'Light' | 'Dark' | 'System'
  primaryColor: string
  sidebarBehaviour: string
  compactMode: boolean
  showAnimations: boolean
  currency: string
  financialYearStart: string
  doubleEntry: boolean
  paymentApproval: boolean
  autoReceiptNumber: boolean
  emailNotifications: boolean
  smsNotifications: boolean
  browserNotifications: boolean
  systemAnnouncements: boolean
  marketingNews: boolean
  twoFactor: boolean
  sessionTimeout: string
  passwordExpiry: string
  loginAttemptLimit: string
  auditAdminActions: boolean
  paymentGateways: boolean
  smtpService: boolean
  smsGateway: boolean
  apiAccess: boolean
}

type CompanyProfileSettings = {
  companyName: string
  registrationNumber: string
  businessType: string
  dateRegistered: string
  cacNumber: string
  tin: string
  about: string
  address: string
  phone: string
  email: string
  website: string
  workingHours: string
  primaryColor: string
  secondaryColor: string
  logoDataUrl: string
  faviconDataUrl: string
  documents: CompanyDocument[]
  branches: Branch[]
  bankAccounts: BankAccount[]
  signatories: Signatory[]
  preferences: Preferences
  subscriptions: Subscription[]
  invoices: Invoice[]
  activities: Activity[]
}

const tabs: Tab[] = ['Overview', 'Branches', 'Bank Accounts', 'Signatories', 'Preferences', 'Subscription']

const blankPreferences: Preferences = {
  defaultDashboard: 'Main Dashboard',
  itemsPerPage: '25',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24 Hours',
  language: 'English (UK)',
  theme: 'Light',
  primaryColor: '#0057FF',
  sidebarBehaviour: 'Expanded',
  compactMode: false,
  showAnimations: true,
  currency: 'NGN',
  financialYearStart: 'January',
  doubleEntry: true,
  paymentApproval: true,
  autoReceiptNumber: true,
  emailNotifications: true,
  smsNotifications: false,
  browserNotifications: true,
  systemAnnouncements: true,
  marketingNews: false,
  twoFactor: true,
  sessionTimeout: '30 Minutes',
  passwordExpiry: '90 Days',
  loginAttemptLimit: '5 Attempts',
  auditAdminActions: true,
  paymentGateways: true,
  smtpService: true,
  smsGateway: false,
  apiAccess: false,
}

const blankProfile: CompanyProfileSettings = {
  companyName: '',
  registrationNumber: '',
  businessType: '',
  dateRegistered: '',
  cacNumber: '',
  tin: '',
  about: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  workingHours: '',
  primaryColor: '#0B7A3D',
  secondaryColor: '#F5B301',
  logoDataUrl: '',
  faviconDataUrl: '',
  documents: [],
  branches: [],
  bankAccounts: [],
  signatories: [],
  preferences: blankPreferences,
  subscriptions: [],
  invoices: [],
  activities: [],
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(Number(value || 0))
}

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

function downloadBlob(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function csv(rows: Array<Array<string | number | boolean | undefined>>) {
  return rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Could not load image'))
      image.onload = () => {
        const max = 700
        const scale = Math.min(1, max / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) return reject(new Error('Could not process image'))
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      image.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}

export default function CompanyProfile() {
  const logoRef = useRef<HTMLInputElement>(null)
  const faviconRef = useRef<HTMLInputElement>(null)
  const docsRef = useRef<HTMLInputElement>(null)
  const signatureRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [profile, setProfile] = useState<CompanyProfileSettings>(blankProfile)
  const [staffTotal, setStaffTotal] = useState(0)
  const [accountSummary, setAccountSummary] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [editingCompany, setEditingCompany] = useState(true)
  const [editingContact, setEditingContact] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [selectedSignatoryId, setSelectedSignatoryId] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [saved, staff, accounts] = await Promise.all([
          settingsApi.get<CompanyProfileSettings>('company-profile'),
          staffApi.list({ limit: 1 }).catch(() => ({ data: [], total: 0 })),
          accountsApi.summary().catch(() => ({} as Record<string, number>)),
        ])
        if (!mounted) return
        const merged = {
          ...blankProfile,
          ...saved,
          preferences: { ...blankPreferences, ...(saved.preferences || {}) },
          documents: saved.documents || [],
          branches: saved.branches || [],
          bankAccounts: saved.bankAccounts || [],
          signatories: saved.signatories || [],
          subscriptions: saved.subscriptions || [],
          invoices: saved.invoices || [],
          activities: saved.activities || [],
        }
        setProfile(merged)
        setSelectedBranchId(merged.branches[0]?.id || null)
        setSelectedAccountId(merged.bankAccounts[0]?.id || null)
        setSelectedSignatoryId(merged.signatories[0]?.id || null)
        setStaffTotal(staff.total || staff.data.length)
        setAccountSummary(accounts)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not load company profile')
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const totalAssets = Number(accountSummary.cashBalance || 0) + Number(accountSummary.bankBalance || 0) + profile.bankAccounts.reduce((sum, row) => sum + Number(row.balance || 0), 0)
  const selectedBranch = profile.branches.find(row => row.id === selectedBranchId) || profile.branches[0]
  const selectedAccount = profile.bankAccounts.find(row => row.id === selectedAccountId) || profile.bankAccounts[0]
  const selectedSignatory = profile.signatories.find(row => row.id === selectedSignatoryId) || profile.signatories[0]
  const monthlyCost = profile.subscriptions.filter(row => row.status === 'Active').reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const nextBilling = profile.subscriptions.map(row => row.nextBillingDate).filter(Boolean).sort()[0] || ''
  const activeSubscriptions = profile.subscriptions.filter(row => row.status === 'Active')

  const update = <K extends keyof CompanyProfileSettings>(key: K, value: CompanyProfileSettings[K]) => setProfile(prev => ({ ...prev, [key]: value }))
  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setProfile(prev => ({ ...prev, preferences: { ...prev.preferences, [key]: value } }))

  const withActivity = (next: CompanyProfileSettings, title: string, description: string): CompanyProfileSettings => ({
    ...next,
    activities: [{ id: Date.now(), title, description, at: new Date().toISOString(), by: 'Current User' }, ...(next.activities || [])].slice(0, 20),
  })

  const saveProfile = async (nextProfile = profile, message = 'Company profile saved') => {
    setSaving(true)
    try {
      const saved = await settingsApi.save<CompanyProfileSettings>('company-profile', nextProfile)
      const merged = { ...blankProfile, ...saved, preferences: { ...blankPreferences, ...(saved.preferences || {}) } }
      setProfile(merged)
      cacheCompanyBrand({ companyName: merged.companyName, logoDataUrl: merged.logoDataUrl, faviconDataUrl: merged.faviconDataUrl })
      applyBrowserBrandIcon({ logoDataUrl: merged.logoDataUrl, faviconDataUrl: merged.faviconDataUrl })
      window.dispatchEvent(new CustomEvent('company-profile-updated', { detail: { companyName: merged.companyName, logoDataUrl: merged.logoDataUrl, faviconDataUrl: merged.faviconDataUrl } }))
      toast.success(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save company profile')
    } finally {
      setSaving(false)
    }
  }

  const saveSection = (title: string, description: string) => saveProfile(withActivity(profile, title, description))

  const handleImage = async (event: ChangeEvent<HTMLInputElement>, key: 'logoDataUrl' | 'faviconDataUrl') => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Select an image file')
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be 2MB or less')
    try {
      const dataUrl = await resizeImage(file)
      const next = withActivity({ ...profile, [key]: dataUrl }, 'Branding updated', key === 'logoDataUrl' ? 'Primary logo changed' : 'Favicon changed')
      setProfile(next)
      await saveProfile(next, 'Branding saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload image')
    }
  }

  const handleDocuments = async (files: File[]) => {
    if (!files.length) return
    const docs: CompanyDocument[] = []
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 10MB`)
        continue
      }
      docs.push({ id: Date.now() + docs.length, name: file.name, type: file.type || 'Document', uploadedOn: new Date().toISOString(), size: file.size, dataUrl: await fileToDataUrl(file) })
    }
    if (!docs.length) return
    const next = withActivity({ ...profile, documents: [...docs, ...profile.documents] }, 'New document uploaded', `${docs.length} document${docs.length === 1 ? '' : 's'} uploaded`)
    setProfile(next)
    await saveProfile(next, 'Document uploaded')
  }

  const dropDocuments = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    handleDocuments(Array.from(event.dataTransfer.files || []))
  }

  const downloadDocument = (doc: CompanyDocument) => {
    if (doc.dataUrl) {
      const link = document.createElement('a')
      link.href = doc.dataUrl
      link.download = doc.name
      link.click()
      return
    }
    toast.error('Document file is not available')
  }

  const removeDocument = async (id: number) => {
    const next = withActivity({ ...profile, documents: profile.documents.filter(doc => doc.id !== id) }, 'Document removed', 'A company document was deleted')
    setProfile(next)
    await saveProfile(next, 'Document deleted')
  }

  const addBranch = () => {
    const id = Date.now()
    const next = { id, name: '', code: '', address: '', location: '', manager: '', contact: '', email: '', staff: 0, status: 'Active' as const }
    setSelectedBranchId(id)
    setProfile(prev => ({ ...prev, branches: [next, ...prev.branches] }))
  }

  const addBankAccount = () => {
    const id = Date.now()
    const next = { id, accountName: '', bankName: '', branch: '', accountNumber: '', accountType: 'Current Account', balance: 0, status: 'Active' as const, currency: 'NGN', openedOn: '', lastTransaction: '', primary: !profile.bankAccounts.length }
    setSelectedAccountId(id)
    setProfile(prev => ({ ...prev, bankAccounts: [next, ...prev.bankAccounts] }))
  }

  const addSignatory = () => {
    const id = Date.now()
    const next = { id, name: '', role: '', branch: '', email: '', phone: '', status: 'Active' as const, dateAdded: '', idType: '', idNumber: '', address: '', signatureDataUrl: '' }
    setSelectedSignatoryId(id)
    setProfile(prev => ({ ...prev, signatories: [next, ...prev.signatories] }))
  }

  const addSubscription = () => {
    const next = { id: Date.now(), name: '', tier: '', plan: '', status: 'Active' as const, billingCycle: 'Monthly', nextBillingDate: '', amount: 0, description: '' }
    setProfile(prev => ({ ...prev, subscriptions: [next, ...prev.subscriptions] }))
  }

  const setSignatureImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedSignatory) return
    if (!file.type.startsWith('image/')) return toast.error('Select an image file')
    const dataUrl = await resizeImage(file)
    setProfile(prev => ({ ...prev, signatories: prev.signatories.map(row => row.id === selectedSignatory.id ? { ...row, signatureDataUrl: dataUrl } : row) }))
  }

  const exportProfile = () => downloadBlob('company-profile.json', JSON.stringify(profile, null, 2), 'application/json')
  const exportBranches = () => downloadBlob('branches.csv', csv([['Name', 'Code', 'Location', 'Manager', 'Contact', 'Staff', 'Status'], ...profile.branches.map(row => [row.name, row.code, row.location, row.manager, row.contact, row.staff, row.status])]), 'text/csv')
  const exportAccounts = () => downloadBlob('bank-accounts.csv', csv([['Account Name', 'Bank', 'Account Number', 'Type', 'Balance', 'Status'], ...profile.bankAccounts.map(row => [row.accountName, row.bankName, row.accountNumber, row.accountType, row.balance, row.status])]), 'text/csv')
  const exportSignatories = () => downloadBlob('signatory-register.csv', csv([['Name', 'Role', 'Branch', 'Email', 'Phone', 'Status', 'Date Added'], ...profile.signatories.map(row => [row.name, row.role, row.branch, row.email, row.phone, row.status, row.dateAdded])]), 'text/csv')
  const exportInvoices = () => downloadBlob('subscription-invoices.csv', csv([['Invoice', 'Date', 'Amount', 'Status'], ...profile.invoices.map(row => [row.id, row.date, row.amount, row.status])]), 'text/csv')

  const filteredBranches = profile.branches.filter(row => `${row.name} ${row.code} ${row.location} ${row.manager}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || row.status === filter))
  const filteredAccounts = profile.bankAccounts.filter(row => `${row.accountName} ${row.bankName} ${row.accountNumber}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || row.status === filter))
  const filteredSignatories = profile.signatories.filter(row => `${row.name} ${row.role} ${row.branch}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || row.status === filter))
  const filteredSubscriptions = profile.subscriptions.filter(row => `${row.name} ${row.plan} ${row.tier}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All' || row.status === filter))

  return (
    <div className="p-4 lg:p-5 space-y-4 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Company Profile</h2>
          <p className="text-sm text-slate-500 mt-1">View and manage your company information and settings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportProfile} className="btn-secondary"><Download size={14} /> Export</button>
          <button onClick={() => saveProfile()} disabled={saving} className="btn-primary bg-navy disabled:opacity-60"><Save size={14} /> Save Changes</button>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white rounded-t-lg px-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {tabs.map(tab => <button key={tab} onClick={() => { setActiveTab(tab); setSearch(''); setFilter('All') }} className={`px-4 py-3 text-xs font-bold border-b-2 ${activeTab === tab ? 'border-coop-blue text-coop-blue' : 'border-transparent text-navy hover:text-coop-blue'}`}>{tab}</button>)}
        </div>
      </div>

      {activeTab === 'Overview' && <Overview profile={profile} staffTotal={staffTotal} totalAssets={totalAssets} editingCompany={editingCompany} setEditingCompany={setEditingCompany} editingContact={editingContact} setEditingContact={setEditingContact} update={update} saveSection={saveSection} saving={saving} logoRef={logoRef} faviconRef={faviconRef} docsRef={docsRef} handleImage={handleImage} handleDocuments={handleDocuments} dropDocuments={dropDocuments} downloadDocument={downloadDocument} removeDocument={removeDocument} />}
      {activeTab === 'Branches' && <Branches rows={filteredBranches} allRows={profile.branches} selected={selectedBranch} search={search} filter={filter} setSearch={setSearch} setFilter={setFilter} add={addBranch} select={setSelectedBranchId} update={rows => update('branches', rows)} save={() => saveSection('Branch information updated', 'Branch records were saved')} remove={id => update('branches', profile.branches.filter(row => row.id !== id))} exportRows={exportBranches} />}
      {activeTab === 'Bank Accounts' && <BankAccounts rows={filteredAccounts} allRows={profile.bankAccounts} selected={selectedAccount} search={search} filter={filter} setSearch={setSearch} setFilter={setFilter} add={addBankAccount} select={setSelectedAccountId} update={rows => update('bankAccounts', rows)} save={() => saveSection('Bank account information updated', 'Bank account records were saved')} remove={id => update('bankAccounts', profile.bankAccounts.filter(row => row.id !== id))} exportRows={exportAccounts} />}
      {activeTab === 'Signatories' && <Signatories rows={filteredSignatories} allRows={profile.signatories} selected={selectedSignatory} search={search} filter={filter} setSearch={setSearch} setFilter={setFilter} add={addSignatory} select={setSelectedSignatoryId} update={rows => update('signatories', rows)} save={() => saveSection('Signatory information updated', 'Signatory records were saved')} remove={id => update('signatories', profile.signatories.filter(row => row.id !== id))} exportRows={exportSignatories} signatureRef={signatureRef} setSignatureImage={setSignatureImage} />}
      {activeTab === 'Preferences' && <PreferencesTab prefs={profile.preferences} update={updatePref} save={() => saveSection('Preferences updated', 'Company preferences were saved')} exportPrefs={() => downloadBlob('company-preferences.json', JSON.stringify(profile.preferences, null, 2), 'application/json')} />}
      {activeTab === 'Subscription' && <SubscriptionTab rows={filteredSubscriptions} allRows={profile.subscriptions} invoices={profile.invoices} search={search} filter={filter} setSearch={setSearch} setFilter={setFilter} add={addSubscription} update={rows => update('subscriptions', rows)} save={() => saveSection('Subscriptions updated', 'Subscription records were saved')} remove={id => update('subscriptions', profile.subscriptions.filter(row => row.id !== id))} monthlyCost={monthlyCost} nextBilling={nextBilling} activeCount={activeSubscriptions.length} exportInvoices={exportInvoices} />}

      <Notice>Keep your company information up to date. This information is used in reports, documents and official correspondence.</Notice>
      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">&copy; {new Date().getFullYear()} {profile.companyName || 'Company'}. All rights reserved.</footer>
    </div>
  )
}

function Overview({ profile, staffTotal, totalAssets, editingCompany, setEditingCompany, editingContact, setEditingContact, update, saveSection, saving, logoRef, faviconRef, docsRef, handleImage, handleDocuments, dropDocuments, downloadDocument, removeDocument }: {
  profile: CompanyProfileSettings
  staffTotal: number
  totalAssets: number
  editingCompany: boolean
  setEditingCompany: (value: boolean | ((value: boolean) => boolean)) => void
  editingContact: boolean
  setEditingContact: (value: boolean | ((value: boolean) => boolean)) => void
  update: <K extends keyof CompanyProfileSettings>(key: K, value: CompanyProfileSettings[K]) => void
  saveSection: (title: string, description: string) => void
  saving: boolean
  logoRef: RefObject<HTMLInputElement>
  faviconRef: RefObject<HTMLInputElement>
  docsRef: RefObject<HTMLInputElement>
  handleImage: (event: ChangeEvent<HTMLInputElement>, key: 'logoDataUrl' | 'faviconDataUrl') => void
  handleDocuments: (files: File[]) => void
  dropDocuments: (event: DragEvent<HTMLButtonElement>) => void
  downloadDocument: (doc: CompanyDocument) => void
  removeDocument: (id: number) => void
}) {
  const set = <K extends keyof CompanyProfileSettings>(key: K, value: CompanyProfileSettings[K]) => update(key, value)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <Card title="Company Information" sub="View and update your company details." action={<button onClick={() => setEditingCompany(v => !v)} className="btn-secondary"><Edit size={14} /> {editingCompany ? 'Done Editing' : 'Edit Company Information'}</button>}>
          <div className="grid grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)] gap-5">
            <LogoPanel profile={profile} logoRef={logoRef} onLogo={event => handleImage(event, 'logoDataUrl')} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TextField label="Company Name *" value={profile.companyName} disabled={!editingCompany} onChange={value => set('companyName', value)} />
              <TextField label="Registration Number *" value={profile.registrationNumber} disabled={!editingCompany} onChange={value => set('registrationNumber', value)} />
              <TextField label="Business Type" value={profile.businessType} disabled={!editingCompany} onChange={value => set('businessType', value)} />
              <TextField label="Date Registered" type="date" value={profile.dateRegistered} disabled={!editingCompany} onChange={value => set('dateRegistered', value)} />
              <TextField label="CAC Number" value={profile.cacNumber} disabled={!editingCompany} onChange={value => set('cacNumber', value)} />
              <TextField label="Tax Identification Number (TIN)" value={profile.tin} disabled={!editingCompany} onChange={value => set('tin', value)} />
              <label className="md:col-span-2 block"><Label>About Company</Label><textarea value={profile.about} disabled={!editingCompany} onChange={event => set('about', event.target.value)} className="input-field min-h-20 resize-none" /></label>
            </div>
          </div>
          <button onClick={() => saveSection('Company information updated', 'Company details were saved')} disabled={saving} className="btn-primary bg-navy mt-4 disabled:opacity-60"><Save size={14} /> Save Company Information</button>
        </Card>

        <Card title="Contact Information" sub="Update your contact and address details." action={<button onClick={() => setEditingContact(v => !v)} className="btn-secondary"><Edit size={14} /> {editingContact ? 'Done Editing' : 'Edit Contact Info'}</button>}>
          {editingContact ? (
            <div className="space-y-3">
              <TextField label="Head Office Address" value={profile.address} onChange={value => set('address', value)} />
              <TextField label="Phone Number" value={profile.phone} onChange={value => set('phone', value)} />
              <TextField label="Email Address" type="email" value={profile.email} onChange={value => set('email', value)} />
              <TextField label="Website" value={profile.website} onChange={value => set('website', value)} />
              <TextField label="Working Hours" value={profile.workingHours} onChange={value => set('workingHours', value)} />
              <button onClick={() => saveSection('Contact information updated', 'Contact details were saved')} className="btn-primary bg-navy"><Save size={14} /> Save Contact Info</button>
            </div>
          ) : (
            <div className="space-y-2">
              <InfoRow icon={<MapPin size={16} />} label="Head Office Address" value={profile.address} />
              <InfoRow icon={<Phone size={16} />} label="Phone Number" value={profile.phone} />
              <InfoRow icon={<Mail size={16} />} label="Email Address" value={profile.email} />
              <InfoRow icon={<Link size={16} />} label="Website" value={profile.website} />
              <InfoRow icon={<Clock size={16} />} label="Working Hours" value={profile.workingHours} />
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)_360px] gap-4">
        <Card title="Company Branding" sub="Manage your company logo, colors and branding.">
          <div className="grid grid-cols-2 gap-4">
            <ImageBox title="Primary Logo" image={profile.logoDataUrl} fallback={<CoopLogo size={70} />} onUpload={() => logoRef.current?.click()} onClear={() => update('logoDataUrl', '')} />
            <ImageBox title="Favicon / Icon" image={profile.faviconDataUrl} fallback={<CoopLogo size={44} />} onUpload={() => faviconRef.current?.click()} onClear={() => update('faviconDataUrl', '')} />
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={event => handleImage(event, 'logoDataUrl')} />
          <input ref={faviconRef} type="file" accept="image/*" className="hidden" onChange={event => handleImage(event, 'faviconDataUrl')} />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <ColorField label="Brand Color" value={profile.primaryColor} onChange={value => update('primaryColor', value)} />
            <ColorField label="Secondary Color" value={profile.secondaryColor} onChange={value => update('secondaryColor', value)} />
          </div>
          <button onClick={() => saveSection('Branding updated', 'Branding settings were saved')} className="btn-success mt-4"><CheckCircle2 size={14} /> Save Branding</button>
        </Card>

        <Card title="Company Documents" sub="Upload and manage important company documents." action={<button onClick={() => docsRef.current?.click()} className="btn-secondary"><Upload size={14} /> Upload</button>}>
          <input ref={docsRef} type="file" multiple className="hidden" onChange={event => handleDocuments(Array.from(event.target.files || []))} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr>{['Document Name', 'Type', 'Uploaded On', 'Action'].map(header => <th key={header} className="table-th">{header}</th>)}</tr></thead>
              <tbody>{profile.documents.slice(0, 6).map(doc => <tr key={doc.id}><td className="table-td font-bold text-navy">{doc.name}</td><td className="table-td">{doc.type || 'Document'}</td><td className="table-td">{formatDate(doc.uploadedOn)}</td><td className="table-td"><div className="flex gap-1"><IconButton title="Download" onClick={() => downloadDocument(doc)}><Download size={13} /></IconButton><IconButton title="Delete" onClick={() => removeDocument(doc.id)} danger><Trash2 size={13} /></IconButton></div></td></tr>)}</tbody>
            </table>
            {!profile.documents.length && <Empty message="No documents uploaded yet." />}
          </div>
          <button onDrop={dropDocuments} onDragOver={event => event.preventDefault()} onClick={() => docsRef.current?.click()} className="mt-4 w-full rounded-lg border border-dashed border-blue-200 bg-blue-50 px-4 py-5 text-sm font-semibold text-coop-blue">Drag and drop files here or click to upload<br /><span className="font-normal text-slate-500">PDF, JPG, PNG, DOCX, XLSX up to 10MB</span></button>
        </Card>

        <div className="space-y-4">
          <Card title="Company Statistics" sub="Key statistics about your company.">
            <MetricList rows={[
              ['Total Members', String(staffTotal)],
              ['Total Staff', String(staffTotal)],
              ['Total Branches', String(profile.branches.length)],
              ['Years in Operation', profile.dateRegistered ? String(Math.max(0, new Date().getFullYear() - new Date(profile.dateRegistered).getFullYear())) : '-'],
              ['Total Assets', formatMoney(totalAssets)],
              ['Bank Accounts', String(profile.bankAccounts.length)],
            ]} />
          </Card>
          <Card title="Recent Activity" sub="Latest changes made to company profile.">
            <ActivityList rows={profile.activities} />
          </Card>
        </div>
      </div>
    </div>
  )
}

function Branches({ rows, allRows, selected, search, filter, setSearch, setFilter, add, select, update, save, remove, exportRows }: { rows: Branch[]; allRows: Branch[]; selected?: Branch; search: string; filter: string; setSearch: (value: string) => void; setFilter: (value: string) => void; add: () => void; select: (id: number) => void; update: (rows: Branch[]) => void; save: () => void; remove: (id: number) => void; exportRows: () => void }) {
  return <div className="space-y-4"><Toolbar title="Branches" sub="View and manage all branches of the cooperative." search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} add={add} addLabel="Add Branch" exportRows={exportRows} /><Stats cards={[['Total Branches', allRows.length, 'Active branches'], ['Active Branches', allRows.filter(row => row.status === 'Active').length, 'Currently active'], ['Total Locations', new Set(allRows.map(row => row.location).filter(Boolean)).size, 'Across all branches'], ['Total Staff', allRows.reduce((sum, row) => sum + Number(row.staff || 0), 0), 'Across all branches']]} /><div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4"><Card title="Branch List"><DataTable headers={['Branch Name', 'Branch Code', 'Location', 'Manager', 'Contact', 'Staff', 'Status', 'Actions']} rows={rows.map(row => [<Editable value={row.name} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, name: value } : item))} />, <Editable value={row.code} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, code: value } : item))} />, <Editable value={row.location} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, location: value } : item))} />, <Editable value={row.manager} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, manager: value } : item))} />, <Editable value={row.contact} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, contact: value } : item))} />, <Editable type="number" value={String(row.staff || 0)} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, staff: Number(value) } : item))} />, <StatusSelect value={row.status} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, status: value } : item))} />, <RowActions onView={() => select(row.id)} onDelete={() => remove(row.id)} />])} /><button onClick={save} className="btn-primary bg-navy mt-4"><Save size={14} /> Save Branches</button></Card><Card title="Branch Details"><Details rows={selected ? [['Branch Name', selected.name], ['Code', selected.code], ['Address', selected.address], ['Location', selected.location], ['Manager', selected.manager], ['Contact', selected.contact], ['Email', selected.email], ['Staff', String(selected.staff || 0)], ['Status', selected.status]] : []} /></Card></div><Notice>Keep branch information up to date to ensure accurate reporting and communication.</Notice></div>
}

function BankAccounts({ rows, allRows, selected, search, filter, setSearch, setFilter, add, select, update, save, remove, exportRows }: { rows: BankAccount[]; allRows: BankAccount[]; selected?: BankAccount; search: string; filter: string; setSearch: (value: string) => void; setFilter: (value: string) => void; add: () => void; select: (id: number) => void; update: (rows: BankAccount[]) => void; save: () => void; remove: (id: number) => void; exportRows: () => void }) {
  const totalBalance = allRows.reduce((sum, row) => sum + Number(row.balance || 0), 0)
  return <div className="space-y-4"><Toolbar title="Bank Accounts" sub="Manage all bank accounts used by the cooperative." search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} add={add} addLabel="Add Bank Account" exportRows={exportRows} /><Stats cards={[['Total Bank Accounts', allRows.length, 'All accounts'], ['Total Balance', formatMoney(totalBalance), 'Across all accounts'], ['Active Accounts', allRows.filter(row => row.status === 'Active').length, 'Currently active'], ['Transactions This Month', '-', 'Use Accounts module']]} /><div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4"><Card title="Accounts"><DataTable headers={['Account Name', 'Bank Details', 'Account Number', 'Type', 'Balance', 'Status', 'Actions']} rows={rows.map(row => [<Editable value={row.accountName} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, accountName: value } : item))} />, <Editable value={row.bankName} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, bankName: value } : item))} />, <Editable value={row.accountNumber} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, accountNumber: value } : item))} />, <Editable value={row.accountType} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, accountType: value } : item))} />, <Editable type="number" value={String(row.balance || 0)} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, balance: Number(value) } : item))} />, <StatusSelect value={row.status} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, status: value } : item))} />, <RowActions onView={() => select(row.id)} onDelete={() => remove(row.id)} />])} /><button onClick={save} className="btn-primary bg-navy mt-4"><Save size={14} /> Save Bank Accounts</button></Card><Card title="Account Details"><Details rows={selected ? [['Account Name', selected.accountName], ['Bank Name', selected.bankName], ['Branch', selected.branch], ['Account Number', selected.accountNumber], ['Account Type', selected.accountType], ['Balance', formatMoney(selected.balance)], ['Currency', selected.currency], ['Status', selected.status], ['Date Opened', formatDate(selected.openedOn)], ['Last Transaction', formatDate(selected.lastTransaction)]] : []} /><button onClick={() => selected && downloadBlob(`${selected.accountName || 'account'}-statement.txt`, JSON.stringify(selected, null, 2))} className="btn-secondary w-full justify-center mt-4"><FileText size={14} /> View Account Statement</button></Card></div></div>
}

function Signatories({ rows, allRows, selected, search, filter, setSearch, setFilter, add, select, update, save, remove, exportRows, signatureRef, setSignatureImage }: { rows: Signatory[]; allRows: Signatory[]; selected?: Signatory; search: string; filter: string; setSearch: (value: string) => void; setFilter: (value: string) => void; add: () => void; select: (id: number) => void; update: (rows: Signatory[]) => void; save: () => void; remove: (id: number) => void; exportRows: () => void; signatureRef: RefObject<HTMLInputElement>; setSignatureImage: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="space-y-4"><Toolbar title="Signatories" sub="Manage authorized signatories." search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} add={add} addLabel="Add Signatory" exportRows={exportRows} exportLabel="Download Register" /><Stats cards={[['Total Signatories', allRows.length, 'Authorized signatories'], ['Active Signatories', allRows.filter(row => row.status === 'Active').length, 'Currently active'], ['Pending Approval', 0, 'Awaiting approval'], ['Last Updated', allRows[0]?.dateAdded ? formatDate(allRows[0].dateAdded) : '-', 'Latest saved date']]} /><div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4"><Card title="Signatory List"><DataTable headers={['Signatory', 'Role', 'Branch', 'Status', 'Date Added', 'Actions']} rows={rows.map(row => [<Editable value={row.name} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, name: value } : item))} />, <Editable value={row.role} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, role: value } : item))} />, <Editable value={row.branch} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, branch: value } : item))} />, <StatusSelect value={row.status} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, status: value } : item))} />, <Editable type="date" value={row.dateAdded} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, dateAdded: value } : item))} />, <RowActions onView={() => select(row.id)} onDelete={() => remove(row.id)} />])} /><button onClick={save} className="btn-primary bg-navy mt-4"><Save size={14} /> Save Signatories</button></Card><Card title="Signatory Details"><Details rows={selected ? [['Name', selected.name], ['Email', selected.email], ['Phone', selected.phone], ['Role', selected.role], ['Branch', selected.branch], ['ID Type', selected.idType], ['ID Number', selected.idNumber], ['Address', selected.address], ['Status', selected.status]] : []} /><div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-center">{selected?.signatureDataUrl ? <img src={selected.signatureDataUrl} alt="Signature specimen" className="mx-auto max-h-20 object-contain" /> : <span className="text-xs text-slate-400">No signature specimen</span>}</div><input ref={signatureRef} type="file" accept="image/*" className="hidden" onChange={setSignatureImage} /><button onClick={() => signatureRef.current?.click()} className="btn-secondary w-full justify-center mt-3"><Upload size={14} /> Upload Signature</button></Card></div><Notice>Only authorized signatories can perform transactions and sign official documents.</Notice></div>
}

function PreferencesTab({ prefs, update, save, exportPrefs }: { prefs: Preferences; update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void; save: () => void; exportPrefs: () => void }) {
  return <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4"><div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><PrefCard title="General Preferences" icon={<SettingsIcon />}><SelectField label="Default Dashboard" value={prefs.defaultDashboard} options={['Main Dashboard', 'Accounts', 'Reports']} onChange={value => update('defaultDashboard', value)} /><SelectField label="Items Per Page" value={prefs.itemsPerPage} options={['10', '25', '50', '100']} onChange={value => update('itemsPerPage', value)} /><SelectField label="Date Format" value={prefs.dateFormat} options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} onChange={value => update('dateFormat', value)} /><SelectField label="Language" value={prefs.language} options={['English (UK)', 'English (US)', 'Yoruba']} onChange={value => update('language', value)} /><RadioField label="Time Format" value={prefs.timeFormat} options={['12 Hours', '24 Hours']} onChange={value => update('timeFormat', value as Preferences['timeFormat'])} /><SaveButton onClick={save} /></PrefCard><PrefCard title="Theme & Appearance" icon={<Palette size={18} />}><RadioButtons value={prefs.theme} options={['Light', 'Dark', 'System']} onChange={value => update('theme', value as Preferences['theme'])} /><ColorChoices value={prefs.primaryColor} onChange={value => update('primaryColor', value)} /><SelectField label="Sidebar Behaviour" value={prefs.sidebarBehaviour} options={['Expanded', 'Collapsed', 'Auto']} onChange={value => update('sidebarBehaviour', value)} /><SwitchRow label="Compact Mode" checked={prefs.compactMode} onChange={value => update('compactMode', value)} /><SwitchRow label="Show Animations" checked={prefs.showAnimations} onChange={value => update('showAnimations', value)} /><SaveButton onClick={save} /></PrefCard><PrefCard title="Financial Preferences" icon={<Banknote size={18} />}><SelectField label="Default Currency" value={prefs.currency} options={['NGN', 'USD', 'GBP']} onChange={value => update('currency', value)} /><SelectField label="Financial Year Start" value={prefs.financialYearStart} options={['January', 'April', 'July', 'October']} onChange={value => update('financialYearStart', value)} /><SwitchRow label="Enable Double Entry" checked={prefs.doubleEntry} onChange={value => update('doubleEntry', value)} /><SwitchRow label="Require Approval for Payments" checked={prefs.paymentApproval} onChange={value => update('paymentApproval', value)} /><SwitchRow label="Auto-generate Receipt No." checked={prefs.autoReceiptNumber} onChange={value => update('autoReceiptNumber', value)} /><SaveButton onClick={save} /></PrefCard><PrefCard title="Notification Preferences" icon={<Bell size={18} />}><SwitchRow label="Email Notifications" checked={prefs.emailNotifications} onChange={value => update('emailNotifications', value)} /><SwitchRow label="SMS Notifications" checked={prefs.smsNotifications} onChange={value => update('smsNotifications', value)} /><SwitchRow label="Browser Notifications" checked={prefs.browserNotifications} onChange={value => update('browserNotifications', value)} /><SwitchRow label="System Announcements" checked={prefs.systemAnnouncements} onChange={value => update('systemAnnouncements', value)} /><SwitchRow label="Marketing & News" checked={prefs.marketingNews} onChange={value => update('marketingNews', value)} /><SaveButton onClick={save} /></PrefCard><PrefCard title="Security Preferences" icon={<Shield size={18} />}><SwitchRow label="Two-Factor Authentication" checked={prefs.twoFactor} onChange={value => update('twoFactor', value)} /><SelectField label="Session Timeout" value={prefs.sessionTimeout} options={['15 Minutes', '30 Minutes', '60 Minutes']} onChange={value => update('sessionTimeout', value)} /><SelectField label="Password Expiry" value={prefs.passwordExpiry} options={['30 Days', '60 Days', '90 Days', 'Never']} onChange={value => update('passwordExpiry', value)} /><SelectField label="Login Attempt Limit" value={prefs.loginAttemptLimit} options={['3 Attempts', '5 Attempts', '10 Attempts']} onChange={value => update('loginAttemptLimit', value)} /><SwitchRow label="Audit All Admin Actions" checked={prefs.auditAdminActions} onChange={value => update('auditAdminActions', value)} /><SaveButton onClick={save} /></PrefCard><PrefCard title="Integration Preferences" icon={<Link size={18} />}><SwitchRow label="Payment Gateways" checked={prefs.paymentGateways} onChange={value => update('paymentGateways', value)} /><SwitchRow label="Email Service (SMTP)" checked={prefs.smtpService} onChange={value => update('smtpService', value)} /><SwitchRow label="SMS Gateway" checked={prefs.smsGateway} onChange={value => update('smsGateway', value)} /><SwitchRow label="API Access" checked={prefs.apiAccess} onChange={value => update('apiAccess', value)} /><button onClick={() => toast.success('API key configuration saved in preferences')} className="btn-secondary w-full justify-center mt-3"><KeyRound size={14} /> Configure API Keys</button><SaveButton onClick={save} /></PrefCard></div><div className="space-y-4"><Card title="Preferences Summary"><MetricList rows={[['Theme', prefs.theme], ['Language', prefs.language], ['Currency', prefs.currency], ['Date Format', prefs.dateFormat], ['Time Format', prefs.timeFormat], ['Items Per Page', prefs.itemsPerPage], ['Email Notifications', prefs.emailNotifications ? 'Enabled' : 'Disabled'], ['SMS Notifications', prefs.smsNotifications ? 'Enabled' : 'Disabled']]} /><div className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs font-bold text-green-700">All preferences are ready to save.</div></Card><Card title="Quick Actions"><button onClick={() => window.location.reload()} className="btn-secondary w-full justify-start mb-2"><RefreshMini /> Reset to Last Saved</button><button onClick={exportPrefs} className="btn-secondary w-full justify-start mb-2"><Download size={14} /> Export Preferences</button><button onClick={() => toast.success('Preference history is captured in Recent Activity')} className="btn-secondary w-full justify-start"><Clock size={14} /> Preference History</button></Card></div><Notice>Preferences are saved through company profile settings and applied across the system for authorized users.</Notice></div>
}

function SubscriptionTab({ rows, allRows, invoices, search, filter, setSearch, setFilter, add, update, save, remove, monthlyCost, nextBilling, activeCount, exportInvoices }: { rows: Subscription[]; allRows: Subscription[]; invoices: Invoice[]; search: string; filter: string; setSearch: (value: string) => void; setFilter: (value: string) => void; add: () => void; update: (rows: Subscription[]) => void; save: () => void; remove: (id: number) => void; monthlyCost: number; nextBilling: string; activeCount: number; exportInvoices: () => void }) {
  return <div className="space-y-4"><Toolbar title="Subscriptions" sub="Manage and monitor all active subscriptions for your cooperative." search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} add={add} addLabel="Add Subscription" exportRows={exportInvoices} exportLabel="Download Invoices" /><Stats cards={[['Active Subscriptions', activeCount, 'Currently active'], ['Total Monthly Cost', formatMoney(monthlyCost), 'Across active subscriptions'], ['Next Billing Date', formatDate(nextBilling), 'Upcoming payment'], ['Annual Cost', formatMoney(monthlyCost * 12), 'Estimated annual total']]} /><div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4"><Card title="Your Subscriptions"><DataTable headers={['Subscription', 'Plan', 'Status', 'Billing Cycle', 'Next Billing Date', 'Amount', 'Actions']} rows={rows.map(row => [<Editable value={row.name} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, name: value } : item))} />, <Editable value={row.plan} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, plan: value } : item))} />, <StatusSelect value={row.status} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, status: value as Subscription['status'] } : item))} />, <Editable value={row.billingCycle} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, billingCycle: value } : item))} />, <Editable type="date" value={row.nextBillingDate} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, nextBillingDate: value } : item))} />, <Editable type="number" value={String(row.amount || 0)} onChange={value => update(allRows.map(item => item.id === row.id ? { ...item, amount: Number(value) } : item))} />, <RowActions onView={() => toast.success(row.description || 'Subscription selected')} onDelete={() => remove(row.id)} />])} /><button onClick={save} className="btn-primary bg-navy mt-4"><Save size={14} /> Save Subscriptions</button></Card><div className="space-y-4"><Card title="Subscription Summary"><MetricList rows={[['Active Subscriptions', String(activeCount)], ['Total Monthly Cost', formatMoney(monthlyCost)], ['Total Annual Cost', formatMoney(monthlyCost * 12)], ['Next Billing Date', formatDate(nextBilling)], ['Payment Method', 'Managed by finance']]} /></Card><Card title="Recent Invoices">{invoices.length ? invoices.slice(0, 5).map(row => <div key={row.id} className="flex justify-between border-b border-slate-100 py-2 text-xs"><span className="font-bold text-navy">{row.id}</span><span>{formatDate(row.date)}</span><span>{formatMoney(row.amount)}</span><span className="badge bg-green-100 text-green-700">{row.status}</span></div>) : <Empty message="No invoices recorded." />}<button onClick={exportInvoices} className="btn-secondary w-full justify-center mt-3"><Download size={14} /> Download Invoices</button></Card><Card title="Need Help?"><p className="text-xs text-slate-500 mb-3">Contact support for billing assistance.</p><button onClick={() => { openSupportEmail('Subscription support') }} className="btn-secondary w-full justify-center"><Headphones size={14} /> Create Support Ticket</button></Card></div></div><Notice>Subscriptions are managed as company profile records and can be exported for review.</Notice></div>
}

function Toolbar({ title, sub, search, setSearch, filter, setFilter, add, addLabel, exportRows, exportLabel = 'Export' }: { title: string; sub: string; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; add: () => void; addLabel: string; exportRows: () => void; exportLabel?: string }) {
  return <Card title={title} sub={sub} action={<div className="flex flex-wrap gap-2"><SearchBox value={search} onChange={setSearch} /><select value={filter} onChange={event => setFilter(event.target.value)} className="input-field w-32"><option>All</option><option>Active</option><option>Inactive</option><option>Expired</option></select><button onClick={exportRows} className="btn-secondary"><Download size={14} /> {exportLabel}</button><button onClick={add} className="btn-primary bg-coop-blue"><Plus size={14} /> {addLabel}</button></div>}><div /></Card>
}

function Stats({ cards }: { cards: Array<[string, string | number, string]> }) {
  return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{cards.map(([label, value, sub], index) => <div key={label} className="stat-card"><div className={`stat-icon text-white ${['bg-coop-blue', 'bg-green-600', 'bg-purple-600', 'bg-orange-500'][index % 4]}`}>{index === 0 ? <Building2 size={20} /> : index === 1 ? <CheckCircle2 size={20} /> : index === 2 ? <MapPin size={20} /> : <Users size={20} />}</div><div><div className="text-xs font-semibold text-slate-500">{label}</div><div className="text-xl font-bold text-navy">{value}</div><div className="text-xs text-slate-500">{sub}</div></div></div>)}</div>
}

function Card({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="card border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3 mb-4"><div><h3 className="font-bold text-navy">{title}</h3>{sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}</div>{action}</div>{children}</section>
}

function Label({ children }: { children: ReactNode }) {
  return <span className="block text-xs font-bold text-navy mb-1.5">{children}</span>
}

function TextField({ label, value, onChange, disabled, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return <label className="block"><Label>{label}</Label><input type={type} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="input-field disabled:bg-slate-50 disabled:text-navy" /></label>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><Label>{label}</Label><select value={value} onChange={event => onChange(event.target.value)} className="input-field">{options.map(option => <option key={option}>{option}</option>)}</select></label>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><Label>{label}</Label><div className="flex items-center gap-2 input-field"><input type="color" value={value || '#0057FF'} onChange={event => onChange(event.target.value)} className="h-6 w-8 border-0 bg-transparent p-0" /><input value={value} onChange={event => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></div></label>
}

function LogoPanel({ profile, logoRef, onLogo }: { profile: CompanyProfileSettings; logoRef: RefObject<HTMLInputElement>; onLogo: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center"><div className="mx-auto flex h-28 w-28 items-center justify-center">{profile.logoDataUrl ? <img src={profile.logoDataUrl} alt={profile.companyName} className="max-h-28 max-w-28 object-contain" /> : <CoopLogo size={96} />}</div><button onClick={() => logoRef.current?.click()} className="btn-secondary mx-auto mt-3"><Upload size={14} /> Change Logo</button><input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogo} /><p className="mt-2 text-xs text-slate-500">JPG, PNG or SVG. Max 2MB</p></div>
}

function ImageBox({ title, image, fallback, onUpload, onClear }: { title: string; image: string; fallback: ReactNode; onUpload: () => void; onClear: () => void }) {
  return <div><Label>{title}</Label><div className="rounded-lg border border-slate-200 p-3 h-24 flex items-center justify-center">{image ? <img src={image} alt={title} className="max-h-20 object-contain" /> : fallback}</div><div className="mt-2 flex gap-2"><IconButton title="Upload" onClick={onUpload}><Upload size={13} /></IconButton><IconButton title="Clear" onClick={onClear} danger><Trash2 size={13} /></IconButton></div></div>
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex gap-3 py-2"><span className="h-9 w-9 rounded-lg bg-blue-50 text-coop-blue flex items-center justify-center">{icon}</span><div><div className="text-xs font-bold text-navy">{label}</div><div className="text-xs text-slate-600 whitespace-pre-line">{value || '-'}</div></div></div>
}

function MetricList({ rows }: { rows: Array<[string, string]> }) {
  return <div className="divide-y divide-slate-100">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-2 text-xs"><span className="text-slate-600">{label}</span><span className="font-bold text-navy text-right">{value}</span></div>)}</div>
}

function ActivityList({ rows }: { rows: Activity[] }) {
  if (!rows.length) return <Empty message="No activity yet." />
  return <div className="space-y-3">{rows.slice(0, 4).map(row => <div key={row.id} className="flex gap-3"><span className="h-8 w-8 rounded-full bg-green-50 text-green-700 flex items-center justify-center"><Edit size={14} /></span><div><div className="text-xs font-bold text-navy">{row.title}</div><div className="text-xs text-slate-500">{row.description}</div><div className="text-[11px] text-slate-400">{formatDate(row.at)} by {row.by}</div></div></div>)}</div>
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{headers.map(header => <th key={header} className="table-th">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-slate-100">{row.map((cell, cellIndex) => <td key={cellIndex} className="table-td">{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <Empty message="No records found." />}</div>
}

function Details({ rows }: { rows: Array<[string, string]> }) {
  if (!rows.length) return <Empty message="Select a record to view details." />
  return <div className="space-y-2">{rows.map(([label, value]) => <InfoRow key={label} icon={<Info size={14} />} label={label} value={value} />)}</div>
}

function Editable({ value, onChange, type = 'text' }: { value: string; onChange: (value: string) => void; type?: string }) {
  return <input type={type} value={value} onChange={event => onChange(event.target.value)} className="input-field min-w-[130px]" />
}

function StatusSelect({ value, onChange }: { value: 'Active' | 'Inactive' | 'Expired'; onChange: (value: 'Active' | 'Inactive') => void }) {
  return <select value={value} onChange={event => onChange(event.target.value as 'Active' | 'Inactive')} className="input-field min-w-[100px]"><option>Active</option><option>Inactive</option><option>Expired</option></select>
}

function RowActions({ onView, onDelete }: { onView: () => void; onDelete: () => void }) {
  return <div className="flex gap-1"><IconButton title="View" onClick={onView}><Eye size={13} /></IconButton><IconButton title="Delete" onClick={onDelete} danger><Trash2 size={13} /></IconButton><IconButton title="More" onClick={() => toast.success('Record actions are available')}><MoreVertical size={13} /></IconButton></div>
}

function IconButton({ title, onClick, children, danger }: { title: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return <button type="button" title={title} onClick={onClick} className={`h-8 w-8 rounded-lg border border-slate-200 grid place-items-center ${danger ? 'text-red-600 hover:bg-red-50' : 'text-coop-blue hover:bg-blue-50'}`}>{children}</button>
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={value} onChange={event => onChange(event.target.value)} className="input-field pl-9 w-56" placeholder="Search..." /></label>
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">{message}</div>
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 flex gap-3 text-sm text-navy"><Info size={18} className="text-coop-blue" /> <span>{children}</span></div>
}

function PrefCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <Card title={title} sub="Configure and save this preference group."><div className="flex items-center gap-2 mb-3 text-coop-blue">{icon}<span className="text-xs font-bold">{title}</span></div><div className="space-y-3">{children}</div></Card>
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3 text-xs font-semibold text-navy"><span>{label}</span><button onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-0.5 ${checked ? 'bg-coop-blue' : 'bg-slate-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} /></button></div>
}

function RadioField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div><Label>{label}</Label><RadioButtons value={value} options={options} onChange={onChange} /></div>
}

function RadioButtons({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <div className="flex gap-2">{options.map(option => <button key={option} onClick={() => onChange(option)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${value === option ? 'border-coop-blue text-coop-blue bg-blue-50' : 'border-slate-200 text-navy'}`}>{option}</button>)}</div>
}

function ColorChoices({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const colors = ['#0057FF', '#0B7A3D', '#6D28D9', '#F97316', '#DC2626', '#0EA5A4', '#64748B']
  return <div><Label>Primary Color</Label><div className="flex gap-2">{colors.map(color => <button key={color} onClick={() => onChange(color)} className={`h-8 w-8 rounded-lg border-2 ${value === color ? 'border-navy' : 'border-white'}`} style={{ backgroundColor: color }} />)}</div></div>
}

function SaveButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="btn-primary bg-coop-blue w-full justify-center mt-2"><Save size={14} /> Save Changes</button>
}

function SettingsIcon() {
  return <Filter size={18} />
}

function RefreshMini() {
  return <Clock size={14} />
}

