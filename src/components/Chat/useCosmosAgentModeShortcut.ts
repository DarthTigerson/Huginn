import { useEffect } from 'react'
import { useCosmosStore } from '@/stores/cosmosStore'

export function useCosmosAgentModeShortcut(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !e.shiftKey) return
      e.preventDefault()
      useCosmosStore.getState().toggleAgentMode()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
