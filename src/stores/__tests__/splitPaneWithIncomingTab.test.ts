import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('splitPaneWithIncomingTab', () => {
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

  it('cross-pane: splits the target pane, moving the dragged tab from its source pane into the new one, target keeps its own tabs', () => {
    useEditorStore.setState({
      tabs: [
        { path: '/left.ts', content: '', dirty: false },
        { path: '/right.ts', content: '', dirty: false },
      ],
      activeTabPath: '/left.ts',
      layout: {
        type: 'split',
        direction: 'horizontal',
        children: [
          { type: 'pane', id: 'pane-left' },
          { type: 'pane', id: 'pane-right' },
        ],
      },
      activePaneId: 'pane-left',
      paneTabs: { 'pane-left': '/left.ts', 'pane-right': '/right.ts' },
      paneTabLists: { 'pane-left': ['/left.ts'], 'pane-right': ['/right.ts'] },
      pinnedPaths: new Set(),
    })

    // Drag /right.ts (from pane-right) onto pane-left's own left edge.
    useEditorStore.getState().splitPaneWithIncomingTab('pane-left', 'pane-right', '/right.ts', 'horizontal', 'before')

    const state = useEditorStore.getState()
    expect(state.paneTabLists['pane-left']).toEqual(['/left.ts']) // target pane untouched
    expect(state.paneTabLists['pane-right']).toBeUndefined() // source collapsed (was its only tab)
    expect(state.paneTabLists[state.activePaneId]).toEqual(['/right.ts'])
    expect(state.activeTabPath).toBe('/right.ts')
    // pane-right collapsed away entirely (it had only the dragged tab), so
    // the outer split collapses too, leaving just the new before/left split.
    expect(state.layout).toEqual({
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'pane', id: state.activePaneId },
        { type: 'pane', id: 'pane-left' },
      ],
    })
  })

  it('cross-pane: source pane survives with its remaining tabs when it had more than one', () => {
    useEditorStore.setState({
      tabs: [
        { path: '/left.ts', content: '', dirty: false },
        { path: '/right-1.ts', content: '', dirty: false },
        { path: '/right-2.ts', content: '', dirty: false },
      ],
      activeTabPath: '/left.ts',
      layout: {
        type: 'split',
        direction: 'horizontal',
        children: [
          { type: 'pane', id: 'pane-left' },
          { type: 'pane', id: 'pane-right' },
        ],
      },
      activePaneId: 'pane-left',
      paneTabs: { 'pane-left': '/left.ts', 'pane-right': '/right-1.ts' },
      paneTabLists: { 'pane-left': ['/left.ts'], 'pane-right': ['/right-1.ts', '/right-2.ts'] },
      pinnedPaths: new Set(),
    })

    useEditorStore.getState().splitPaneWithIncomingTab('pane-left', 'pane-right', '/right-1.ts', 'vertical', 'after')

    const state = useEditorStore.getState()
    expect(state.paneTabLists['pane-right']).toEqual(['/right-2.ts'])
    expect(state.paneTabLists['pane-left']).toEqual(['/left.ts'])
    expect(state.paneTabLists[state.activePaneId]).toEqual(['/right-1.ts'])
  })

  it('same-pane: dropping on its own edge behaves like splitPaneForTab (splits it out into a new sibling)', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })

    store.splitPaneWithIncomingTab('pane-1', 'pane-1', '/b.ts', 'horizontal', 'after')

    const state = useEditorStore.getState()
    expect(state.paneTabLists['pane-1']).toEqual(['/a.ts'])
    expect(state.paneTabLists[state.activePaneId]).toEqual(['/b.ts'])
    expect(state.layout).toEqual({
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'pane', id: 'pane-1' },
        { type: 'pane', id: state.activePaneId },
      ],
    })
  })

  it('does nothing when the dragged path is not actually open in the claimed source pane', () => {
    useEditorStore.setState({
      tabs: [
        { path: '/left.ts', content: '', dirty: false },
        { path: '/right.ts', content: '', dirty: false },
      ],
      activeTabPath: '/left.ts',
      layout: {
        type: 'split',
        direction: 'horizontal',
        children: [
          { type: 'pane', id: 'pane-left' },
          { type: 'pane', id: 'pane-right' },
        ],
      },
      activePaneId: 'pane-left',
      paneTabs: { 'pane-left': '/left.ts', 'pane-right': '/right.ts' },
      paneTabLists: { 'pane-left': ['/left.ts'], 'pane-right': ['/right.ts'] },
      pinnedPaths: new Set(),
    })
    const before = useEditorStore.getState()

    useEditorStore.getState().splitPaneWithIncomingTab('pane-left', 'pane-right', '/not-open.ts', 'horizontal', 'before')

    expect(useEditorStore.getState()).toEqual(before)
  })
})
