import { create } from 'zustand'

const CLOSE_SIDE_PANEL_KEY = 'vide:browser:closeSidePanel'

function getBool(key: string, def: boolean): boolean {
  const value = localStorage.getItem(key)
  return value === null ? def : value === 'true'
}

interface BrowserSettingsStore {
  closeSidePanelOnOpen: boolean
  setCloseSidePanelOnOpen: (value: boolean) => void
}

export const useBrowserSettingsStore = create<BrowserSettingsStore>((set) => ({

  closeSidePanelOnOpen: getBool(CLOSE_SIDE_PANEL_KEY, false),

  setCloseSidePanelOnOpen: (value) => {
    localStorage.setItem(CLOSE_SIDE_PANEL_KEY, String(value))
    set({ closeSidePanelOnOpen: value })
  },
}))
