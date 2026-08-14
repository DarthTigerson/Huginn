import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('closeAllTabs / closeSavedTabs', () => {
  beforeEach(() => useEditorStore.setState({
    tabs: [],
    activeTabPath: null,
    layout: { type: 'pane', id: 'pane-1' },
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': null },
    paneTabLists: { 'pane-1': [] },
    closedTabs: [],
    pinnedPaths: new Set(),
  }))

  describe('closeAllTabs', () => {
    it('closes every open tab', () => {
      const store = useEditorStore.getState()
      store.openTab({ path: '/a.ts', content: '', dirty: false })
      store.openTab({ path: '/b.ts', content: '', dirty: false })
      store.closeAllTabs()
      expect(useEditorStore.getState().tabs).toHaveLength(0)
      expect(useEditorStore.getState().activeTabPath).toBeNull()
    })

    it('leaves pinned tabs open', () => {
      const store = useEditorStore.getState()
      store.openTab({ path: '/a.ts', content: '', dirty: false })
      store.openTab({ path: '/b.ts', content: '', dirty: false })
      store.togglePin('/a.ts')
      store.closeAllTabs()
      const state = useEditorStore.getState()
      expect(state.tabs.map((t) => t.path)).toEqual(['/a.ts'])
      expect(state.paneTabLists['pane-1']).toEqual(['/a.ts'])
    })

    it('collapses a pane that becomes fully empty, keeping the layout valid', () => {
      const store = useEditorStore.getState()
      store.openTab({ path: '/a.ts', content: '', dirty: false })
      store.openTab({ path: '/b.ts', content: '', dirty: false })
      store.splitPaneForTab('pane-1', '/b.ts', 'horizontal', 'after')
      const secondPaneId = useEditorStore.getState().activePaneId
      store.togglePin('/a.ts') // keep pane-1 alive with one pinned tab; second pane closes fully

      store.closeAllTabs()

      const state = useEditorStore.getState()
      expect(state.paneTabLists[secondPaneId]).toBeUndefined()
      expect(state.layout).toEqual({ type: 'pane', id: 'pane-1' })
      expect(state.paneTabLists['pane-1']).toEqual(['/a.ts'])
    })

    it('falls back to a single fresh empty pane when nothing is pinned', () => {
      const store = useEditorStore.getState()
      store.openTab({ path: '/a.ts', content: '', dirty: false })
      store.openTab({ path: '/b.ts', content: '', dirty: false })
      store.splitPaneForTab('pane-1', '/b.ts', 'horizontal', 'after')

      store.closeAllTabs()

      const state = useEditorStore.getState()
      expect(state.layout.type).toBe('pane')
      expect(state.tabs).toHaveLength(0)
    })
  })

  describe('closeSavedTabs', () => {
    it('closes only tabs without unsaved changes', () => {
      const store = useEditorStore.getState()
      store.openTab({ path: '/saved.ts', content: '', dirty: false })
      store.openTab({ path: '/dirty.ts', content: 'edited', dirty: true })
      store.closeSavedTabs()
      const state = useEditorStore.getState()
      expect(state.tabs.map((t) => t.path)).toEqual(['/dirty.ts'])
    })

    it('leaves pinned tabs open even if they have no unsaved changes', () => {
      const store = useEditorStore.getState()
      store.openTab({ path: '/pinned-saved.ts', content: '', dirty: false })
      store.togglePin('/pinned-saved.ts')
      store.closeSavedTabs()
      expect(useEditorStore.getState().tabs.map((t) => t.path)).toEqual(['/pinned-saved.ts'])
    })
  })
})
