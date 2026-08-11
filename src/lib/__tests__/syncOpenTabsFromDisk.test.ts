import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEditorStore } from '@/stores/editorStore'
import { syncOpenTabsFromDisk } from '../syncOpenTabsFromDisk'

vi.stubGlobal('window', {
  api: {
    readFile: vi.fn(),
  },
})

describe('syncOpenTabsFromDisk', () => {
  beforeEach(() => {
    useEditorStore.setState({
      tabs: [],
      activeTabPath: null,
      layout: { type: 'pane', id: 'pane-1' },
      activePaneId: 'pane-1',
      paneTabs: { 'pane-1': null },
      paneTabLists: { 'pane-1': [] },
      closedTabs: [],
    })
    vi.mocked(window.api.readFile).mockReset()
  })

  it('reloads a clean tab whose content changed on disk', async () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: 'old', dirty: false })
    vi.mocked(window.api.readFile).mockResolvedValue('changed by agent')

    await syncOpenTabsFromDisk()

    const tab = useEditorStore.getState().tabs[0]
    expect(tab.content).toBe('changed by agent')
    expect(tab.dirty).toBe(false)
  })

  it('does not read or touch a dirty tab', async () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: 'old', dirty: false })
    useEditorStore.getState().updateContent('/a.ts', 'unsaved user edit')

    await syncOpenTabsFromDisk()

    expect(window.api.readFile).not.toHaveBeenCalled()
    expect(useEditorStore.getState().tabs[0].content).toBe('unsaved user edit')
  })

  it('skips read-only/virtual tabs like terminals and git diffs', async () => {
    useEditorStore.getState().openTab({ path: 'terminal://1', content: '', dirty: false })
    useEditorStore.getState().openTab({ path: 'git-diff://staged//a.ts', content: '', dirty: false })

    await syncOpenTabsFromDisk()

    expect(window.api.readFile).not.toHaveBeenCalled()
  })

  it('leaves the tab untouched when the file is unreadable (e.g. deleted)', async () => {
    useEditorStore.getState().openTab({ path: '/a.ts', content: 'old', dirty: false })
    vi.mocked(window.api.readFile).mockRejectedValue(new Error('ENOENT'))

    await expect(syncOpenTabsFromDisk()).resolves.toBeUndefined()

    expect(useEditorStore.getState().tabs[0].content).toBe('old')
  })
})
