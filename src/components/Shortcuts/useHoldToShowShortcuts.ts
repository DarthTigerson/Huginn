// src/components/Shortcuts/useHoldToShowShortcuts.ts
import { useEffect, useRef } from 'react'
import { useSearchStore } from '@/stores/searchStore'

const HOLD_DELAY_MS = 450
const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt'])

export function useHoldToShowShortcuts() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    function closeIfOpen() {
      if (useSearchStore.getState().shortcutsOverlayOpen) {
        useSearchStore.getState().closeShortcutsOverlay()
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return

      if (MODIFIER_KEYS.has(e.key)) {
        if (timerRef.current === null) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null
            const { commandPaletteOpen, searchOpen, actionPaletteOpen, openShortcutsOverlay } =
              useSearchStore.getState()
            if (!commandPaletteOpen && !searchOpen && !actionPaletteOpen) {
              openShortcutsOverlay()
            }
          }, HOLD_DELAY_MS)
        }
        return
      }

      clearTimer()
      closeIfOpen()
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Meta' || e.key === 'Control') {
        clearTimer()
        closeIfOpen()
      }
    }

    function onBlur() {
      clearTimer()
      closeIfOpen()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      clearTimer()
    }
  }, [])
}
