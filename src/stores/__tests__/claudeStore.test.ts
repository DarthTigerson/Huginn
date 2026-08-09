import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
})

import { useClaudeStore } from '../claudeStore'

describe('claudeStore selection hand-off', () => {
  beforeEach(() => {
    useClaudeStore.setState({ chatVisible: true, pendingInjection: null, focusToken: 0 })
  })

  it('sendSelection opens the panel, sets pendingInjection, and bumps focusToken', () => {
    useClaudeStore.setState({ chatVisible: false })
    useClaudeStore.getState().sendSelection('In src/foo.ts (line 1):\n```ts\ncode\n```')

    const state = useClaudeStore.getState()
    expect(state.chatVisible).toBe(true)
    expect(state.pendingInjection).toBe('In src/foo.ts (line 1):\n```ts\ncode\n```')
    expect(state.focusToken).toBe(1)
  })

  it('focusChat opens the panel and bumps focusToken without setting pendingInjection', () => {
    useClaudeStore.setState({ chatVisible: false })
    useClaudeStore.getState().focusChat()

    const state = useClaudeStore.getState()
    expect(state.chatVisible).toBe(true)
    expect(state.pendingInjection).toBeNull()
    expect(state.focusToken).toBe(1)
  })

  it('focusChat leaves an already-open panel open (never closes it)', () => {
    useClaudeStore.getState().focusChat()
    expect(useClaudeStore.getState().chatVisible).toBe(true)
  })

  it('consumeInjection clears pendingInjection', () => {
    useClaudeStore.getState().sendSelection('text')
    useClaudeStore.getState().consumeInjection()
    expect(useClaudeStore.getState().pendingInjection).toBeNull()
  })

  it('bumps focusToken further on each subsequent call', () => {
    useClaudeStore.getState().sendSelection('first')
    useClaudeStore.getState().sendSelection('second')

    const state = useClaudeStore.getState()
    expect(state.focusToken).toBe(2)
    expect(state.pendingInjection).toBe('second')
  })
})
