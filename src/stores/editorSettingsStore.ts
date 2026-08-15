import { create } from 'zustand'

const KEYS = {
  autoSaveEnabled: 'huginn:editor:autoSaveEnabled',
  wordWrapEnabled: 'huginn:editor:wordWrapEnabled',
}

function getBool(key: string, def: boolean): boolean {
  const value = localStorage.getItem(key)
  return value === null ? def : value === 'true'
}

interface EditorSettingsStore {
  autoSaveEnabled: boolean
  setAutoSaveEnabled: (value: boolean) => void
  wordWrapEnabled: boolean
  toggleWordWrap: () => void
}

export const useEditorSettingsStore = create<EditorSettingsStore>((set, get) => ({
  autoSaveEnabled: getBool(KEYS.autoSaveEnabled, false),

  setAutoSaveEnabled: (value) => {
    localStorage.setItem(KEYS.autoSaveEnabled, String(value))
    set({ autoSaveEnabled: value })
  },

  wordWrapEnabled: getBool(KEYS.wordWrapEnabled, false),

  toggleWordWrap: () => {
    const value = !get().wordWrapEnabled
    localStorage.setItem(KEYS.wordWrapEnabled, String(value))
    set({ wordWrapEnabled: value })
  },
}))
