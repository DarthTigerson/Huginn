import { create } from 'zustand'

const URL_KEY = 'huginn:gitRemote:externalUrl'
const CLOSE_SIDE_PANEL_KEY = 'huginn:gitRemote:closeSidePanel'

function getBool(key: string, def: boolean): boolean {
  const value = localStorage.getItem(key)
  return value === null ? def : value === 'true'
}

interface GitRemoteSettingsStore {
  externalUrl: string
  setExternalUrl: (value: string) => void
  closeSidePanelOnOpen: boolean
  setCloseSidePanelOnOpen: (value: boolean) => void
}

export const useGitRemoteSettingsStore = create<GitRemoteSettingsStore>((set) => ({
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
}))
