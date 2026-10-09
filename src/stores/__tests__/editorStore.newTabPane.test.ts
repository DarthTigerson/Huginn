import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  const data = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
})

vi.mock('@/lib/paneLayout', () => ({ getBiggestPaneId: vi.fn(() => 'pane-2') }))
vi.mock('@/lib/notifySettingChanged', () => ({ notifySettingChanged: vi.fn() }))

import { useEditorStore } from '../editorStore'
import { useGeneralSettingsStore } from '../generalSettingsStore'
import { getBiggestPaneId } from '@/lib/paneLayout'

beforeEach(() => {
  useEditorStore.setState({
    tabs: [],
    activeTabPath: null,
    layout: {
      type: 'split',
      direction: 'horizontal',
      children: [{ type: 'pane', id: 'pane-1' }, { type: 'pane', id: 'pane-2' }],
    } as never,
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': null, 'pane-2': null },
    paneTabLists: { 'pane-1': [], 'pane-2': [] },
    closedTabs: [],
  })
  vi.mocked(getBiggestPaneId).mockReturnValue('pane-2')
})

const tab = (path: string) => ({ path, content: '', dirty: false })

describe('Open new tabs in (Settings › General)', () => {
  it('opens a new tab in the biggest window', () => {
    useGeneralSettingsStore.setState({ newTabPane: 'biggest' })
    useEditorStore.getState().openTab(tab('/a.ts'))
    expect(useEditorStore.getState().paneTabLists['pane-2']).toContain('/a.ts')
    expect(useEditorStore.getState().activePaneId).toBe('pane-2')
  })

  it('opens a new tab in the active window', () => {
    useGeneralSettingsStore.setState({ newTabPane: 'active' })
    useEditorStore.getState().openTab(tab('/a.ts'))
    expect(useEditorStore.getState().paneTabLists['pane-1']).toContain('/a.ts')
    expect(useEditorStore.getState().activePaneId).toBe('pane-1')
  })

  it('keeps a tab that is already open in its own window', () => {
    useGeneralSettingsStore.setState({ newTabPane: 'active' })
    useEditorStore.getState().openTab(tab('/a.ts'))
    useGeneralSettingsStore.setState({ newTabPane: 'biggest' })
    useEditorStore.getState().openTab(tab('/a.ts'))
    expect(useEditorStore.getState().paneTabLists['pane-2']).not.toContain('/a.ts')
    expect(useEditorStore.getState().activePaneId).toBe('pane-1')
  })

  it('falls back to the active window when the biggest one is unknown', () => {
    useGeneralSettingsStore.setState({ newTabPane: 'biggest' })
    vi.mocked(getBiggestPaneId).mockReturnValue('pane-gone')
    useEditorStore.getState().openTab(tab('/a.ts'))
    vi.mocked(getBiggestPaneId).mockReturnValue(null)
    useEditorStore.getState().openTab(tab('/b.ts'))
    expect(useEditorStore.getState().paneTabLists['pane-1']).toEqual(['/a.ts', '/b.ts'])
  })

  it('sends Cmd+N scratch tabs to the chosen window, but keeps a tab bar double-click in its own', () => {
    useGeneralSettingsStore.setState({ newTabPane: 'biggest' })
    useEditorStore.getState().openScratchTab()
    expect(useEditorStore.getState().paneTabLists['pane-2']).toHaveLength(1)
    useEditorStore.getState().openScratchTab('pane-1')
    expect(useEditorStore.getState().paneTabLists['pane-1']).toHaveLength(1)
  })
})
