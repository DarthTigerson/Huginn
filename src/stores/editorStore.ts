import { create } from 'zustand'
import type { Tab } from '@/types/index'

export type EditorSplitDirection = 'horizontal' | 'vertical'

export type EditorLayoutNode =
  | { type: 'pane'; id: string }
  | { type: 'split'; direction: EditorSplitDirection; children: [EditorLayoutNode, EditorLayoutNode] }

const ROOT_PANE_ID = 'pane-1'

function createDefaultLayout(): EditorLayoutNode {
  return { type: 'pane', id: ROOT_PANE_ID }
}

function replacePane(
  node: EditorLayoutNode,
  paneId: string,
  replacement: EditorLayoutNode
): EditorLayoutNode {
  if (node.type === 'pane') return node.id === paneId ? replacement : node
  return {
    ...node,
    children: [
      replacePane(node.children[0], paneId, replacement),
      replacePane(node.children[1], paneId, replacement),
    ],
  }
}

function collectPaneIds(node: EditorLayoutNode): string[] {
  if (node.type === 'pane') return [node.id]
  return [...collectPaneIds(node.children[0]), ...collectPaneIds(node.children[1])]
}

interface EditorState {
  tabs: Tab[]
  activeTabPath: string | null
  layout: EditorLayoutNode
  activePaneId: string
  paneTabs: Record<string, string | null>
  openTab: (tab: Tab) => void
  closeTab: (path: string) => void
  closeActiveTab: () => void
  moveTab: (path: string, targetPath: string, placement: 'before' | 'after') => void
  setActive: (path: string) => void
  setActivePane: (paneId: string) => void
  splitActivePane: (direction: EditorSplitDirection) => void
  updateContent: (path: string, content: string) => void
  markSaved: (path: string, content?: string) => void
  setTabMissing: (path: string, missing: boolean) => void
  markTabsMissingForDeletedPath: (path: string) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,
  layout: createDefaultLayout(),
  activePaneId: ROOT_PANE_ID,
  paneTabs: { [ROOT_PANE_ID]: null },

  openTab: (tab: Tab) => {
    const { tabs, activePaneId } = get()
    if (tabs.some((t) => t.path === tab.path)) {
      set((state) => ({
        tabs: tabs.map((t) =>
          t.path === tab.path ? { ...t, missing: tab.missing ?? false } : t
        ),
        activeTabPath: tab.path,
        paneTabs: { ...state.paneTabs, [activePaneId]: tab.path },
      }))
    } else {
      set((state) => ({
        tabs: [...tabs, tab],
        activeTabPath: tab.path,
        paneTabs: { ...state.paneTabs, [activePaneId]: tab.path },
      }))
    }
  },

  closeTab: (path: string) => {
    const { tabs, activeTabPath, paneTabs } = get()
    const closedIndex = tabs.findIndex((t) => t.path === path)
    const remaining = tabs.filter((t) => t.path !== path)
    const fallbackPath = remaining[Math.min(closedIndex, remaining.length - 1)]?.path ?? null
    const newActive =
      activeTabPath === path
        ? fallbackPath
        : activeTabPath
    const nextPaneTabs = Object.fromEntries(
      Object.entries(paneTabs).map(([paneId, tabPath]) => [
        paneId,
        tabPath === path ? fallbackPath : tabPath,
      ])
    )
    const shouldResetLayout = remaining.length <= 1
    set({
      tabs: remaining,
      activeTabPath: newActive,
      paneTabs: nextPaneTabs,
      ...(shouldResetLayout
        ? {
            layout: createDefaultLayout(),
            activePaneId: ROOT_PANE_ID,
            paneTabs: { [ROOT_PANE_ID]: newActive },
          }
        : {}),
    })
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

  setActive: (path: string) =>
    set((state) => ({
      activeTabPath: path,
      paneTabs: { ...state.paneTabs, [state.activePaneId]: path },
    })),

  setActivePane: (paneId: string) =>
    set((state) => {
      const paneIds = collectPaneIds(state.layout)
      if (!paneIds.includes(paneId)) return state
      const paneTabPath = state.paneTabs[paneId]
      return {
        activePaneId: paneId,
        activeTabPath: paneTabPath ?? state.activeTabPath,
      }
    }),

  splitActivePane: (direction: EditorSplitDirection) =>
    set((state) => {
      if (!state.activeTabPath || state.tabs.length < 2) return state

      const activeIndex = state.tabs.findIndex((tab) => tab.path === state.activeTabPath)
      const fallbackPath = state.tabs[
        activeIndex === state.tabs.length - 1 ? activeIndex - 1 : activeIndex + 1
      ]?.path
      if (!fallbackPath) return state

      const nextPaneNumber = collectPaneIds(state.layout).length + 1
      const nextPaneId = `pane-${Date.now()}-${nextPaneNumber}`
      const replacement: EditorLayoutNode = {
        type: 'split',
        direction,
        children: [
          { type: 'pane', id: state.activePaneId },
          { type: 'pane', id: nextPaneId },
        ],
      }

      return {
        layout: replacePane(state.layout, state.activePaneId, replacement),
        activePaneId: nextPaneId,
        activeTabPath: state.activeTabPath,
        paneTabs: {
          ...state.paneTabs,
          [state.activePaneId]: fallbackPath,
          [nextPaneId]: state.activeTabPath,
        },
      }
    }),

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
