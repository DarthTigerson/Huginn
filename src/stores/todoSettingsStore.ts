import { create } from 'zustand'

const URL_KEY = 'huginn:todo:externalUrl'
const CLOSE_SIDE_PANEL_KEY = 'huginn:todo:closeSidePanel'
const ENABLED_KEY = 'huginn:todo:enabled'

function getBool(key: string, def: boolean): boolean {
  const value = localStorage.getItem(key)
  return value === null ? def : value === 'true'
}

interface TodoSettingsStore {
  externalUrl: string
  setExternalUrl: (value: string) => void
  closeSidePanelOnOpen: boolean
  setCloseSidePanelOnOpen: (value: boolean) => void
  enabled: boolean
  setEnabled: (value: boolean) => void
}

export const useTodoSettingsStore = create<TodoSettingsStore>((set) => ({
  externalUrl: localStorage.getItem(URL_KEY) || '',

  setExternalUrl: (value) => {
    localStorage.setItem(URL_KEY, value)
    set({ externalUrl: value })
  },

  closeSidePanelOnOpen: getBool(CLOSE_SIDE_PANEL_KEY, false),

  setCloseSidePanelOnOpen: (value) => {
    localStorage.setItem(CLOSE_SIDE_PANEL_KEY, String(value))
    set({ closeSidePanelOnOpen: value })
  },

  enabled: getBool(ENABLED_KEY, true),

  setEnabled: (value) => {
    localStorage.setItem(ENABLED_KEY, String(value))
    set({ enabled: value })
  },
}))
