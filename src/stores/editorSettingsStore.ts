import { create } from 'zustand'

const KEYS = {
  autoSaveEnabled: 'huginn:editor:autoSaveEnabled',
}

function getBool(key: string, def: boolean): boolean {
  const value = localStorage.getItem(key)
  return value === null ? def : value === 'true'
}

interface EditorSettingsStore {
  autoSaveEnabled: boolean
  setAutoSaveEnabled: (value: boolean) => void
}

export const useEditorSettingsStore = create<EditorSettingsStore>((set) => ({
  autoSaveEnabled: getBool(KEYS.autoSaveEnabled, false),

  setAutoSaveEnabled: (value) => {
    localStorage.setItem(KEYS.autoSaveEnabled, String(value))
    set({ autoSaveEnabled: value })
  },
}))
