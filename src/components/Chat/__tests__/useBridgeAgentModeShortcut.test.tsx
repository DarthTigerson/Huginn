import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBridgeAgentModeShortcut } from '../useBridgeAgentModeShortcut'
import { useBridgeStore } from '@/stores/bridgeStore'
import { useClaudeStore } from '@/stores/claudeStore'

beforeEach(() => {
  useBridgeStore.setState({ agentMode: false })
  useClaudeStore.setState({ assistant: 'bridge', chatVisible: true })
})

describe('useBridgeAgentModeShortcut', () => {
  it('toggles agentMode on Shift+Tab when the Bridge panel is visible', () => {
    renderHook(() => useBridgeAgentModeShortcut())

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
    window.dispatchEvent(event)

    expect(useBridgeStore.getState().agentMode).toBe(true)
  })

  it('prevents the default Tab focus-move behavior', () => {
    renderHook(() => useBridgeAgentModeShortcut())

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('does not toggle on plain Tab (no shift)', () => {
    renderHook(() => useBridgeAgentModeShortcut())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false }))

    expect(useBridgeStore.getState().agentMode).toBe(false)
  })

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useBridgeAgentModeShortcut())
    unmount()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))

    expect(useBridgeStore.getState().agentMode).toBe(false)
  })

  it('does not toggle when the chat panel is collapsed (chatVisible false)', () => {
    useClaudeStore.setState({ chatVisible: false })
    renderHook(() => useBridgeAgentModeShortcut())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))

    expect(useBridgeStore.getState().agentMode).toBe(false)
  })

  it('does not toggle when a different assistant is active', () => {
    useClaudeStore.setState({ assistant: 'claude' })
    renderHook(() => useBridgeAgentModeShortcut())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))

    expect(useBridgeStore.getState().agentMode).toBe(false)
  })

  it('re-arms the listener once visibility is restored', () => {
    useClaudeStore.setState({ chatVisible: false })
    const { rerender } = renderHook(() => useBridgeAgentModeShortcut())

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    expect(useBridgeStore.getState().agentMode).toBe(false)

    act(() => {
      useClaudeStore.setState({ chatVisible: true })
    })
    rerender()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
    expect(useBridgeStore.getState().agentMode).toBe(true)
  })
})
