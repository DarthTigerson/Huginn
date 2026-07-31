import { useEffect, useRef } from 'react'
import { useSearchStore } from '@/stores/searchStore'

const DOUBLE_TAP_MS = 300

export function useHoldToShowShortcuts() {
  const lastReleaseRef = useRef<number>(0)

  useEffect(() => {
    function closeIfOpen() {
      if (useSearchStore.getState().shortcutsOverlayOpen) {
        useSearchStore.getState().closeShortcutsOverlay()
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      const isModifier = e.key === 'Meta' || e.key === 'Control'

      if (isModifier) {
        const now = Date.now()
        if (lastReleaseRef.current > 0 && now - lastReleaseRef.current <= DOUBLE_TAP_MS) {
          lastReleaseRef.current = 0
          const { commandPaletteOpen, searchOpen, actionPaletteOpen, shortcutsOverlayOpen, openShortcutsOverlay, closeShortcutsOverlay } =
            useSearchStore.getState()
          if (shortcutsOverlayOpen) {
            closeShortcutsOverlay()
          } else if (!commandPaletteOpen && !searchOpen && !actionPaletteOpen) {
            openShortcutsOverlay()
          }
        }
        return
      }

      // Any non-modifier key cancels the tap sequence and closes the overlay
      lastReleaseRef.current = 0
      closeIfOpen()
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Meta' || e.key === 'Control') {
        lastReleaseRef.current = Date.now()
      }
    }

    function onBlur() {
      lastReleaseRef.current = 0
      closeIfOpen()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
