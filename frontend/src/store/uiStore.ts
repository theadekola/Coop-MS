import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  secondaryPanelOpen: boolean
  notificationCount: number
  messageCount: number
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSecondaryPanelOpen: (open: boolean) => void
  toggleSecondaryPanel: () => void
  setNotificationCount: (n: number) => void
  setMessageCount: (n: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  secondaryPanelOpen: false,
  notificationCount: 0,
  messageCount: 0,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSecondaryPanelOpen: (secondaryPanelOpen) => set({ secondaryPanelOpen }),
  toggleSecondaryPanel: () => set((s) => ({ secondaryPanelOpen: !s.secondaryPanelOpen })),
  setNotificationCount: (notificationCount) => set({ notificationCount }),
  setMessageCount: (messageCount) => set({ messageCount }),
}))
