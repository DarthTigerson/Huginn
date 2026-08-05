import { create } from 'zustand'
import { useFontSizeStore } from './fontSizeStore'

const MIN = 5
const MAX = 24

interface InstanceFontSizeStore {
  overrides: Record<string, number>
  increase: (key: string) => void
  decrease: (key: string) => void
  reset: (key: string) => void
  resetAll: () => void
}

function currentSize(overrides: Record<string, number>, key: string): number {
  return overrides[key] ?? useFontSizeStore.getState().fontSize
}

export const useInstanceFontSizeStore = create<InstanceFontSizeStore>((set, get) => ({
  overrides: {},
  increase: (key) => {
    const next = Math.min(currentSize(get().overrides, key) + 1, MAX)
    set((s) => ({ overrides: { ...s.overrides, [key]: next } }))
  },
  decrease: (key) => {
    const next = Math.max(currentSize(get().overrides, key) - 1, MIN)
    set((s) => ({ overrides: { ...s.overrides, [key]: next } }))
  },
  reset: (key) => {
    set((s) => {
      if (!(key in s.overrides)) return s
      const overrides = { ...s.overrides }
      delete overrides[key]
      return { overrides }
    })
  },
  resetAll: () => set({ overrides: {} }),
}))
