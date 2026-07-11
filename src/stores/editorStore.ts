import { create } from 'zustand'
import type { Tab } from '@/types/index'

interface EditorState {
  tabs: Tab[]
  activeTabPath: string | null
  openTab: (tab: Tab) => void
  closeTab: (path: string) => void
  setActive: (path: string) => void
  updateContent: (path: string, content: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,

  openTab: (tab: Tab) => {
    const { tabs } = get()
    if (tabs.some((t) => t.path === tab.path)) {
      set({ activeTabPath: tab.path })
    } else {
      set({ tabs: [...tabs, tab], activeTabPath: tab.path })
    }
  },

  closeTab: (path: string) => {
    const { tabs, activeTabPath } = get()
    const remaining = tabs.filter((t) => t.path !== path)
    const newActive =
      activeTabPath === path
        ? (remaining[remaining.length - 1]?.path ?? null)
        : activeTabPath
    set({ tabs: remaining, activeTabPath: newActive })
  },

  setActive: (path: string) => set({ activeTabPath: path }),

  updateContent: (path: string, content: string) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.path === path ? { ...t, content, dirty: true } : t
      ),
    })),
}))
