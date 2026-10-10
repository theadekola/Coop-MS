import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState, User } from '../types'

interface AuthActions {
  login: (token: string, user: User) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  setRequires2FA: (requires: boolean, userId?: number) => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set,get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      requires2FA: false,
      tempUserId: undefined,

      login: (token, user) => set({ token, user, isAuthenticated: true, requires2FA: false }),
      logout: () => {
        const token=get().token
        if(token) void fetch('/api/auth/logout',{method:'POST',credentials:'include',headers:{Authorization:`Bearer ${token}`}}).catch(()=>{})
        void caches.delete('oshodi-coop-api').catch(()=>{})
        localStorage.removeItem('auth-storage')
        set({ user: null, token: null, isAuthenticated: false, requires2FA: false })
      },
      setLoading: (isLoading) => set({ isLoading }),
      setRequires2FA: (requires2FA, tempUserId) => set({ requires2FA, tempUserId }),
      updateUser: (updates) => set((s) => ({ user: s.user ? { ...s.user, ...updates } : null })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated })
    }
  )
)
