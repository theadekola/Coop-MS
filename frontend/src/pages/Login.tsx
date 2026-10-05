import { openSupportEmail } from '../utils/support'
﻿import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Shield, BarChart2, Users, Clock, Eye, EyeOff, Globe, Mail, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import CoopLogo from '../components/ui/CoopLogo'
import { authApi, settingsApi } from '../services/api'
import { applyBrowserBrandIcon, cacheCompanyBrand, readCachedCompanyBrand } from '../utils/branding'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [form, setForm] = useState({ emailOrUsername: '', password: '', rememberMe: true })
  const [language, setLanguage] = useState<'en' | 'yo'>('en')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [supportModal, setSupportModal] = useState<'password' | 'support' | null>(null)
  const [supportForm, setSupportForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [brand, setBrand] = useState(() => ({ companyName: 'Oshodi Isolo Excel Cooperative', logoDataUrl: '', faviconDataUrl: '', ...readCachedCompanyBrand() }))

  const text = {
    en: {
      welcome: 'Welcome Back!',
      intro: 'Please sign in to your account to continue managing the cooperative efficiently.',
      secureTitle: 'Secure & Reliable',
      secureDesc: 'Your data is protected with enterprise grade security.',
      insightsTitle: 'Real-time Insights',
      insightsDesc: 'Access real-time reports and analytics anytime, anywhere.',
      accessTitle: 'Role-based Access',
      accessDesc: 'Granular permissions for better control and accountability.',
      auditTitle: 'Audit & Compliance',
      auditDesc: 'Maintain transparency with complete audit trails and logs.',
      signInTitle: 'Sign in to your account',
      signInSub: 'Enter your credentials to access the system',
      username: 'Username or Email',
      usernamePlaceholder: 'Enter your username or email',
      password: 'Password',
      passwordPlaceholder: 'Enter your password',
      remember: 'Remember me',
      forgot: 'Forgot Password?',
      signIn: 'Sign In',
      signingIn: 'Signing in...',
      needHelp: 'Need help?',
      helpText: 'Contact the system administrator for assistance.',
      contact: 'Contact Support',
      secureSystem: 'Secure System',
      rights: 'Oshodi Isolo Excel Cooperative. All rights reserved.',
    },
    yo: {
      welcome: 'E kaabo pada!',
      intro: 'Wo ile ise re lati maa dari eto cooperative naa daradara.',
      secureTitle: 'Aabo to daju',
      secureDesc: 'A n daabo bo data yin pelu aabo to lagbara.',
      insightsTitle: 'Iroyin akoko gidi',
      insightsDesc: 'Wo awon iroyin ati itupaláº¹ nigbakugba.',
      accessTitle: 'Ipo ati igbanilaaye',
      accessDesc: 'Iá¹£akoso iraye fun ojuse ati aabo to dara.',
      auditTitle: 'Ayewo ati ibamu',
      auditDesc: 'Pa akosile ayipada ati ise gbogbo mo.',
      signInTitle: 'Wo inu akanti re',
      signInSub: 'Te alaye iwole re lati lo eto naa',
      username: 'Oruko olumulo tabi Email',
      usernamePlaceholder: 'Te oruko olumulo tabi email',
      password: 'Oroigbaniwole',
      passwordPlaceholder: 'Te oroigbaniwole re',
      remember: 'Ranti mi',
      forgot: 'Gbagbe oroigbaniwole?',
      signIn: 'Wo le',
      signingIn: 'N wo le...',
      needHelp: 'Nilo iranlowo?',
      helpText: 'Kan si oludari eto fun iranlowo.',
      contact: 'Kan si Iranlowo',
      secureSystem: 'Eto aabo',
      rights: 'Oshodi Isolo Excel Cooperative. Gbogbo eto wa ni ipamá».',
    },
  }[language]

  const companyName = brand.companyName.trim() || 'Oshodi Isolo Excel Cooperative'
  const companyNameParts = companyName.toUpperCase().split(/\s+/)
  const companyFirstLine = companyNameParts.slice(0, 2).join(' ') || 'OSHODI ISOLO'
  const companySecondLine = companyNameParts.slice(2).join(' ') || 'EXCEL COOPERATIVE'
  const footerText = `(c) 2026 ${companyName}. All rights reserved.`

  useEffect(() => {
    if (sessionStorage.getItem('auth-session-expired')) {
      sessionStorage.removeItem('auth-session-expired')
      toast.error('Your session has expired. Please sign in again.')
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const cachedBrand = readCachedCompanyBrand()
    applyBrowserBrandIcon(cachedBrand)

    const applyBrand = (next: Partial<typeof brand>) => {
      if (!mounted) return
      setBrand(prev => ({
        companyName: next.companyName || prev.companyName,
        logoDataUrl: next.logoDataUrl ?? prev.logoDataUrl,
        faviconDataUrl: next.faviconDataUrl ?? prev.faviconDataUrl,
      }))
    }

    const refreshBrand = async () => {
      try {
        const saved = await settingsApi.get<{ companyName?: string; logoDataUrl?: string; faviconDataUrl?: string }>('company-profile')
        cacheCompanyBrand(saved)
        applyBrand(saved)
        applyBrowserBrandIcon(saved)
      } catch {
        applyBrand({})
      }
    }

    const handleBrandUpdated = (event: Event) => {
      const detail = (event as CustomEvent<Partial<typeof brand>>).detail || {}
      cacheCompanyBrand(detail)
      applyBrand(detail)
      applyBrowserBrandIcon(detail)
    }

    refreshBrand()
    window.addEventListener('company-profile-updated', handleBrandUpdated)

    return () => {
      mounted = false
      window.removeEventListener('company-profile-updated', handleBrandUpdated)
    }
  }, [])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await authApi.login(form.emailOrUsername, form.password)
      if (result.token && result.user) {
        login(result.token, result.user)
        navigate('/dashboard')
        toast.success('Signed in successfully')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  const openMail = (mode: 'password' | 'support') => {
    const subject = mode === 'password' ? 'Password Reset Request' : 'Oshodi Coop Support Request'
    const email = supportForm.email || form.emailOrUsername
    const body = [
      `Name: ${supportForm.name || '-'}`,
      `Email/User: ${email || '-'}`,
      `Phone: ${supportForm.phone || '-'}`,
      '',
      supportForm.message || (mode === 'password' ? 'Please help me reset my password.' : 'Please help me with the system.'),
    ].join('\n')
    if (!openSupportEmail(subject, body)) return
    toast.success('Opening your email app')
    setSupportModal(null)
  }

  const features = [
    { icon: Shield, title: text.secureTitle, desc: text.secureDesc },
    { icon: BarChart2, title: text.insightsTitle, desc: text.insightsDesc },
    { icon: Users, title: text.accessTitle, desc: text.accessDesc },
    { icon: Clock, title: text.auditTitle, desc: text.auditDesc },
  ]

  return (
    <div className="min-h-screen flex bg-gray-50">
      <div className="hidden lg:flex lg:w-[42%] relative bg-green-700 flex-col justify-between p-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-green-800 to-green-700" />
        <div className="absolute bottom-0 right-0 w-64 h-64 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #F5A623 0%, transparent 70%)' }} />
        <div className="relative z-10">
          <div className="flex flex-col items-start gap-3 mb-8">
            {brand.logoDataUrl ? (
              <img src={brand.logoDataUrl} alt={companyName} className="w-[60px] h-[60px] rounded-full object-cover bg-white" />
            ) : (
              <CoopLogo size={60} />
            )}
            <div>
              <div className="text-white font-bold text-xl leading-tight">{companyFirstLine}</div>
              <div className="text-gold font-bold text-xl leading-tight">{companySecondLine}</div>
              <div className="text-green-50 text-sm mt-1">Management & Accounting System</div>
              <div className="w-12 h-0.5 bg-gold mt-3" />
            </div>
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">{text.welcome}</h2>
          <p className="text-green-50 text-sm mb-8 leading-relaxed">
            {text.intro}
          </p>
          <div className="space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-gold" />
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">{title}</div>
                  <div className="text-green-50 text-xs mt-0.5 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-green-50/90 text-xs">
          <div>{footerText}</div>
          <div className="mt-1">Powered by AAT-Tech Ltd</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-14 flex items-center justify-end px-6">
          <div className="relative">
            <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select value={language} onChange={e => setLanguage(e.target.value as 'en' | 'yo')}
              className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-coop-green">
              <option value="en">English</option>
              <option value="yo">Yoruba</option>
            </select>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-[420px]">
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Users size={28} className="text-navy" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">{text.signInTitle}</h1>
              <p className="text-slate-500 text-sm mt-1">{text.signInSub}</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{text.username}</label>
                <div className="relative">
                  <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={form.emailOrUsername} onChange={e => setForm(f => ({ ...f, emailOrUsername: e.target.value }))}
                    placeholder={text.usernamePlaceholder}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-coop-green" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{text.password}</label>
                <div className="relative">
                  <Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={text.passwordPlaceholder}
                    className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600/30 focus:border-coop-green" />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.rememberMe} onChange={e => setForm(f => ({ ...f, rememberMe: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 accent-coop-green" />
                  <span className="text-sm text-slate-600">{text.remember}</span>
                </label>
                <button type="button" onClick={() => navigate('/forgot-password', { state: { email: form.emailOrUsername } })} className="text-sm text-coop-green font-medium hover:underline">{text.forgot}</button>
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-coop-green hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-70">
                <Shield size={15} />
                {loading ? text.signingIn : text.signIn}
              </button>
            </form>
            <div className="mt-6 p-4 bg-blue-50 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-coop-green flex items-center justify-center flex-shrink-0">
                <Users size={15} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-700">{text.needHelp}</div>
                <div className="text-xs text-slate-500">{text.helpText}</div>
              </div>
              <button onClick={() => setSupportModal('support')} className="text-coop-green text-xs font-semibold whitespace-nowrap">{text.contact}</button>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center px-8 py-4 text-xs text-slate-400 border-t border-slate-100">
          <span>{footerText} Powered by AAT-Tech Ltd</span>
          <div className="flex items-center gap-1"><Shield size={12} /> {text.secureSystem}</div>
        </div>
      </div>

      {supportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{supportModal === 'password' ? 'Password reset request' : 'Contact support'}</h3>
                <p className="text-xs text-slate-500">This will prepare an email to the support team.</p>
              </div>
              <button onClick={() => setSupportModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <input value={supportForm.name} onChange={e => setSupportForm(prev => ({ ...prev, name: e.target.value }))}
                className="input-field" placeholder="Full name" />
              <input value={supportForm.email} onChange={e => setSupportForm(prev => ({ ...prev, email: e.target.value }))}
                className="input-field" placeholder="Email or username" />
              <input value={supportForm.phone} onChange={e => setSupportForm(prev => ({ ...prev, phone: e.target.value }))}
                className="input-field" placeholder="Phone number" />
              <textarea value={supportForm.message} onChange={e => setSupportForm(prev => ({ ...prev, message: e.target.value }))}
                className="input-field min-h-24 resize-none" placeholder={supportModal === 'password' ? 'Describe the account you need reset' : 'How can support help?'} />
              <button onClick={() => openMail(supportModal)} className="w-full btn-primary justify-center">
                <Mail size={15} /> Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

