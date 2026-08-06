import { openSupportEmail } from '../../utils/support'
import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, Headphones, Info, KeyRound, Lock, Mail, ShieldCheck, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'

type Flow = 'current' | 'forgot'
type Step = 1 | 2 | 3

const tips = [
  ['Use a strong password', 'Use a mix of letters, numbers and symbols.'],
  ['Avoid common passwords', 'Do not use passwords that are easy to guess.'],
  ['Keep it private', 'Do not share your password with anyone.'],
  ['Change regularly', 'Update your password periodically for security.'],
]

function passwordChecks(password: string) {
  return [
    { label: 'At least 8 characters long', valid: password.length >= 8 },
    { label: 'Contains uppercase letter (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter (a-z)', valid: /[a-z]/.test(password) },
    { label: 'Contains number (0-9)', valid: /\d/.test(password) },
    { label: 'Contains special character', valid: /[^A-Za-z0-9]/.test(password) },
  ]
}

function formatDateTime(value?: string) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function PasswordReset() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const publicForgot = location.pathname === '/forgot-password'
  const initialEmail = (location.state as { email?: string } | null)?.email || user?.email || ''
  const [flow, setFlow] = useState<Flow>(publicForgot ? 'forgot' : 'current')
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState({ current: false, resetKey: false, next: false, confirm: false })
  const [changedAt, setChangedAt] = useState('')
  const [form, setForm] = useState({
    currentPassword: '',
    email: initialEmail,
    passwordResetKey: '',
    newPassword: '',
    confirmPassword: '',
  })

  const checks = useMemo(() => passwordChecks(form.newPassword), [form.newPassword])
  const score = checks.filter(check => check.valid).length
  const strong = score === checks.length
  const passwordsMatch = Boolean(form.confirmPassword) && form.newPassword === form.confirmPassword
  const nextRecommended = useMemo(() => {
    const date = changedAt ? new Date(changedAt) : new Date()
    date.setMonth(date.getMonth() + 3)
    return formatDateTime(date.toISOString())
  }, [changedAt])

  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))

  const startForgot = () => {
    setFlow('forgot')
    setStep(1)
    setForm(current => ({ ...current, email: user?.email || current.email, passwordResetKey: '' }))
  }

  const verifyResetKey = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.email.trim() || !form.passwordResetKey.trim()) {
      toast.error('Enter your registered email and Password Reset Key')
      return
    }
    setLoading(true)
    try {
      await authApi.verifyPasswordResetKey({ email: form.email.trim(), passwordResetKey: form.passwordResetKey.trim() })
      toast.success('Password Reset Key confirmed')
      setStep(2)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to verify Password Reset Key')
    } finally {
      setLoading(false)
    }
  }

  const reviewForgotReset = async (event: FormEvent) => {
    event.preventDefault()
    if (!strong || !passwordsMatch) {
      toast.error('Enter a strong matching password')
      return
    }
    setStep(3)
  }

  const completeForgotReset = async () => {
    setLoading(true)
    try {
      const result = await authApi.completePasswordReset({ email: form.email.trim(), passwordResetKey: form.passwordResetKey.trim(), newPassword: form.newPassword })
      setChangedAt(result.changedAt)
      toast.success('Password reset successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reset password')
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const completeCurrentReset = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.currentPassword) {
      toast.error('Enter your current password')
      return
    }
    if (!strong || !passwordsMatch) {
      toast.error('Enter a strong matching password')
      return
    }
    setLoading(true)
    try {
      await authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      setChangedAt(new Date().toISOString())
      setStep(3)
      toast.success('Password reset successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reset password')
    } finally {
      setLoading(false)
    }
  }

  const goToLogin = () => {
    logout()
    navigate('/login')
  }

  const openSupport = () => {
    const subject = encodeURIComponent('Password Reset Support')
    const body = encodeURIComponent(`User: ${user?.fullName || ''}\nEmail: ${user?.email || form.email}\n\nPlease help me reset my password.`)
    openSupportEmail(decodeURIComponent(subject), decodeURIComponent(body))
  }

  const resetPage = () => {
    setFlow('current')
    setStep(1)
    setChangedAt('')
    setForm({
      currentPassword: '',
      email: user?.email || initialEmail,
      passwordResetKey: '',
      newPassword: '',
      confirmPassword: '',
    })
  }

  const backFromForgot = () => {
    if (publicForgot) {
      navigate('/login')
      return
    }
    setFlow('current')
    setStep(1)
  }

  return (
    <div className="p-4 lg:p-5 max-w-[1500px] mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold text-navy">Password Reset</h2>
        <p className="text-sm text-slate-500 mt-1">Reset your account password to keep your account secure.</p>
      </div>

      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <button onClick={() => navigate(user ? '/profile' : '/login')} className="text-navy hover:underline">{user ? 'My Profile' : 'Login'}</button>
        <span>/</span>
        <button onClick={resetPage} className="text-navy hover:underline">Password Reset</button>
        {flow === 'forgot' && <><span>/</span><span>{step === 1 ? 'Forgot Password' : step === 2 ? 'Set New Password' : 'Confirm & Complete'}</span></>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)_340px] gap-4">
        <StepRail flow={flow} step={step} />

        <main className="card border border-slate-200 min-h-[620px]">
          {flow === 'current' && step !== 3 && (
            <form onSubmit={completeCurrentReset} className="divide-y divide-slate-100">
              <section className="p-5 space-y-4">
                <SectionTitle number={1} title="Verify Your Identity" sub="For your security, please enter your current password." />
                <PasswordField label="Current Password" value={form.currentPassword} show={show.current} onToggle={() => setShow(v => ({ ...v, current: !v.current }))} onChange={value => update('currentPassword', value)} />
                <button type="button" onClick={startForgot} className="text-xs font-bold text-coop-blue hover:underline">Forgot your current password?</button>
              </section>
              <PasswordInputs
                number={2}
                form={form}
                show={show}
                setShow={setShow}
                update={update}
                checks={checks}
                score={score}
                strong={strong}
                passwordsMatch={passwordsMatch}
              />
              <section className="p-5 space-y-4">
                <SectionTitle number={3} title="Confirm & Complete" sub="Please confirm your new password to update it." />
                <InfoBox />
                <div className="flex flex-wrap justify-end gap-3 pt-4">
                  <button type="button" onClick={resetPage} className="btn-secondary px-8">Cancel</button>
                  <button disabled={loading} className="btn-primary px-8"><Lock size={14} /> {loading ? 'Resetting...' : 'Reset Password'}</button>
                </div>
              </section>
            </form>
          )}

          {flow === 'forgot' && step === 1 && (
            <form onSubmit={verifyResetKey} className="p-5 space-y-5">
              <HeroIcon icon={<Lock size={24} />} title="Forgot Your Current Password?" sub="No problem. Enter your registered email and Password Reset Key to continue." />
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 flex gap-3"><Info size={18} /> Your Password Reset Key is set by an administrator on your user account. Contact support if you do not know your key.</div>
              <Field label="Registered Email Address" required>
                <div className="relative"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={form.email} onChange={e => update('email', e.target.value)} type="email" className="input-field pl-9 h-11" placeholder="Enter your registered email address" /></div>
              </Field>
              <Field label="Password Reset Key" required>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={form.passwordResetKey} onChange={e => update('passwordResetKey', e.target.value)} type={show.resetKey ? 'text' : 'password'} className="input-field pl-9 pr-10 h-11" placeholder="Enter Password Reset Key" />
                  <button type="button" onClick={() => setShow(v => ({ ...v, resetKey: !v.resetKey }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{show.resetKey ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>
              </Field>
              <button disabled={loading} className="btn-primary w-full justify-center h-11 text-sm"><KeyRound size={16} /> {loading ? 'Checking...' : 'Enter Password Reset Key'}</button>
              <button type="button" onClick={backFromForgot} className="btn-secondary"><ArrowLeft size={14} /> {publicForgot ? 'Back to Login' : 'Back to Password Reset'}</button>
            </form>
          )}

          {flow === 'forgot' && step === 2 && (
            <form onSubmit={reviewForgotReset} className="p-5 space-y-5">
              <HeroIcon icon={<Lock size={24} />} title="Set New Password" sub="Create a strong new password for your account." />
              <PasswordInputs form={form} show={show} setShow={setShow} update={update} checks={checks} score={score} strong={strong} passwordsMatch={passwordsMatch} />
              <div className="flex flex-wrap justify-between gap-3 pt-4">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary px-8"><ArrowLeft size={14} /> Back</button>
                <button disabled={loading} className="btn-primary px-8">{loading ? 'Checking...' : 'Continue'} <ArrowRight size={14} /></button>
              </div>
            </form>
          )}

          {((flow === 'forgot' && step === 3) || (flow === 'current' && step === 3)) && (
            <SuccessPanel userName={user?.fullName || 'User'} changedAt={changedAt} nextRecommended={nextRecommended} onComplete={flow === 'forgot' && !changedAt ? completeForgotReset : undefined} loading={loading} onLogin={goToLogin} onDashboard={user ? () => navigate('/dashboard') : undefined} />
          )}
        </main>

        <aside className="space-y-4">
          <TipsCard />
          <div className="card border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3"><Headphones className="text-coop-blue" /><h3 className="font-bold text-navy">Need Help?</h3></div>
            <p className="text-xs text-slate-600 leading-relaxed">If you are having trouble resetting your password, contact the system administrator.</p>
            <button onClick={openSupport} className="btn-secondary w-full justify-center"><Mail size={14} /> Contact Support</button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function StepRail({ flow, step }: { flow: Flow; step: Step }) {
  const rows = [
    ['Verify Identity', flow === 'forgot' ? 'Confirm your registered email' : 'Confirm your current password'],
    ['Set New Password', 'Create a strong new password'],
    ['Confirm & Complete', 'Confirm and update your password'],
  ]
  return <aside className="card border border-slate-200 p-4 space-y-2">{rows.map(([title, sub], index) => {
    const number = (index + 1) as Step
    const done = step > number
    const active = step === number
    return <div key={title} className={`relative flex gap-3 rounded-lg p-3 ${active ? 'bg-blue-50 border border-blue-100' : ''}`}>
      <div className={`h-10 w-10 rounded-full flex items-center justify-center border font-bold ${done ? 'bg-white text-coop-blue border-blue-200' : active ? 'bg-coop-blue text-white border-coop-blue' : 'bg-white text-navy border-slate-200'}`}>{done ? <Check size={18} /> : number}</div>
      <div><div className="text-xs text-coop-blue font-bold">Step {number}</div><div className="text-sm font-bold text-navy">{title}</div><div className="text-xs text-slate-500 mt-1">{sub}</div></div>
    </div>
  })}</aside>
}

function SectionTitle({ number, title, sub }: { number: number; title: string; sub: string }) {
  return <div className="flex items-start gap-3"><span className="h-7 w-7 rounded-full bg-coop-blue text-white flex items-center justify-center text-xs font-bold">{number}</span><div><h3 className="font-bold text-navy">{title}</h3><p className="text-sm text-slate-500">{sub}</p></div></div>
}

function HeroIcon({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return <div className="flex items-center gap-4"><div className="h-14 w-14 rounded-full bg-coop-blue text-white flex items-center justify-center">{icon}</div><div><h3 className="text-xl font-bold text-navy">{title}</h3><p className="text-sm text-slate-500">{sub}</p></div></div>
}

function PasswordInputs({ number, form, show, setShow, update, checks, score, strong, passwordsMatch }: any) {
  return <section className={number ? 'p-5 space-y-4' : 'space-y-4'}>
    {number && <SectionTitle number={number} title="Set New Password" sub="Create a new password for your account." />}
    <PasswordField label="New Password" value={form.newPassword} show={show.next} onToggle={() => setShow((v: any) => ({ ...v, next: !v.next }))} onChange={(value: string) => update('newPassword', value)} />
    <Strength score={score} strong={strong} />
    <div className="space-y-2">{checks.map((check: any) => <div key={check.label} className={`flex items-center gap-2 text-xs ${check.valid ? 'text-green-700' : 'text-slate-500'}`}>{check.valid ? <Check size={14} /> : <X size={14} />} {check.label}</div>)}</div>
    <PasswordField label="Confirm New Password" value={form.confirmPassword} show={show.confirm} onToggle={() => setShow((v: any) => ({ ...v, confirm: !v.confirm }))} onChange={(value: string) => update('confirmPassword', value)} />
    {form.confirmPassword && <div className={`text-xs font-bold ${passwordsMatch ? 'text-green-700' : 'text-red-600'}`}>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</div>}
    <InfoBox />
  </section>
}

function PasswordField({ label, value, show, onToggle, onChange }: { label: string; value: string; show: boolean; onToggle: () => void; onChange: (value: string) => void }) {
  return <Field label={label}><div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={value} onChange={e => onChange(e.target.value)} type={show ? 'text' : 'password'} className="input-field pl-9 pr-10 h-11" /><button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></Field>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block space-y-2"><span className="text-xs font-bold text-navy">{label}{required && <span className="text-red-500"> *</span>}</span>{children}</label>
}

function Strength({ score, strong }: { score: number; strong: boolean }) {
  return <div className="flex items-center gap-2"><div className="grid grid-cols-5 gap-2 flex-1">{[1, 2, 3, 4, 5].map(i => <span key={i} className={`h-1 rounded-full ${i <= score ? 'bg-green-500' : 'bg-slate-200'}`} />)}</div><span className={`text-xs font-bold ${strong ? 'text-green-700' : 'text-slate-500'}`}>{strong ? 'Strong' : 'Incomplete'}</span></div>
}

function InfoBox() {
  return <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 flex gap-3"><ShieldCheck size={18} /> <div><b>Make sure your new password is strong and unique.</b><br />Do not use easily guessed information such as your name or date of birth.</div></div>
}

function TipsCard() {
  return <div className="card border border-slate-200 p-5 space-y-5"><div className="flex items-center gap-3"><ShieldCheck className="text-coop-blue" /><h3 className="font-bold text-navy">Password Security Tips</h3></div>{tips.map(([title, sub]) => <div key={title} className="flex gap-3"><div className="h-9 w-9 rounded-full bg-blue-50 text-coop-blue flex items-center justify-center"><Lock size={15} /></div><div><div className="text-xs font-bold text-navy">{title}</div><p className="text-xs text-slate-500 mt-1">{sub}</p></div></div>)}</div>
}

function SuccessPanel({ userName, changedAt, nextRecommended, onComplete, loading, onLogin, onDashboard }: { userName: string; changedAt: string; nextRecommended: string; onComplete?: () => void; loading: boolean; onLogin: () => void; onDashboard?: () => void }) {
  return <section className="p-6 flex flex-col items-center text-center gap-5">
    <div className="h-20 w-20 rounded-full bg-green-500 text-white flex items-center justify-center"><CheckCircle2 size={42} /></div>
    <div><h3 className="text-2xl font-bold text-navy">Password Reset Successful!</h3><p className="text-sm text-slate-600 mt-2">Your password has been updated successfully.</p></div>
    {!changedAt && onComplete ? <button disabled={loading} onClick={onComplete} className="btn-primary px-8 h-11"><Lock size={15} /> {loading ? 'Completing...' : 'Confirm Password Reset'}</button> : <>
      <div className="w-full max-w-xl rounded-lg border border-slate-200 p-4 text-left">
        <h4 className="font-bold text-navy mb-3">Summary</h4>
        <Summary label="Password Changed" value={formatDateTime(changedAt)} />
        <Summary label="Changed By" value={userName} />
        <Summary label="Password Strength" value="Strong" badge />
        <Summary label="Next Recommended Change" value={nextRecommended} />
      </div>
      <div className="rounded-lg bg-green-50 border border-green-100 p-4 text-left text-sm text-green-900 w-full max-w-xl"><b>Your account is secure</b><br />You will be signed out of other devices for security. Please sign in again with your new password.</div>
      <div className="flex flex-col items-center gap-3 w-full max-w-md"><button onClick={onLogin} className="btn-primary w-full justify-center h-11"><Lock size={15} /> Go to Login <ArrowRight size={15} /></button>{onDashboard && <button onClick={onDashboard} className="text-xs font-bold text-coop-blue">Return to Dashboard <ArrowRight size={13} className="inline" /></button>}</div>
    </>}
  </section>
}

function Summary({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return <div className="flex items-center justify-between gap-3 border-t border-slate-100 py-3 first:border-t-0"><span className="text-xs font-bold text-navy">{label}</span>{badge ? <span className="badge bg-green-100 text-green-700">{value}</span> : <span className="text-xs font-bold text-coop-blue text-right">{value}</span>}</div>
}
