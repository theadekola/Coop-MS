import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff, CheckCircle, Shield, Users, BarChart2, Lock } from 'lucide-react'
import CoopLogo from '../../components/ui/CoopLogo'
import { authApi } from '../../services/api'

export default function AdminRegistration() {
  const navigate = useNavigate()
  const [showPass, setShowPass] = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [agree, setAgree] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'admin' as 'admin' | 'super_admin',
    password: '',
    confirmPassword: '',
  })

  const passChecks = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(form.password) },
    { label: 'One number', ok: /\d/.test(form.password) },
    { label: 'One special character', ok: /[!@#$%^&*]/.test(form.password) },
    { label: 'Passwords match', ok: form.password.length > 0 && form.password === form.confirmPassword },
  ]

  const features = [
    { icon: Shield, title: 'Secure Access', desc: 'Role-based access and permission control.' },
    { icon: Users, title: 'Full Control', desc: 'Manage users, accounts, reports and system settings.' },
    { icon: BarChart2, title: 'Live Reports', desc: 'Use live data for operational decisions.' },
    { icon: Lock, title: 'Data Protection', desc: 'Passwords are encrypted before saving.' },
  ]

  const update = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const createAdmin = async () => {
    if (!agree) {
      toast.error('Accept the terms before creating the account')
      return
    }
    if (!form.fullName || !form.email || !form.phone) {
      toast.error('Full name, email and phone are required')
      return
    }
    if (passChecks.some(check => !check.ok)) {
      toast.error('Complete the password requirements')
      return
    }

    try {
      setSaving(true)
      await authApi.registerAdmin({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
      })
      toast.success('Admin account created. You can sign in now.')
      navigate('/login')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create admin account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <div className="hidden lg:flex lg:w-[38%] bg-navy flex-col justify-between p-10">
        <div>
          <div className="flex flex-col items-start gap-3 mb-8">
            <CoopLogo size={56} />
            <div>
              <div className="text-white font-bold text-xl">OSHODI ISOLO</div>
              <div className="text-gold font-bold text-xl">EXCEL COOPERATIVE</div>
              <div className="text-slate-400 text-sm mt-0.5">Management & Accounting System</div>
              <div className="w-10 h-0.5 bg-gold mt-3" />
            </div>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Create Admin Account</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Create the first administrator account, or enable additional admin registration from the backend environment.
          </p>
          <div className="space-y-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><Icon size={18} className="text-gold" /></div>
                <div>
                  <div className="text-white text-sm font-semibold">{title}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white/10 rounded-xl p-4 text-slate-300 text-xs">
          After the first admin exists, set `ENABLE_ADMIN_REGISTRATION=true` on the backend only when you intentionally want to allow more public admin creation.
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center"><Users size={16} className="text-navy" /></div>
            <div>
              <div className="font-semibold text-slate-800">Admin Registration</div>
              <div className="text-xs text-slate-400">Create a real administrator account.</div>
            </div>
          </div>
          <button onClick={() => navigate('/login')} className="text-sm text-navy font-medium hover:underline">Back to Login</button>
        </div>

        <div className="flex-1 p-6 max-w-2xl w-full mx-auto">
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">1</div>
                <span className="font-semibold text-slate-800">Admin Information</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Full Name" value={form.fullName} onChange={value => update('fullName', value)} />
                <Field label="Email Address" type="email" value={form.email} onChange={value => update('email', value)} />
                <Field label="Phone Number" type="tel" value={form.phone} onChange={value => update('phone', value)} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">2</div>
                <span className="font-semibold text-slate-800">Account Security</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Role</label>
                  <select value={form.role} onChange={e => update('role', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <PasswordField label="Password" visible={showPass} onToggle={() => setShowPass(v => !v)} value={form.password} onChange={value => update('password', value)} />
                <PasswordField label="Confirm Password" visible={showConfirmPass} onToggle={() => setShowConfirmPass(v => !v)} value={form.confirmPassword} onChange={value => update('confirmPassword', value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {passChecks.map(check => (
                  <div key={check.label} className={`flex items-center gap-1.5 text-xs ${check.ok ? 'text-green-600' : 'text-slate-400'}`}>
                    <CheckCircle size={12} className={check.ok ? 'text-green-500' : 'text-slate-300'} />{check.label}
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3">
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="w-4 h-4 mt-0.5 accent-navy rounded" />
              <span className="text-xs text-slate-600">
                I confirm this account should have administrator access to Oshodi Isolo Excel Cooperative.
              </span>
            </label>

            <div className="flex items-center justify-between">
              <button onClick={() => navigate('/login')} className="border border-slate-200 text-slate-600 text-sm px-6 py-2.5 rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={createAdmin} disabled={!agree || saving}
                className="flex items-center gap-2 bg-navy text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-navy-dark disabled:opacity-50 disabled:cursor-not-allowed">
                <Users size={15} /> {saving ? 'Creating...' : 'Create Admin Account'}
              </button>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Lock size={11} className="text-green-500" /> Passwords are encrypted before storage.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20" />
    </div>
  )
}

function PasswordField({ label, visible, onToggle, value, onChange }: { label: string; visible: boolean; onToggle: () => void; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <div className="relative">
        <input type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 pr-9 py-2.5 text-sm focus:outline-none" />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{visible ? <EyeOff size={14} /> : <Eye size={14} />}</button>
      </div>
    </div>
  )
}
