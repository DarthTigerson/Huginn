import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('editorStore', () => {
  beforeEach(() => useEditorStore.setState({ tabs: [], activeTabPath: null }))

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
