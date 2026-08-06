import { describe, it, expect, beforeEach } from 'vitest'
import { useBrowserStore } from '../browserStore'

describe('browserStore', () => {
  beforeEach(() => {
    useBrowserStore.setState({ tabs: {} })
  })

  it('ensureTab defaults zoomLevel to 0', () => {
    useBrowserStore.getState().ensureTab('tab-1', 'https://example.com')
    expect(useBrowserStore.getState().tabs['tab-1'].zoomLevel).toBe(0)
  })

  it('updateTab can set zoomLevel without disturbing other fields', () => {
    useBrowserStore.getState().ensureTab('tab-1', 'https://example.com')
    useBrowserStore.getState().updateTab('tab-1', { zoomLevel: 3 })
    const tab = useBrowserStore.getState().tabs['tab-1']
    expect(tab.zoomLevel).toBe(3)
    expect(tab.url).toBe('https://example.com')
  })
})
