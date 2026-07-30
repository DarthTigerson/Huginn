import { useEffect } from 'react'
import { useCosmosStore } from '@/stores/cosmosStore'
import { useClaudeStore } from '@/stores/claudeStore'

export function useCosmosAgentModeShortcut(): void {
  const chatVisible = useClaudeStore((s) => s.chatVisible)
  const assistant = useClaudeStore((s) => s.assistant)
  const enabled = chatVisible && assistant === 'cosmos'

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !e.shiftKey) return
      e.preventDefault()
      useCosmosStore.getState().toggleAgentMode()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
