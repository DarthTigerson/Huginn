import { create } from 'zustand'

interface TerminalState {
  visible: boolean
  toggle: () => void
  show: () => void
  hide: () => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  visible: false,
  toggle: () => set((s) => ({ visible: !s.visible })),
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}))
