import { create } from 'zustand'

const MIN = 10
const MAX = 24
const DEFAULT = 13
const STORAGE_KEY = 'huginn:fontSize'

interface FontSizeStore {
  fontSize: number
  increase: () => void
  decrease: () => void
}

const stored = Number(localStorage.getItem(STORAGE_KEY) || DEFAULT)
const initial = stored >= MIN && stored <= MAX ? stored : DEFAULT

export const useFontSizeStore = create<FontSizeStore>((set, get) => ({
  fontSize: initial,
  increase: () => {
    const next = Math.min(get().fontSize + 1, MAX)
    localStorage.setItem(STORAGE_KEY, String(next))
    set({ fontSize: next })
  },
  decrease: () => {
    const next = Math.max(get().fontSize - 1, MIN)
    localStorage.setItem(STORAGE_KEY, String(next))
    set({ fontSize: next })
  },
}))
