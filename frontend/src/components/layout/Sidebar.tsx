import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Users, Settings, FileText, BarChart3, Scale, Shield, MessageSquare, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { settingsApi } from '../../services/api'
import { canAccessAnyModule, canAccessModule, type PermissionModuleId } from '../../services/permissions'
import { useRolePermissions } from '../../hooks/useRolePermissions'
import CoopLogo from '../ui/CoopLogo'
import { applyBrowserBrandIcon, cacheCompanyBrand, readCachedCompanyBrand } from '../../utils/branding'

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
  { to: '/staff', icon: Users, label: 'Staff Management', module: 'staff' },
  { to: '/admin/users', icon: Users, label: 'User Management', module: 'user-management' },
  { to: '/accounts', icon: FileText, label: 'Accounts', module: 'accounts' },
  { to: '/trading', icon: BarChart3, label: 'Trading Account', module: 'trading' },
  { to: '/trial-balance', icon: Scale, label: 'Trial Balance', module: 'trial-balance' },
  { to: '/audit', icon: Shield, label: 'Audit', module: 'audit' },
  { to: '/reports', icon: FileText, label: 'Reports', module: 'reports' },
  { to: '/chat', icon: MessageSquare, label: 'Chat', module: 'chat' },
]

function profileSettingsScope(user?: { id?: string | number; employeeId?: string; email?: string } | null) {
  const raw = user?.id ?? user?.employeeId ?? user?.email ?? 'current'
  const key = String(raw).toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  return `my-profile-${key}`
}

export default function Sidebar() {
  const { user } = useAuthStore()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const [brand, setBrand] = useState(() => ({ companyName: 'Oshodi Isolo Excel Cooperative', logoDataUrl: '', faviconDataUrl: '', ...readCachedCompanyBrand() }))
  const [profilePhoto, setProfilePhoto] = useState('')
  const location = useLocation()
  useRolePermissions()

  const handleNavClick = () => { if (window.innerWidth < 1024) setSidebarOpen(false) }

  const isSettingsActive = location.pathname.startsWith('/settings')
  const isAdminActive = location.pathname.startsWith('/admin')
  const role = user?.role || 'staff'
  const canSettings = canAccessModule(role, 'settings')
  const canAdmin = canAccessAnyModule(role, ['settings', 'user-management', 'roles-permissions'])
  const visibleMainNav = mainNav.filter(item => canAccessModule(role, item.module as PermissionModuleId))
  const brandWords = brand.companyName.trim().split(/\s+/)
  const firstLine = brandWords.slice(0, 2).join(' ') || 'OSHODI ISOLO'
  const secondLine = brandWords.slice(2).join(' ') || 'EXCEL COOPERATIVE'
  const userPhoto = profilePhoto || user?.avatar
  const profileScope = profileSettingsScope(user)

  useEffect(() => {
    const loadBrand = async () => {
      try {
        const saved = await settingsApi.get<{ companyName: string; logoDataUrl: string }>('company-profile')
        cacheCompanyBrand(saved)
        setBrand(prev => ({ ...prev, ...saved }))
        applyBrowserBrandIcon(saved)
      } catch {
        // Keep default branding when profile settings are not available.
      }
    }
    const refreshBrand = (event: Event) => {
      const detail = (event as CustomEvent<Partial<typeof brand>>).detail
      if (detail) {
        cacheCompanyBrand(detail)
        setBrand(prev => ({ ...prev, ...detail }))
        applyBrowserBrandIcon(detail)
      }
      else loadBrand()
    }
    loadBrand()
    window.addEventListener('company-profile-updated', refreshBrand)
    return () => window.removeEventListener('company-profile-updated', refreshBrand)
  }, [])

  useEffect(() => {
    const loadPhoto = async () => {
      try {
        const saved = await settingsApi.get<{ photoDataUrl?: string }>(profileScope)
        setProfilePhoto(saved.photoDataUrl || '')
      } catch {
        setProfilePhoto('')
      }
    }
    const refreshPhoto = (event: Event) => {
      const detail = (event as CustomEvent<{ photoDataUrl?: string; scope?: string }>).detail
      if (detail && (!detail.scope || detail.scope === profileScope)) setProfilePhoto(detail.photoDataUrl || '')
      else loadPhoto()
    }
    loadPhoto()
    window.addEventListener('my-profile-updated', refreshPhoto)
    return () => window.removeEventListener('my-profile-updated', refreshPhoto)
  }, [profileScope])

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 h-full w-[210px] bg-green-700 z-30 flex flex-col transition-transform duration-250
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}>

        {/* Logo */}
        <div className="flex flex-col items-center pt-5 pb-3 px-4 border-b border-green-600 flex-shrink-0">
          <button className="lg:hidden absolute top-3 right-3 text-green-50 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
          {brand.logoDataUrl ? <img src={brand.logoDataUrl} alt="Company logo" className="w-16 h-16 object-contain" /> : <CoopLogo />}
          <div className="mt-2 text-center">
            <div className="text-gold font-bold text-xs leading-tight uppercase">{firstLine}</div>
            <div className="text-gold font-bold text-xs leading-tight uppercase">{secondLine}</div>
            <div className="text-green-50 text-xs mt-0.5">Management & Accounting System</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2.5 space-y-0.5">
          {/* Main nav items */}
          {visibleMainNav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
              onClick={handleNavClick}>
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}

          {canSettings && (
            <NavLink to="/settings"
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isSettingsActive ? 'text-white bg-white/15 ring-1 ring-white/30' : 'text-green-50 hover:text-white hover:bg-white/10'}`}
              onClick={handleNavClick}>
              <Settings size={16} />
              <span className="flex-1 text-left">Settings</span>
            </NavLink>
          )}

          {/* Admin section */}
          {canAdmin && <div className="pt-2">
            <div className="text-xs text-green-100 uppercase px-3 py-1 font-semibold tracking-wide">ADMIN</div>
            <NavLink to="/admin/dashboard" onClick={handleNavClick}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors mt-0.5 ${isAdminActive ? 'text-white bg-white/15 ring-1 ring-white/30' : 'text-green-50 hover:text-white hover:bg-white/10'}`}>
              <Shield size={16} />
              <span className="flex-1 text-left">Admin Panel</span>
            </NavLink>
          </div>}
        </nav>

        {/* User */}
        <div className="border-t border-green-600 p-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
              {userPhoto ? (
                <img src={userPhoto} alt={user?.fullName || 'Profile'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xs font-bold">
                  {user?.fullName?.split(' ').map(n => n[0]).join('') || 'A'}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">{user?.fullName || 'User'}</div>
              <div className="text-green-50 text-xs capitalize">{user?.role?.replace('_', ' ') || 'Staff'}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-green-100 text-xs">Online</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

