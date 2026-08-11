import { create } from 'zustand'

const KEY = 'huginn:todo:externalUrl'

interface TodoSettingsStore {
  externalUrl: string
  setExternalUrl: (value: string) => void
}

export const useTodoSettingsStore = create<TodoSettingsStore>((set) => ({
  externalUrl: localStorage.getItem(KEY) || '',

  setExternalUrl: (value) => {
    localStorage.setItem(KEY, value)
    set({ externalUrl: value })
  },
}))
