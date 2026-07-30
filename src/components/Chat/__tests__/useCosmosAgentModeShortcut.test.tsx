import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCosmosAgentModeShortcut } from '../useCosmosAgentModeShortcut'
import { useCosmosStore } from '@/stores/cosmosStore'
import { useClaudeStore } from '@/stores/claudeStore'

beforeEach(() => {
  useCosmosStore.setState({ agentMode: false })
  useClaudeStore.setState({ assistant: 'cosmos', chatVisible: true })
})

describe('useCosmosAgentModeShortcut', () => {
  it('toggles agentMode on Shift+Tab when the Cosmos panel is visible', () => {
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

  it('does not toggle when the chat panel is collapsed (chatVisible false)', () => {
    useClaudeStore.setState({ chatVisible: false })
    renderHook(() => useCosmosAgentModeShortcut())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))

    expect(useCosmosStore.getState().agentMode).toBe(false)
  })

  it('does not toggle when a different assistant is active', () => {
    useClaudeStore.setState({ assistant: 'claude' })
    renderHook(() => useCosmosAgentModeShortcut())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))

    expect(useCosmosStore.getState().agentMode).toBe(false)
  })

  it('re-arms the listener once visibility is restored', () => {
    useClaudeStore.setState({ chatVisible: false })
    const { rerender } = renderHook(() => useCosmosAgentModeShortcut())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    expect(useCosmosStore.getState().agentMode).toBe(false)

    act(() => {
      useClaudeStore.setState({ chatVisible: true })
    })
    rerender()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    expect(useCosmosStore.getState().agentMode).toBe(true)
  })
})
