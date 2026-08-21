import { useEffect } from 'react'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useClaudeStore } from '@/stores/claudeStore'

export function useBridgeAgentModeShortcut(): void {
  const chatVisible = useClaudeStore((s) => s.chatVisible)
  const assistant = useClaudeStore((s) => s.assistant)
  const enabled = chatVisible && assistant === 'bridge'

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !e.shiftKey) return
      e.preventDefault()
      useBridgeStore.getState().toggleAgentMode()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
