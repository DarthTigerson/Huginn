import { create } from 'zustand'

export interface BrowserTabState {
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  webContentsId: number | null
  loadError: string | null
}

interface BrowserStore {
  tabs: Record<string, BrowserTabState>
  ensureTab: (id: string, initialUrl: string) => void
  updateTab: (id: string, patch: Partial<BrowserTabState>) => void
  removeTab: (id: string) => void
}

const DEFAULT_STATE: BrowserTabState = {
  url: '',
  title: '',
  isLoading: false,
  canGoBack: false,
  canGoForward: false,
  webContentsId: null,
  loadError: null,
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  tabs: {},

  ensureTab: (id, initialUrl) => {
    if (get().tabs[id]) return
    set((s) => ({ tabs: { ...s.tabs, [id]: { ...DEFAULT_STATE, url: initialUrl } } }))
  },

  updateTab: (id, patch) => {
    set((s) => {
      const existing = s.tabs[id] ?? DEFAULT_STATE
      return { tabs: { ...s.tabs, [id]: { ...existing, ...patch } } }
    })
  },

  removeTab: (id) => {
    set((s) => {
      if (!(id in s.tabs)) return s
      const tabs = { ...s.tabs }
      delete tabs[id]
      return { tabs }
    })
  },
}))
