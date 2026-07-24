import { describe, it, expect, beforeEach } from 'vitest'
import { useSearchStore } from '../searchStore'

describe('searchStore shortcuts overlay', () => {
  beforeEach(() => useSearchStore.setState({ shortcutsOverlayOpen: false }))

  it('starts closed', () => {
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('openShortcutsOverlay sets it true', () => {
    useSearchStore.getState().openShortcutsOverlay()
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)
  })

  it('closeShortcutsOverlay sets it false', () => {
    useSearchStore.setState({ shortcutsOverlayOpen: true })
    useSearchStore.getState().closeShortcutsOverlay()
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })
})
