import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('moveTabToAdjacentPane', () => {
  beforeEach(() => useEditorStore.setState({
    tabs: [],
    activeTabPath: null,
    layout: { type: 'pane', id: 'pane-1' },
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': null },
    paneTabLists: { 'pane-1': [] },
    closedTabs: [],
  }))

  it('moves the tab into the pane to the right, when one exists', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.splitPaneForTab('pane-1', '/b.ts', 'horizontal', 'after')
    const rightPaneId = useEditorStore.getState().activePaneId

    store.moveTabToAdjacentPane('pane-1', '/a.ts', 'right')

    const state = useEditorStore.getState()
    // /a.ts was pane-1's only remaining tab, so pane-1 collapses away
    // entirely (the same invariant closeTabInPane/moveTabBetweenPanes
    // already enforce elsewhere: panes never sit empty).
    expect(state.paneTabLists['pane-1']).toBeUndefined()
    expect(state.layout).toEqual({ type: 'pane', id: rightPaneId })
    expect(state.paneTabLists[rightPaneId]).toEqual(['/b.ts', '/a.ts'])
  })

  it('does nothing when there is no pane in that direction', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    const before = useEditorStore.getState()

    store.moveTabToAdjacentPane('pane-1', '/a.ts', 'right')

    expect(useEditorStore.getState()).toEqual(before)
  })
})
