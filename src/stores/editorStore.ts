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

function removePane(node: EditorLayoutNode, paneId: string): EditorLayoutNode | null {
  if (node.type === 'pane') return node.id === paneId ? null : node
  const left = removePane(node.children[0], paneId)
  const right = removePane(node.children[1], paneId)
  if (left === null) return right
  if (right === null) return left
  return { ...node, children: [left, right] }
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
  paneTabLists: Record<string, string[]>
  openTab: (tab: Tab) => void
  openTabAfter: (tab: Tab, afterPath: string) => void
  closeTabInPane: (paneId: string, path: string) => void
  closeTab: (path: string) => void
  closeActiveTab: () => void
  closedTabs: { tab: Tab; paneId: string }[]
  reopenLastClosed: () => void
  resetForNewProject: () => void
  moveTabWithinPane: (paneId: string, path: string, targetPath: string, placement: 'before' | 'after') => void
  moveTab: (path: string, targetPath: string, placement: 'before' | 'after') => void
  moveTabBetweenPanes: (sourcePaneId: string, targetPaneId: string, path: string) => void
  setActive: (path: string) => void
  setActivePane: (paneId: string) => void
  setPaneActive: (paneId: string, path: string) => void
  splitActivePane: (direction: EditorSplitDirection) => void
  updateContent: (path: string, content: string) => void
  markSaved: (path: string, content?: string) => void
  setTabMissing: (path: string, missing: boolean) => void
  markTabsMissingForDeletedPath: (path: string) => void
  revealRequest: { path: string; line: number; col: number; searchTerm: string } | null
  setRevealRequest: (req: { path: string; line: number; col: number; searchTerm: string }) => void
  clearRevealRequest: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabPath: null,
  layout: createDefaultLayout(),
  activePaneId: ROOT_PANE_ID,
  paneTabs: { [ROOT_PANE_ID]: null },
  paneTabLists: { [ROOT_PANE_ID]: [] },
  closedTabs: [],
  revealRequest: null,
  setRevealRequest: (req) => set({ revealRequest: req }),
  clearRevealRequest: () => set({ revealRequest: null }),

  openTab: (tab: Tab) => {
    const { tabs, activePaneId, paneTabLists, layout } = get()
    const paneIds = collectPaneIds(layout)
    // If the tab is already open in some pane, focus that pane rather than
    // also adding it to the active pane's list — otherwise the same tab ends
    // up open in two panes at once (e.g. reopening the Git Log tab from a
    // different pane than the one the user moved it to).
    const existingPaneId = paneIds.find((pid) => (paneTabLists[pid] ?? []).includes(tab.path))

    if (existingPaneId) {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.path === tab.path ? { ...t, missing: tab.missing ?? false } : t
        ),
        activePaneId: existingPaneId,
        activeTabPath: tab.path,
        paneTabs: { ...state.paneTabs, [existingPaneId]: tab.path },
      }))
      return
    }

    const currentList = paneTabLists[activePaneId] ?? []
    set((state) => ({
      tabs: tabs.some((t) => t.path === tab.path) ? state.tabs : [...state.tabs, tab],
      activeTabPath: tab.path,
      paneTabs: { ...state.paneTabs, [activePaneId]: tab.path },
      paneTabLists: { ...state.paneTabLists, [activePaneId]: [...currentList, tab.path] },
    }))
  },

  // Like openTab, but inserts right after a given path within whichever pane
  // that path lives in — rather than at the end of the active pane's list —
  // and switches focus to it. Used for links that open into a new tab, so the
  // new tab lands next to the page that spawned it instead of at the far end
  // of the strip (or in an unrelated pane if the source pane isn't active).
  openTabAfter: (tab: Tab, afterPath: string) => {
    const state = get()
    const paneIds = collectPaneIds(state.layout)
    const paneId =
      paneIds.find((pid) => (state.paneTabLists[pid] ?? []).includes(afterPath)) ?? state.activePaneId
    const currentList = state.paneTabLists[paneId] ?? []
    const alreadyInPane = currentList.includes(tab.path)
    const alreadyOpen = state.tabs.some((t) => t.path === tab.path)

    let newList = currentList
    if (!alreadyInPane) {
      const afterIndex = currentList.indexOf(afterPath)
      const insertIndex = afterIndex === -1 ? currentList.length : afterIndex + 1
      newList = [...currentList.slice(0, insertIndex), tab.path, ...currentList.slice(insertIndex)]
    }

    set({
      tabs: alreadyOpen ? state.tabs : [...state.tabs, tab],
      activePaneId: paneId,
      activeTabPath: tab.path,
      paneTabs: { ...state.paneTabs, [paneId]: tab.path },
      paneTabLists: { ...state.paneTabLists, [paneId]: newList },
    })
  },

  closeTabInPane: (paneId: string, path: string) => {
    const state = get()
    const paneList = state.paneTabLists[paneId] ?? []
    const closedIndex = paneList.indexOf(path)
    if (closedIndex === -1) return

    const newPaneList = paneList.filter((p) => p !== path)
    const newPaneActive = state.paneTabs[paneId] === path
      ? (newPaneList[Math.min(closedIndex, newPaneList.length - 1)] ?? null)
      : state.paneTabs[paneId]

    const allPaneIds = collectPaneIds(state.layout)
    const stillInAnotherPane = allPaneIds.some(
      (pid) => pid !== paneId && (state.paneTabLists[pid] ?? []).includes(path)
    )
    const newTabs = stillInAnotherPane ? state.tabs : state.tabs.filter((t) => t.path !== path)

    // Only record it as "closed" (for Cmd+Shift+T) once it's no longer open
    // anywhere — removing it from just one pane while it stays open in
    // another isn't really closing it.
    const closedTab = state.tabs.find((t) => t.path === path)
    const closedTabs =
      !stillInAnotherPane && closedTab
        ? [...state.closedTabs, { tab: closedTab, paneId }].slice(-20)
        : state.closedTabs

    const otherPaneIds = allPaneIds.filter((pid) => pid !== paneId)
    const shouldCollapse = newPaneList.length === 0 && otherPaneIds.length > 0

    if (shouldCollapse) {
      const newLayout = removePane(state.layout, paneId) ?? createDefaultLayout()
      const newActivePaneId = otherPaneIds.includes(state.activePaneId)
        ? state.activePaneId
        : otherPaneIds[0]
      const newActiveTabPath = state.activePaneId === paneId
        ? (state.paneTabs[newActivePaneId] ?? null)
        : state.activeTabPath

      const newPaneTabs = { ...state.paneTabs }
      const newPaneTabLists = { ...state.paneTabLists }
      delete newPaneTabs[paneId]
      delete newPaneTabLists[paneId]

      set({
        tabs: newTabs,
        layout: newLayout,
        activePaneId: newActivePaneId,
        activeTabPath: newActiveTabPath,
        paneTabs: newPaneTabs,
        paneTabLists: newPaneTabLists,
        closedTabs,
      })
    } else {
      set({
        tabs: newTabs,
        activeTabPath: state.activePaneId === paneId ? newPaneActive : state.activeTabPath,
        paneTabs: { ...state.paneTabs, [paneId]: newPaneActive },
        paneTabLists: { ...state.paneTabLists, [paneId]: newPaneList },
        closedTabs,
      })
    }
  },

  closeTab: (path: string) => {
    const { activePaneId, closeTabInPane } = get()
    closeTabInPane(activePaneId, path)
  },

  closeActiveTab: () => {
    const { activePaneId, paneTabs, closeTabInPane } = get()
    const path = paneTabs[activePaneId]
    if (path) closeTabInPane(activePaneId, path)
  },

  reopenLastClosed: () =>
    set((state) => {
      if (state.closedTabs.length === 0) return state
      const closedTabs = state.closedTabs.slice(0, -1)
      const { tab, paneId } = state.closedTabs[state.closedTabs.length - 1]

      const paneIds = collectPaneIds(state.layout)
      const targetPaneId = paneIds.includes(paneId) ? paneId : state.activePaneId

      const alreadyOpen = state.tabs.some((t) => t.path === tab.path)
      const currentList = state.paneTabLists[targetPaneId] ?? []
      const alreadyInPane = currentList.includes(tab.path)

      return {
        closedTabs,
        tabs: alreadyOpen ? state.tabs : [...state.tabs, tab],
        activePaneId: targetPaneId,
        activeTabPath: tab.path,
        paneTabs: { ...state.paneTabs, [targetPaneId]: tab.path },
        paneTabLists: alreadyInPane
          ? state.paneTabLists
          : { ...state.paneTabLists, [targetPaneId]: [...currentList, tab.path] },
      }
    }),

  // Switching to a different project root leaves every open tab (file,
  // terminal, browser) pointing at the old repo — close everything so the
  // window starts clean for the new one, the same way opening a fresh
  // window would. Unmounting TerminalTab/BrowserTab instances (which
  // happens once they're no longer in `tabs`) is what tears down their
  // underlying PTY/WebContentsView.
  resetForNewProject: () =>
    set({
      tabs: [],
      activeTabPath: null,
      layout: createDefaultLayout(),
      activePaneId: ROOT_PANE_ID,
      paneTabs: { [ROOT_PANE_ID]: null },
      paneTabLists: { [ROOT_PANE_ID]: [] },
      closedTabs: [],
      revealRequest: null,
    }),

  moveTabWithinPane: (paneId: string, path: string, targetPath: string, placement: 'before' | 'after') =>
    set((state) => {
      if (path === targetPath) return state
      const paneList = state.paneTabLists[paneId] ?? []
      const withoutPath = paneList.filter((p) => p !== path)
      const targetIndex = withoutPath.indexOf(targetPath)
      if (targetIndex === -1) return state
      const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex
      const newList = [
        ...withoutPath.slice(0, insertIndex),
        path,
        ...withoutPath.slice(insertIndex),
      ]
      return { paneTabLists: { ...state.paneTabLists, [paneId]: newList } }
    }),

  moveTab: (path: string, targetPath: string, placement: 'before' | 'after') => {
    const { activePaneId, moveTabWithinPane } = get()
    moveTabWithinPane(activePaneId, path, targetPath, placement)
  },

  moveTabBetweenPanes: (sourcePaneId: string, targetPaneId: string, path: string) =>
    set((state) => {
      const sourceList = state.paneTabLists[sourcePaneId] ?? []
      const closedIndex = sourceList.indexOf(path)
      const newSourceList = sourceList.filter((p) => p !== path)
      const newSourceActive = state.paneTabs[sourcePaneId] === path
        ? (newSourceList[Math.min(closedIndex, newSourceList.length - 1)] ?? null)
        : state.paneTabs[sourcePaneId]
      const newTargetList = [...(state.paneTabLists[targetPaneId] ?? []), path]

      const allPaneIds = collectPaneIds(state.layout)
      const otherPaneIds = allPaneIds.filter((pid) => pid !== sourcePaneId)
      const shouldCollapseSource = newSourceList.length === 0 && otherPaneIds.length > 0

      if (shouldCollapseSource) {
        const newLayout = removePane(state.layout, sourcePaneId) ?? createDefaultLayout()
        const newActivePaneId = state.activePaneId === sourcePaneId ? targetPaneId : state.activePaneId
        const newPaneTabs = { ...state.paneTabs }
        const newPaneTabLists = { ...state.paneTabLists }
        delete newPaneTabs[sourcePaneId]
        delete newPaneTabLists[sourcePaneId]
        return {
          layout: newLayout,
          activePaneId: newActivePaneId,
          activeTabPath: path,
          paneTabs: { ...newPaneTabs, [targetPaneId]: path },
          paneTabLists: { ...newPaneTabLists, [targetPaneId]: newTargetList },
        }
      }

      return {
        activePaneId: targetPaneId,
        activeTabPath: path,
        paneTabs: { ...state.paneTabs, [sourcePaneId]: newSourceActive, [targetPaneId]: path },
        paneTabLists: { ...state.paneTabLists, [sourcePaneId]: newSourceList, [targetPaneId]: newTargetList },
      }
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

  setPaneActive: (paneId: string, path: string) =>
    set((state) => {
      const paneIds = collectPaneIds(state.layout)
      if (!paneIds.includes(paneId)) return state
      return {
        activePaneId: paneId,
        activeTabPath: path,
        paneTabs: { ...state.paneTabs, [paneId]: path },
      }
    }),

  splitActivePane: (direction: EditorSplitDirection) =>
    set((state) => {
      if (!state.activeTabPath) return state
      const currentPaneList = state.paneTabLists[state.activePaneId] ?? []
      if (currentPaneList.length < 2) return state

      const activeIndex = currentPaneList.indexOf(state.activeTabPath)
      const newCurrentList = currentPaneList.filter((p) => p !== state.activeTabPath)
      const fallbackPath = newCurrentList[Math.min(activeIndex, newCurrentList.length - 1)] ?? null

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
        paneTabLists: {
          ...state.paneTabLists,
          [state.activePaneId]: newCurrentList,
          [nextPaneId]: [state.activeTabPath],
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
