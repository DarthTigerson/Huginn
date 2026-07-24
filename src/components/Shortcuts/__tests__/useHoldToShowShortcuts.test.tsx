// src/components/Shortcuts/__tests__/useHoldToShowShortcuts.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useHoldToShowShortcuts } from '../useHoldToShowShortcuts'
import { useSearchStore } from '@/stores/searchStore'

function keydown(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, metaKey: true, bubbles: true }))
}

function keyup(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, metaKey: false, bubbles: true }))
}

describe('useHoldToShowShortcuts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSearchStore.setState({
      commandPaletteOpen: false,
      searchOpen: false,
      searchCaseSensitive: false,
      actionPaletteOpen: false,
      shortcutsOverlayOpen: false,
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('opens the overlay after holding Meta alone for 450ms', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })

    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)
  })

  it('does not open if a non-modifier key is pressed before the delay elapses', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(200)
      keydown('t')
      vi.advanceTimersByTime(450)
    })

    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('closes the overlay when a non-modifier key is pressed while open', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)

    act(() => {
      keydown('t')
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('closes the overlay when Escape is pressed while open', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)

    act(() => {
      keydown('Escape')
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('closes the overlay on Meta keyup', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)

    act(() => {
      keyup('Meta')
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('closes the overlay on window blur', () => {
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })

  it('does not open while the command palette is already open', () => {
    useSearchStore.setState({ commandPaletteOpen: true })
    renderHook(() => useHoldToShowShortcuts())

    act(() => {
      keydown('Meta')
      vi.advanceTimersByTime(450)
    })

    expect(useSearchStore.getState().shortcutsOverlayOpen).toBe(false)
  })
})
