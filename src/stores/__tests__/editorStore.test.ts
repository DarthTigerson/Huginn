import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('editorStore', () => {
  beforeEach(() => useEditorStore.setState({
    tabs: [],
    activeTabPath: null,
    layout: { type: 'pane', id: 'pane-1' },
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': null },
  }))

  it('starts empty', () => {
    expect(useEditorStore.getState().tabs).toHaveLength(0)
  })

  it('openTab adds a tab and sets it active', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: 'hello', dirty: false })
    const { tabs, activeTabPath } = useEditorStore.getState()
    expect(tabs).toHaveLength(1)
    expect(activeTabPath).toBe('/a.ts')
  })

  it('openTab on existing path activates without duplicating', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: 'hello', dirty: false })
    store.openTab({ path: '/b.ts', content: 'world', dirty: false })
    store.openTab({ path: '/a.ts', content: 'hello', dirty: false })
    expect(useEditorStore.getState().tabs).toHaveLength(2)
    expect(useEditorStore.getState().activeTabPath).toBe('/a.ts')
  })

  it('closeTab removes the tab and activates the adjacent tab', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.openTab({ path: '/c.ts', content: '', dirty: false })
    store.setActive('/b.ts')
    store.closeTab('/b.ts')
    expect(useEditorStore.getState().tabs.map((t) => t.path)).toEqual(['/a.ts', '/c.ts'])
    expect(useEditorStore.getState().activeTabPath).toBe('/c.ts')
  })

  it('closeActiveTab closes the active tab', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.closeActiveTab()
    expect(useEditorStore.getState().tabs.map((t) => t.path)).toEqual(['/a.ts'])
    expect(useEditorStore.getState().activeTabPath).toBe('/a.ts')
  })

  it('moveTab reorders tabs before or after a target tab', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.openTab({ path: '/c.ts', content: '', dirty: false })
    store.moveTab('/c.ts', '/a.ts', 'before')
    expect(useEditorStore.getState().tabs.map((t) => t.path)).toEqual(['/c.ts', '/a.ts', '/b.ts'])
    store.moveTab('/c.ts', '/b.ts', 'after')
    expect(useEditorStore.getState().tabs.map((t) => t.path)).toEqual(['/a.ts', '/b.ts', '/c.ts'])
  })

  it('setActive updates the active pane tab', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.setActive('/a.ts')
    expect(useEditorStore.getState().paneTabs['pane-1']).toBe('/a.ts')
  })

  it('splitActivePane creates a right split with the active tab in the new pane', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.splitActivePane('horizontal')
    const state = useEditorStore.getState()
    expect(state.layout.type).toBe('split')
    if (state.layout.type !== 'split') return
    expect(state.layout.direction).toBe('horizontal')
    expect(state.layout.children[0]).toEqual({ type: 'pane', id: 'pane-1' })
    expect(state.activePaneId).not.toBe('pane-1')
    expect(state.paneTabs['pane-1']).toBe('/a.ts')
    expect(state.paneTabs[state.activePaneId]).toBe('/b.ts')
    expect(state.activeTabPath).toBe('/b.ts')
  })

  it('splitActivePane creates a down split with the active tab in the new pane', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.splitActivePane('vertical')
    const state = useEditorStore.getState()
    expect(state.layout.type).toBe('split')
    if (state.layout.type !== 'split') return
    expect(state.layout.direction).toBe('vertical')
    expect(state.paneTabs['pane-1']).toBe('/a.ts')
    expect(state.paneTabs[state.activePaneId]).toBe('/b.ts')
  })

  it('splitActivePane does nothing with fewer than two tabs', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.splitActivePane('horizontal')
    const state = useEditorStore.getState()
    expect(state.layout).toEqual({ type: 'pane', id: 'pane-1' })
    expect(state.activePaneId).toBe('pane-1')
  })

  it('closeTab collapses splits when one tab remains', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.splitActivePane('horizontal')
    store.closeTab('/b.ts')
    const state = useEditorStore.getState()
    expect(state.layout).toEqual({ type: 'pane', id: 'pane-1' })
    expect(state.activePaneId).toBe('pane-1')
    expect(state.paneTabs).toEqual({ 'pane-1': '/a.ts' })
  })

  it('closeTab last tab sets activeTabPath to null', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: '', dirty: false })
    useEditorStore.getState().closeTab('/a.ts')
    expect(useEditorStore.getState().tabs).toHaveLength(0)
    expect(useEditorStore.getState().activeTabPath).toBeNull()
  })

  it('updateContent sets new content and marks dirty', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: 'original', dirty: false })
    useEditorStore.getState().updateContent('/a.ts', 'changed')
    const tab = useEditorStore.getState().tabs[0]
    expect(tab.content).toBe('changed')
    expect(tab.dirty).toBe(true)
  })

  it('markSaved clears dirty for a tab', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: 'original', dirty: false })
    useEditorStore.getState().updateContent('/a.ts', 'changed')
    useEditorStore.getState().setTabMissing('/a.ts', true)
    useEditorStore.getState().markSaved('/a.ts')
    expect(useEditorStore.getState().tabs[0].dirty).toBe(false)
    expect(useEditorStore.getState().tabs[0].missing).toBe(false)
  })

  it('markSaved keeps dirty when content changed after save started', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: 'original', dirty: false })
    useEditorStore.getState().updateContent('/a.ts', 'saved snapshot')
    useEditorStore.getState().updateContent('/a.ts', 'newer edit')
    useEditorStore.getState().markSaved('/a.ts', 'saved snapshot')
    expect(useEditorStore.getState().tabs[0].dirty).toBe(true)
  })

  it('setTabMissing marks a tab as missing', () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: '', dirty: false })
    useEditorStore.getState().setTabMissing('/a.ts', true)
    expect(useEditorStore.getState().tabs[0].missing).toBe(true)
  })

  it('markTabsMissingForDeletedPath marks matching file and directory tabs', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/proj/src/a.ts', content: '', dirty: false })
    store.openTab({ path: '/proj/src/b.ts', content: '', dirty: false })
    store.openTab({ path: '/proj/README.md', content: '', dirty: false })
    store.markTabsMissingForDeletedPath('/proj/src')
    expect(useEditorStore.getState().tabs.map((t) => t.missing ?? false)).toEqual([
      true,
      true,
      false,
    ])
  })
})
