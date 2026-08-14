import { create } from 'zustand'

interface StatusMessageStore {
  message: string | null
  show: (message: string, durationMs?: number) => void
}

let timeoutId: ReturnType<typeof setTimeout> | null = null

export const useStatusMessageStore = create<StatusMessageStore>((set) => ({
  message: null,
  show: (message, durationMs = 2000) => {
    if (timeoutId) clearTimeout(timeoutId)
    set({ message })
    timeoutId = setTimeout(() => set({ message: null }), durationMs)
  },
}))
