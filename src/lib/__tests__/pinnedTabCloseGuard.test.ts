import { describe, it, expect } from 'vitest'
import { evaluateCmdWForPinnedTab } from '../pinnedTabCloseGuard'

describe('evaluateCmdWForPinnedTab', () => {
  it('closes immediately when the tab is not pinned', () => {
    const result = evaluateCmdWForPinnedTab('/a.ts', false, null, 1000)
    expect(result).toEqual({ shouldClose: true, nextPending: null })
  })

  it('does not close a pinned tab on the first press, and remembers the attempt', () => {
    const result = evaluateCmdWForPinnedTab('/a.ts', true, null, 1000)
    expect(result.shouldClose).toBe(false)
    expect(result.nextPending).toEqual({ path: '/a.ts', at: 1000 })
  })

  it('closes a pinned tab on a second press within the threshold', () => {
    const pending = { path: '/a.ts', at: 1000 }
    const result = evaluateCmdWForPinnedTab('/a.ts', true, pending, 1300)
    expect(result).toEqual({ shouldClose: true, nextPending: null })
  })

  it('does not close on a second press after the threshold has elapsed - treats it as a fresh first press', () => {
    const pending = { path: '/a.ts', at: 1000 }
    const result = evaluateCmdWForPinnedTab('/a.ts', true, pending, 1700)
    expect(result.shouldClose).toBe(false)
    expect(result.nextPending).toEqual({ path: '/a.ts', at: 1700 })
  })

  it('does not treat a pending press on a different pinned tab as a second press for this one', () => {
    const pending = { path: '/other.ts', at: 1000 }
    const result = evaluateCmdWForPinnedTab('/a.ts', true, pending, 1200)
    expect(result.shouldClose).toBe(false)
    expect(result.nextPending).toEqual({ path: '/a.ts', at: 1200 })
  })
})
