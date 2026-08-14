import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('splitPaneForTab', () => {
  beforeEach(() => useEditorStore.setState({
    tabs: [],
    activeTabPath: null,
    layout: { type: 'pane', id: 'pane-1' },
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': null },
    paneTabLists: { 'pane-1': [] },
    closedTabs: [],
  }))

  function openTwo() {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
  }

  it('"after" + horizontal puts the new pane to the right, holding the split tab', () => {
    openTwo()
    useEditorStore.getState().splitPaneForTab('pane-1', '/b.ts', 'horizontal', 'after')

    const state = useEditorStore.getState()
    expect(state.layout).toEqual({
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'pane', id: 'pane-1' },
        { type: 'pane', id: state.activePaneId },
      ],
    })
    expect(state.paneTabLists['pane-1']).toEqual(['/a.ts'])
    expect(state.paneTabLists[state.activePaneId]).toEqual(['/b.ts'])
    expect(state.activeTabPath).toBe('/b.ts')
  })

  it('"before" + horizontal puts the new pane to the left, original pane keeps its remaining tabs on the right', () => {
    openTwo()
    useEditorStore.getState().splitPaneForTab('pane-1', '/b.ts', 'horizontal', 'before')

    const state = useEditorStore.getState()
    expect(state.layout).toEqual({
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'pane', id: state.activePaneId },
        { type: 'pane', id: 'pane-1' },
      ],
    })
    expect(state.paneTabLists[state.activePaneId]).toEqual(['/b.ts'])
    expect(state.paneTabLists['pane-1']).toEqual(['/a.ts'])
  })

  it('"after" + vertical puts the new pane below', () => {
    openTwo()
    useEditorStore.getState().splitPaneForTab('pane-1', '/b.ts', 'vertical', 'after')

    const state = useEditorStore.getState()
    expect(state.layout).toEqual({
      type: 'split',
      direction: 'vertical',
      children: [
        { type: 'pane', id: 'pane-1' },
        { type: 'pane', id: state.activePaneId },
      ],
    })
  })

  it('"before" + vertical puts the new pane above', () => {
    openTwo()
    useEditorStore.getState().splitPaneForTab('pane-1', '/b.ts', 'vertical', 'before')

    const state = useEditorStore.getState()
    expect(state.layout).toEqual({
      type: 'split',
      direction: 'vertical',
      children: [
        { type: 'pane', id: state.activePaneId },
        { type: 'pane', id: 'pane-1' },
      ],
    })
  })

  it('does nothing when the target pane has only the one tab (nothing to leave behind)', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: '', dirty: false })
    const before = useEditorStore.getState()
    useEditorStore.getState().splitPaneForTab('pane-1', '/a.ts', 'horizontal', 'after')
    expect(useEditorStore.getState()).toEqual(before)
  })

  it('does nothing when the path is not actually open in that pane', () => {
    openTwo()
    const before = useEditorStore.getState()
    useEditorStore.getState().splitPaneForTab('pane-1', '/not-open.ts', 'horizontal', 'after')
    expect(useEditorStore.getState()).toEqual(before)
  })

  it('splitting a tab in a pane that is not the currently active one still works, and focuses the new pane', () => {
    openTwo()
    // Split off /b.ts into a second pane and switch focus back to pane-1.
    useEditorStore.getState().splitPaneForTab('pane-1', '/b.ts', 'horizontal', 'after')
    const secondPaneId = useEditorStore.getState().activePaneId
    useEditorStore.getState().setActivePane('pane-1')
    useEditorStore.getState().openTab({ path: '/c.ts', content: '', dirty: false })

    // Now split /c.ts out of pane-1 while pane-1 isn't active (secondPaneId is).
    useEditorStore.getState().setActivePane(secondPaneId)
    useEditorStore.getState().splitPaneForTab('pane-1', '/c.ts', 'vertical', 'after')

    const state = useEditorStore.getState()
    expect(state.activePaneId).not.toBe('pane-1')
    expect(state.activePaneId).not.toBe(secondPaneId)
    expect(state.paneTabLists[state.activePaneId]).toEqual(['/c.ts'])
    expect(state.paneTabLists['pane-1']).toEqual(['/a.ts'])
  })
})
