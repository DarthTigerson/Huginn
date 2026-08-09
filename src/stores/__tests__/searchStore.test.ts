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

describe('searchStore recent projects palette', () => {
  beforeEach(() => useSearchStore.setState({ recentProjectsPaletteOpen: false }))

  it('starts closed', () => {
    expect(useSearchStore.getState().recentProjectsPaletteOpen).toBe(false)
  })

  it('openRecentProjectsPalette sets it true', () => {
    useSearchStore.getState().openRecentProjectsPalette()
    expect(useSearchStore.getState().recentProjectsPaletteOpen).toBe(true)
  })

  it('closeRecentProjectsPalette sets it false', () => {
    useSearchStore.setState({ recentProjectsPaletteOpen: true })
    useSearchStore.getState().closeRecentProjectsPalette()
    expect(useSearchStore.getState().recentProjectsPaletteOpen).toBe(false)
  })
})
