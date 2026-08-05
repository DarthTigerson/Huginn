import { create } from 'zustand'

export type LeftPanelId = 'files' | 'git' | 'todos' | 'mobile' | 'settings' | 'devtools'

interface LeftPanelStore {
  panel: LeftPanelId | null
  lastPanel: LeftPanelId
  setPanel: (panel: LeftPanelId | null) => void
  toggle: (panel: LeftPanelId) => void
}

export const useLeftPanelStore = create<LeftPanelStore>((set, get) => ({
  panel: 'files',
  lastPanel: 'files',
  setPanel: (panel) => set({ panel, ...(panel ? { lastPanel: panel } : {}) }),
  toggle: (panel) => {
    const isOpen = get().panel === panel
    set({ panel: isOpen ? null : panel, lastPanel: panel })
  },
}))
