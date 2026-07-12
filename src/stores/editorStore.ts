import { create } from 'zustand'
import type { Tab } from '@/types/index'

interface EditorState {
  tabs: Tab[]
  activeTabPath: string | null
  openTab: (tab: Tab) => void
  closeTab: (path: string) => void
  closeActiveTab: () => void
  moveTab: (path: string, targetPath: string, placement: 'before' | 'after') => void
  setActive: (path: string) => void
  updateContent: (path: string, content: string) => void
  markSaved: (path: string, content?: string) => void
  setTabMissing: (path: string, missing: boolean) => void
  markTabsMissingForDeletedPath: (path: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,

  openTab: (tab: Tab) => {
    const { tabs } = get()
    if (tabs.some((t) => t.path === tab.path)) {
      set({
        tabs: tabs.map((t) =>
          t.path === tab.path ? { ...t, missing: tab.missing ?? false } : t
        ),
        activeTabPath: tab.path,
      })
    } else {
      set({ tabs: [...tabs, tab], activeTabPath: tab.path })
    }
  },

  closeTab: (path: string) => {
    const { tabs, activeTabPath } = get()
    const closedIndex = tabs.findIndex((t) => t.path === path)
    const remaining = tabs.filter((t) => t.path !== path)
    const newActive =
      activeTabPath === path
        ? (remaining[Math.min(closedIndex, remaining.length - 1)]?.path ?? null)
        : activeTabPath
    set({ tabs: remaining, activeTabPath: newActive })
  },

  closeActiveTab: () => {
    const { activeTabPath, closeTab } = get()
    if (activeTabPath) closeTab(activeTabPath)
  },

  moveTab: (path: string, targetPath: string, placement: 'before' | 'after') =>
    set((state) => {
      if (path === targetPath) return state

      const moving = state.tabs.find((t) => t.path === path)
      if (!moving) return state

      const withoutMoving = state.tabs.filter((t) => t.path !== path)
      const targetIndex = withoutMoving.findIndex((t) => t.path === targetPath)
      if (targetIndex === -1) return state

      const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex
      const tabs = [
        ...withoutMoving.slice(0, insertIndex),
        moving,
        ...withoutMoving.slice(insertIndex),
      ]

      return { tabs }
    }),

  setActive: (path: string) => set({ activeTabPath: path }),

  updateContent: (path: string, content: string) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.path === path ? { ...t, content, dirty: true } : t
      ),
    })),

  markSaved: (path: string, content?: string) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.path === path && (content === undefined || t.content === content)
          ? { ...t, dirty: false, missing: false }
          : t
      ),
    })),

  setTabMissing: (path: string, missing: boolean) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.path === path ? { ...t, missing } : t
      ),
    })),

  markTabsMissingForDeletedPath: (path: string) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.path === path || t.path.startsWith(`${path}/`)
          ? { ...t, missing: true }
          : t
      ),
    })),
}))
