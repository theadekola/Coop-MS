import { openSupportEmail } from '../../utils/support'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, BriefcaseBusiness, Calendar, Check, CheckCircle, Eye, EyeOff, HelpCircle, KeyRound, Mail, MapPin, Phone, Save, Shield, User, Users } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { staffApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import type { Staff, UserRole } from '../../types'

type Step = 1 | 2 | 3 | 4
type UserForm = {
  fullName: string
  email: string
  phone: string
  dateOfBirth: string
  gender: string
  nationality: string
  address: string
  department: string
  jobTitle: string
  employeeId: string
  employmentType: string
  dateOfEmployment: string
  supervisor: string
  branch: string
  notes: string
  role: UserRole
  username: string
  password: string
  confirmPassword: string
  passwordResetKey: string
  twoFactor: boolean
  forcePasswordChange: boolean
  accountExpiry: boolean
  loginRestriction: boolean
  sessionTimeout: string
  allowedDevices: string
  emailNotifications: boolean
  smsNotifications: boolean
}

const steps = [
  { n: 1 as Step, label: 'User Information', sub: 'Basic details about the user' },
  { n: 2 as Step, label: 'Role & Permissions', sub: 'Assign role and permissions' },
  { n: 3 as Step, label: 'Account & Security', sub: 'Set login and security options' },
  { n: 4 as Step, label: 'Review & Confirm', sub: 'Review details and create user' },
]

const roles: Array<{ name: string; value: UserRole; desc: string; permissions: string[]; denied: string[] }> = [
  { name: 'Staff', value: 'staff', desc: 'Standard staff access with limited permissions based on department.', permissions: ['Dashboard Access', 'Chat Access'], denied: ['User Management', 'System Settings'] },
  { name: 'Cashier', value: 'cashier', desc: 'Can post cash transactions and view account activity.', permissions: ['Dashboard Access', 'Accounts Access', 'Chat Access'], denied: ['User Management', 'System Settings'] },
  { name: 'Accountant', value: 'accountant', desc: 'Can manage transactions, accounts and reports.', permissions: ['Dashboard Access', 'Accounts Access', 'Reports Access', 'Trial Balance Access'], denied: ['User Management'] },
  { name: 'Auditor', value: 'auditor', desc: 'Can review audit logs, balances and reports.', permissions: ['Dashboard Access', 'Audit Access', 'Reports Access'], denied: ['User Management'] },
  { name: 'Manager', value: 'manager', desc: 'Can manage staff, approvals and announcements.', permissions: ['Dashboard Access', 'Staff Access', 'Management Access', 'Reports Access'], denied: ['System Settings'] },
  { name: 'Admin', value: 'admin', desc: 'Broad administrative access across the system.', permissions: ['Dashboard Access', 'User Management', 'System Settings', 'Reports Access'], denied: [] },
  { name: 'Super Admin', value: 'super_admin', desc: 'Full system control and configuration access.', permissions: ['Full Access', 'User Management', 'System Settings', 'Reports Access'], denied: [] },
]

const departments = ['Accounts', 'Audit', 'Cash Desk', 'HR', 'IT', 'Loans', 'Management', 'Operations', 'Trading', 'General']
const blankForm: UserForm = {
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  nationality: 'Nigerian',
  address: '',
  department: 'General',
  jobTitle: '',
  employeeId: '',
  employmentType: 'Full Time',
  dateOfEmployment: '',
  supervisor: '',
  branch: '',
  notes: '',
  role: 'staff',
  username: '',
  password: '',
  confirmPassword: '',
  passwordResetKey: '',
  twoFactor: false,
  forcePasswordChange: true,
  accountExpiry: false,
  loginRestriction: true,
  sessionTimeout: '60',
  allowedDevices: 'All Devices',
  emailNotifications: true,
  smsNotifications: false,
}

function fieldValue(user: Staff | undefined): UserForm {
  if (!user) return blankForm
  return {
    ...blankForm,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    department: user.department || 'General',
    employeeId: user.employeeId || '',
    role: user.role,
    username: user.employeeId || user.email.split('@')[0],
    twoFactor: user.twoFactorEnabled,
  }
}

export default function RegisterNewUser() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: currentUser } = useAuthStore()
  const editUser = (location.state as { editUser?: Staff } | null)?.editUser
  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [form, setForm] = useState<UserForm>(fieldValue(editUser))

  const assignableRoles = useMemo(() => currentUser?.role === 'super_admin' ? roles : roles.filter(role => role.value !== 'super_admin'), [currentUser?.role])
  const selectedRole = useMemo(() => assignableRoles.find(role => role.value === form.role) || assignableRoles[0], [assignableRoles, form.role])
  const canSave = form.fullName && form.email && form.phone && form.department && (editUser || (form.password.length >= 8 && form.password === form.confirmPassword && form.passwordResetKey.trim().length >= 4))
  const update = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (form.role === 'super_admin' && currentUser?.role !== 'super_admin') {
      update('role', 'admin')
    }
  }, [currentUser?.role, form.role])

  const next = () => {
    if (step === 1 && (!form.fullName || !form.email || !form.phone || !form.department || !form.jobTitle)) {
      toast.error('Complete required user and employment fields')
      return
    }
    if (step === 3 && !editUser && (form.password.length < 8 || form.password !== form.confirmPassword)) {
      toast.error('Password must be at least 8 characters and match confirmation')
      return
    }
    if (step === 3 && !editUser && form.passwordResetKey.trim().length < 4) {
      toast.error('Password Reset Key must be at least 4 characters')
      return
    }
    setStep(value => Math.min(4, value + 1) as Step)
  }

  const saveDraft = () => {
    localStorage.setItem('new-user-draft', JSON.stringify(form))
    toast.success('Draft saved on this browser')
  }

  const createUser = async () => {
    if (!canSave) {
      toast.error('Complete required fields before saving')
      return
    }
    try {
      setSaving(true)
      if (editUser) {
        await staffApi.update(editUser.id, { fullName: form.fullName, email: form.email, phone: form.phone, role: form.role, department: form.department, passwordResetKey: form.passwordResetKey || undefined })
        toast.success('User updated')
      } else {
        await staffApi.create({ fullName: form.fullName, email: form.email, phone: form.phone, role: form.role, department: form.department, password: form.password, passwordResetKey: form.passwordResetKey })
        toast.success('User account created')
      }
      navigate('/admin/users')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-full">
      <div>
        <h2 className="text-xl font-bold text-navy">{editUser ? 'Edit User' : 'Register New User'}</h2>
        <p className="text-sm text-navy/70 mt-1">User Management &gt; {editUser ? 'Edit User' : 'Register New User'}</p>
      </div>

      <section className="bg-white border-b border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {steps.map(item => (
            <button key={item.n} onClick={() => setStep(item.n)} className={`flex items-center gap-3 text-left border-b-2 pb-4 ${step === item.n ? 'border-coop-blue' : 'border-transparent'}`}>
              <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${step > item.n ? 'bg-green-50 border-green-500 text-green-700' : step === item.n ? 'bg-coop-blue border-coop-blue text-white' : 'bg-white border-slate-300 text-navy'}`}>{step > item.n ? <Check size={15} /> : item.n}</span>
              <span><span className="block text-sm font-bold text-navy">{item.label}</span><span className="block text-xs text-slate-500">{item.sub}</span></span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-5">
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          {step === 1 && (
            <div className="space-y-5">
              <Header title="User Information" sub="Enter the basic information of the new user." />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input icon={<User size={14} />} label="Full Name *" value={form.fullName} onChange={value => update('fullName', value)} placeholder="Enter full name" />
                <Input icon={<Mail size={14} />} label="Email Address *" value={form.email} onChange={value => { update('email', value); if (!form.username) update('username', value.split('@')[0]) }} placeholder="Enter email address" />
                <Input icon={<Phone size={14} />} label="Phone Number *" value={form.phone} onChange={value => update('phone', value)} placeholder="Enter phone number" />
                <Input icon={<Calendar size={14} />} type="date" label="Date of Birth" value={form.dateOfBirth} onChange={value => update('dateOfBirth', value)} />
                <Select label="Gender" value={form.gender} onChange={value => update('gender', value)} options={['', 'Male', 'Female']} />
                <Select label="Nationality" value={form.nationality} onChange={value => update('nationality', value)} options={['Nigerian', 'Ghanaian', 'Other']} />
                <div className="md:col-span-3"><Input icon={<MapPin size={14} />} label="Residential Address" value={form.address} onChange={value => update('address', value)} placeholder="Enter residential address" /></div>
              </div>
              <Header title="Employment Information" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select label="Department / Unit *" value={form.department} onChange={value => update('department', value)} options={departments} />
                <Input icon={<BriefcaseBusiness size={14} />} label="Job Title / Position *" value={form.jobTitle} onChange={value => update('jobTitle', value)} placeholder="Enter job title or position" />
                <Input label="Employee ID (Optional)" value={form.employeeId} onChange={value => update('employeeId', value)} placeholder="Enter employee ID" />
                <Select label="Employment Type" value={form.employmentType} onChange={value => update('employmentType', value)} options={['Full Time', 'Part Time', 'Contract', 'Temporary']} />
                <Input type="date" icon={<Calendar size={14} />} label="Date of Employment" value={form.dateOfEmployment} onChange={value => update('dateOfEmployment', value)} />
              </div>
              <Header title="Additional Information (Optional)" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Supervisor / Reporting To" value={form.supervisor} onChange={value => update('supervisor', value)} placeholder="Select supervisor" />
                <Input label="Work Location / Branch" value={form.branch} onChange={value => update('branch', value)} placeholder="Select branch or location" />
                <label className="block"><span className="block text-xs font-bold text-navy mb-1">Notes</span><textarea value={form.notes} onChange={e => update('notes', e.target.value)} className="input-field min-h-24" placeholder="Add any additional notes..." /></label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <Header title="Role & Permissions" sub="Select the role this user should have in the system." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignableRoles.map(role => (
                  <button key={role.value} onClick={() => update('role', role.value)} className={`text-left border rounded-xl p-4 ${form.role === role.value ? 'border-coop-blue bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-3"><div className="font-bold text-navy">{role.name}</div><span className={`w-5 h-5 rounded-full border flex items-center justify-center ${form.role === role.value ? 'bg-coop-blue border-coop-blue' : 'border-slate-300'}`}>{form.role === role.value && <span className="w-2 h-2 bg-white rounded-full" />}</span></div>
                    <p className="text-sm text-slate-500 mt-2">{role.desc}</p>
                    <div className="flex flex-wrap gap-2 mt-3">{role.permissions.map(item => <Badge key={item} label={item} variant="green" />)}{role.denied.map(item => <Badge key={item} label={item} variant="red" />)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <Header title="Account & Security" sub="Configure login credentials and security preferences for the new user." />
              <div className="border border-slate-100 rounded-xl p-4">
                <h3 className="font-bold text-navy mb-4">Login Credentials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input icon={<User size={14} />} label="Username *" value={form.username} onChange={value => update('username', value)} placeholder="Enter username" />
                  <Input icon={<Mail size={14} />} label="Email Address *" value={form.email} onChange={value => update('email', value)} />
                  {!editUser && <Password label="Password *" value={form.password} visible={showPass} onToggle={() => setShowPass(v => !v)} onChange={value => update('password', value)} />}
                  {!editUser && <Password label="Confirm Password *" value={form.confirmPassword} visible={showConfirmPass} onToggle={() => setShowConfirmPass(v => !v)} onChange={value => update('confirmPassword', value)} />}
                  <Input icon={<KeyRound size={14} />} label="Password Reset Key *" value={form.passwordResetKey} onChange={value => update('passwordResetKey', value)} placeholder="Enter Password Reset Key" />
                </div>
              </div>
              <div className="border border-slate-100 rounded-xl p-4">
                <h3 className="font-bold text-navy mb-4">Security Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Toggle label="Two-Factor Authentication (2FA)" sub="Require 2FA code during login." value={form.twoFactor} onChange={value => update('twoFactor', value)} />
                  <Toggle label="Force Password Change" sub="User must change password on first login." value={form.forcePasswordChange} onChange={value => update('forcePasswordChange', value)} />
                  <Toggle label="Account Expiry" sub="Set an optional expiry date for this account." value={form.accountExpiry} onChange={value => update('accountExpiry', value)} />
                  <Toggle label="Login Attempt Restriction" sub="Lock after failed login attempts." value={form.loginRestriction} onChange={value => update('loginRestriction', value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Session Timeout (Minutes) *" value={form.sessionTimeout} onChange={value => update('sessionTimeout', value)} options={['30', '60', '120']} />
                <Select label="Allowed Devices" value={form.allowedDevices} onChange={value => update('allowedDevices', value)} options={['All Devices', 'Office Devices Only']} />
              </div>
              <div className="border border-slate-100 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Toggle label="Email Notifications" sub="Send alerts via email." value={form.emailNotifications} onChange={value => update('emailNotifications', value)} />
                <Toggle label="SMS Notifications" sub="Send important alerts via SMS." value={form.smsNotifications} onChange={value => update('smsNotifications', value)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <Header title="Review & Confirm" sub="Please review all details below before creating the new user account." />
              <ReviewBlock title="User Information" onEdit={() => setStep(1)} rows={[['Full Name', form.fullName], ['Email Address', form.email], ['Phone Number', form.phone], ['Date of Birth', form.dateOfBirth || '-'], ['Gender', form.gender || '-'], ['Nationality', form.nationality], ['Residential Address', form.address || '-']]} />
              <ReviewBlock title="Employment Information" onEdit={() => setStep(1)} rows={[['Department / Unit', form.department], ['Job Title / Position', form.jobTitle], ['Employee ID', form.employeeId || '-'], ['Employment Type', form.employmentType], ['Date of Employment', form.dateOfEmployment || '-'], ['Work Location / Branch', form.branch || '-'], ['Reporting To', form.supervisor || '-']]} />
              <ReviewBlock title="Account & Security" onEdit={() => setStep(3)} rows={[['Username', form.username], ['Login Method', 'Email'], ['Password Reset Key', form.passwordResetKey ? 'Set' : 'Not set'], ['Two-Factor Authentication (2FA)', form.twoFactor ? 'Enabled' : 'Disabled'], ['Force Password Change', form.forcePasswordChange ? 'Enabled' : 'Disabled'], ['Session Timeout', `${form.sessionTimeout} Minutes`], ['Login Attempt Restriction', form.loginRestriction ? 'Enabled' : 'Disabled'], ['Allowed Devices', form.allowedDevices], ['Email Notifications', form.emailNotifications ? 'Enabled' : 'Disabled'], ['SMS Notifications', form.smsNotifications ? 'Enabled' : 'Disabled']]} />
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
            {step > 1 ? <button onClick={() => setStep(value => (value - 1) as Step)} className="btn-secondary">Back</button> : <button onClick={() => navigate('/admin/users')} className="btn-secondary">Cancel</button>}
            {step < 4 ? <button onClick={next} className="btn-primary bg-coop-blue">Next: {steps[step]?.label} <ArrowRight size={14} /></button> : <div className="flex gap-3"><button onClick={saveDraft} className="btn-secondary"><Save size={14} /> Save as Draft</button><button onClick={createUser} disabled={saving || !canSave} className="btn-primary bg-coop-blue disabled:opacity-60"><Users size={14} /> {editUser ? 'Save User Account' : 'Create User Account'} <ArrowRight size={14} /></button></div>}
          </div>
        </section>

        <aside className="space-y-5">
          <Panel title="Selected Role">
            <div className="flex gap-4">
              <span className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center"><Shield size={22} className="text-green-700" /></span>
              <div><h3 className="font-bold text-navy">{selectedRole.name}</h3><p className="text-sm text-navy/80 mt-1">{selectedRole.desc}</p><button onClick={() => setStep(2)} className="btn-secondary mt-4"><KeyRound size={14} /> Change Role</button></div>
            </div>
          </Panel>
          <Panel title={step === 4 ? 'Selected Role & Permissions' : 'Permissions Summary'}>
            <div className="space-y-3">{selectedRole.permissions.map(item => <Perm key={item} good label={item} />)}{selectedRole.denied.map(item => <Perm key={item} label={item} />)}</div>
          </Panel>
          <Panel title="Need Help?">
            <p className="text-sm text-navy/80">Contact the system administrator for assistance.</p>
            <button onClick={() => { openSupportEmail('User registration support') }} className="btn-secondary mt-4"><HelpCircle size={14} /> Contact Support</button>
          </Panel>
        </aside>
      </div>

      <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">&copy; {new Date().getFullYear()} Oshodi Isolo Excel Cooperative. All rights reserved.</footer>
    </div>
  )
}

function Header({ title, sub }: { title: string; sub?: string }) {
  return <div><h3 className="font-bold text-navy">{title}</h3>{sub && <p className="text-sm text-navy/80 mt-1">{sub}</p>}</div>
}

function Input({ label, value, onChange, placeholder, type = 'text', icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; icon?: ReactNode }) {
  return <label className="block"><span className="block text-xs font-bold text-navy mb-1.5">{label}</span><span className="relative block">{icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}<input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`input-field ${icon ? 'pl-9' : ''}`} /></span></label>
}

function Password({ label, value, visible, onToggle, onChange }: { label: string; value: string; visible: boolean; onToggle: () => void; onChange: (value: string) => void }) {
  return <label className="block"><span className="block text-xs font-bold text-navy mb-1.5">{label}</span><span className="relative block"><Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} className="input-field pl-9 pr-9" /><button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{visible ? <EyeOff size={14} /> : <Eye size={14} />}</button></span></label>
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block"><span className="block text-xs font-bold text-navy mb-1.5">{label}</span><select value={value} onChange={e => onChange(e.target.value)} className="input-field">{options.map(option => <option key={option} value={option}>{option || 'Select'}</option>)}</select></label>
}

function Toggle({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4"><div><div className="font-bold text-navy text-sm">{label}</div><div className="text-xs text-slate-500 mt-1">{sub}</div></div><button onClick={() => onChange(!value)} className={`w-11 h-6 rounded-full p-1 transition-colors ${value ? 'bg-coop-blue' : 'bg-slate-300'}`}><span className={`block w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} /></button></div>
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5"><h3 className="font-bold text-navy mb-4">{title}</h3>{children}</section>
}

function Perm({ good, label }: { good?: boolean; label: string }) {
  return <div className="flex gap-3 border-b border-slate-100 pb-3 last:border-0"><CheckCircle size={16} className={good ? 'text-green-600' : 'text-red-600'} /><span><span className="block text-sm font-bold text-navy">{label}</span><span className="text-xs text-slate-500">{good ? 'Allowed' : 'No access'}</span></span></div>
}

function ReviewBlock({ title, rows, onEdit }: { title: string; rows: string[][]; onEdit: () => void }) {
  return <div className="border border-slate-200 rounded-xl"><div className="flex items-center justify-between p-4 border-b border-slate-100"><h3 className="font-bold text-navy">{title}</h3><button onClick={onEdit} className="btn-secondary !py-1.5"><KeyRound size={13} /> Edit</button></div><div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">{rows.map(([label, value]) => <div key={label} className="text-sm"><span className="font-bold text-navy block">{label}</span><span className="text-navy/80">{value}</span></div>)}</div></div>
}
