import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('pinned tabs', () => {
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

  it('defaults to nothing pinned', () => {
    expect(useEditorStore.getState().pinnedPaths.size).toBe(0)
  })

  it('togglePin pins an unpinned path', () => {
    useEditorStore.getState().togglePin('/a.ts')
    expect(useEditorStore.getState().pinnedPaths.has('/a.ts')).toBe(true)
  })

  it('togglePin unpins an already-pinned path', () => {
    useEditorStore.getState().togglePin('/a.ts')
    useEditorStore.getState().togglePin('/a.ts')
    expect(useEditorStore.getState().pinnedPaths.has('/a.ts')).toBe(false)
  })

  it('pinning one path does not affect others', () => {
    useEditorStore.getState().togglePin('/a.ts')
    useEditorStore.getState().togglePin('/b.ts')
    const { pinnedPaths } = useEditorStore.getState()
    expect(pinnedPaths.has('/a.ts')).toBe(true)
    expect(pinnedPaths.has('/b.ts')).toBe(true)
  })
})
