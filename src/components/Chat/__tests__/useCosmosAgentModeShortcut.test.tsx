import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCosmosAgentModeShortcut } from '../useCosmosAgentModeShortcut'
import { useCosmosStore } from '@/stores/cosmosStore'

beforeEach(() => {
  useCosmosStore.setState({ agentMode: false })
})

describe('useCosmosAgentModeShortcut', () => {
  it('toggles agentMode on Shift+Tab', () => {
    renderHook(() => useCosmosAgentModeShortcut())

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
    window.dispatchEvent(event)

    expect(useCosmosStore.getState().agentMode).toBe(true)
  })

  it('prevents the default Tab focus-move behavior', () => {
    renderHook(() => useCosmosAgentModeShortcut())

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('does not toggle on plain Tab (no shift)', () => {
    renderHook(() => useCosmosAgentModeShortcut())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false }))

    expect(useCosmosStore.getState().agentMode).toBe(false)
  })

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useCosmosAgentModeShortcut())
    unmount()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))

    expect(useCosmosStore.getState().agentMode).toBe(false)
  })
})
