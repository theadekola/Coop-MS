import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, Mail, ChevronDown, LogOut, Settings, User, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { settingsApi } from '../../services/api'
import { canAccessAnyModule, canAccessModule } from '../../services/permissions'
import { useRolePermissions } from '../../hooks/useRolePermissions'

interface TopbarProps { title: string; showSearch?: boolean }

const searchRoutes = [
  { terms: ['add user', 'new user', 'register user'], path: '/admin/register-user' },
  { terms: ['user', 'employee', 'access'], path: '/admin/users' },
  { terms: ['staff'], path: '/staff' },
  { terms: ['account', 'transaction', 'cash', 'bank'], path: '/accounts' },
  { terms: ['trial', 'balance'], path: '/trial-balance' },
  { terms: ['report'], path: '/reports' },
  { terms: ['audit', 'log'], path: '/audit' },
  { terms: ['chat', 'message'], path: '/chat' },
  { terms: ['company', 'cooperative', 'organization', 'organisation'], path: '/settings/company-profile' },
  { terms: ['profile', 'account', 'personal'], path: '/profile' },
  { terms: ['password reset', 'change password', 'forgot password'], path: '/settings/password-reset' },
  { terms: ['setting', 'password'], path: '/settings' },
  { terms: ['approval', 'announcement', 'management'], path: '/management' },
]

function profileSettingsScope(user?: { id?: string | number; employeeId?: string; email?: string } | null) {
  const raw = user?.id ?? user?.employeeId ?? user?.email ?? 'current'
  const key = String(raw).toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  return `my-profile-${key}`
}

export default function Topbar({ title, showSearch = true }: TopbarProps) {
  const navigate = useNavigate()
  const { toggleSidebar, toggleSecondaryPanel, notificationCount, messageCount, setNotificationCount, setMessageCount } = useUIStore()
  const { user, logout } = useAuthStore()
  useRolePermissions()
  const [search, setSearch] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState('')

  const initials = user?.fullName?.split(' ').map(n => n[0]).join('') || 'U'
  const avatarSrc = profilePhoto || user?.avatar
  const profileScope = profileSettingsScope(user)
  const role = user?.role || 'staff'
  const canOpenSettings = canAccessModule(role, 'settings')
  const canOpenAdmin = canAccessAnyModule(role, ['settings', 'user-management', 'roles-permissions'])

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

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const term = search.trim().toLowerCase()
    if (!term) return
    const allowedRoutes = searchRoutes.filter(route => {
      if (route.path.startsWith('/settings')) return canOpenSettings || canOpenAdmin
      if (route.path.startsWith('/admin')) return canOpenAdmin
      return true
    })
    const match = allowedRoutes.find(route => route.terms.some(word => term.includes(word)))
    navigate(match?.path || '/dashboard')
    setSearch('')
  }

  const openMessages = () => {
    setMessageCount(0)
    navigate('/chat')
  }

  const openNotifications = () => {
    setNotificationsOpen(v => !v)
    setUserOpen(false)
  }

  const openHamburger = () => {
    setNotificationsOpen(false)
    setUserOpen(false)
    if (window.innerWidth < 1024) {
      toggleSidebar()
      return
    }
    toggleSecondaryPanel()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="relative">
          <button onClick={openHamburger} className="p-1.5 rounded-lg border border-transparent transition-colors hover:bg-gray-100 text-gray-500 lg:hidden">
            <Menu size={20} />
          </button>
          <button onClick={openHamburger} className="p-1.5 rounded-lg border border-transparent transition-colors hidden lg:flex hover:bg-gray-100 text-gray-500">
            <Menu size={20} />
          </button>
        </div>
        <h1 className="font-semibold text-gray-900 text-base">{title}</h1>
      </div>

      <div className="flex items-center gap-2 relative">
        {showSearch && (
          <form onSubmit={submitSearch} className="relative hidden md:flex items-center">
            <Search size={15} className="absolute left-3 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} type="text" placeholder="Search anything..."
              className="pl-9 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </form>
        )}

        <button onClick={openNotifications} className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
              {notificationCount}
            </span>
          )}
        </button>

        <button onClick={openMessages} className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <Mail size={18} />
          {messageCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
              {messageCount}
            </span>
          )}
        </button>

        <button onClick={() => { setUserOpen(v => !v); setNotificationsOpen(false) }} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-gray-100">
          <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center overflow-hidden">
            {avatarSrc ? (
              <img src={avatarSrc} alt={user?.fullName || 'Profile'} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xs font-bold">{initials}</span>
            )}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-gray-800 leading-tight">{user?.fullName || 'User'}</div>
            <div className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ') || 'Staff'}</div>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {notificationsOpen && (
          <div className="absolute right-16 top-12 w-80 bg-white border border-gray-100 rounded-xl shadow-lg p-3 z-50">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-gray-900 text-sm">Notifications</div>
              <button onClick={() => setNotificationCount(0)} className="text-xs text-coop-blue hover:underline">Mark all read</button>
            </div>
            <div className="p-3 text-sm text-gray-500">
              No notifications.
            </div>
          </div>
        )}

        {userOpen && (
          <div className="absolute right-0 top-12 w-56 bg-white border border-gray-100 rounded-xl shadow-lg p-2 z-50">
            <button onClick={() => { setUserOpen(false); navigate('/profile') }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <User size={15} /> Profile
            </button>
            {canOpenSettings && (
              <button onClick={() => { setUserOpen(false); navigate('/settings') }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                <Settings size={15} /> Settings
              </button>
            )}
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
              <LogOut size={15} /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
