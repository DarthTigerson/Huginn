import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  const data = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
  ;(globalThis as { window?: unknown }).window = { api: { readFile: async () => 'content' } }
})

vi.mock('@/lib/paneLayout', () => ({ getBiggestPaneId: () => 'pane-2' }))
vi.mock('@/lib/notifySettingChanged', () => ({ notifySettingChanged: vi.fn() }))

import { openFileAtLocation } from '../openFileLocation'
import { useEditorStore } from '@/stores/editorStore'
import { useGeneralSettingsStore } from '@/stores/generalSettingsStore'

beforeEach(() => {
  useGeneralSettingsStore.setState({ newTabPane: 'biggest' })
  useEditorStore.setState({
    tabs: [],
    activeTabPath: null,
    layout: { type: 'split', direction: 'horizontal', children: [{ type: 'pane', id: 'pane-1' }, { type: 'pane', id: 'pane-2' }] } as never,
    activePaneId: 'pane-1',
    paneTabs: { 'pane-1': null, 'pane-2': null },
    paneTabLists: { 'pane-1': [], 'pane-2': [] },
    closedTabs: [],
  })
})

describe('openFileAtLocation', () => {
  it('follows Open new tabs in by default (search results, terminal links)', async () => {
    await openFileAtLocation('/x.ts', 3, 1)
    expect(useEditorStore.getState().paneTabLists['pane-2']).toContain('/x.ts')
  })

  it('keeps go-to-definition in the window you are working in', async () => {
    await openFileAtLocation('/x.ts', 3, 1, '', { stayInActivePane: true })
    expect(useEditorStore.getState().paneTabLists['pane-1']).toContain('/x.ts')
    expect(useEditorStore.getState().paneTabLists['pane-2']).not.toContain('/x.ts')
  })
})
