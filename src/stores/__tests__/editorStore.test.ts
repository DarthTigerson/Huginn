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

  it('closeTab removes the tab and activates the previous one', () => {
    const store = useEditorStore.getState()
    store.openTab({ path: '/a.ts', content: '', dirty: false })
    store.openTab({ path: '/b.ts', content: '', dirty: false })
    store.closeTab('/b.ts')
    expect(useEditorStore.getState().tabs).toHaveLength(1)
    expect(useEditorStore.getState().activeTabPath).toBe('/a.ts')
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
})
