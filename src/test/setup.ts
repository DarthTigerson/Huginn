// Global test setup for component tests.
//
// Problem: @testing-library/user-event v14's direct API (userEvent.click etc.)
// uses setTimeout(fn, 0) internally. With vi.useFakeTimers() active,
// globalThis.setTimeout is replaced by a fake that never fires unless manually
// advanced. This causes userEvent.click() to hang and time out.
//
// Fix: intercept vi.useFakeTimers() so that after fake timers are installed,
// we wrap globalThis.setTimeout to short-circuit delay=0 calls via queueMicrotask
// instead of the fake timer queue. This lets userEvent proceed without needing
// manual timer advancement for its internal 0ms waits.

import { beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

beforeEach(() => {
  // Wrap vi.useFakeTimers so that whenever a test calls it, we immediately
  // patch globalThis.setTimeout to bypass fake timers for delay=0 calls.
  const origUseFakeTimers = vi.useFakeTimers.bind(vi)
  vi.useFakeTimers = function (...args: Parameters<typeof vi.useFakeTimers>) {
    const result = origUseFakeTimers(...args)
    // At this point globalThis.setTimeout is the vitest fake. Wrap it so that
    // delay=0 calls resolve via queueMicrotask and don't enter the fake queue.
    const fakeSetTimeout = globalThis.setTimeout as unknown as (
      fn: (...a: unknown[]) => void,
      delay: number,
      ...rest: unknown[]
    ) => ReturnType<typeof setTimeout>
    ;(globalThis as typeof globalThis & { setTimeout: unknown }).setTimeout =
      function patchedSetTimeout(
        fn: (...a: unknown[]) => void,
        delay: number,
        ...rest: unknown[]
      ) {
        if (delay === 0) {
          queueMicrotask(() => fn(...rest))
          return 0 as unknown as ReturnType<typeof setTimeout>
        }
        return fakeSetTimeout(fn, delay, ...rest)
      }
    return result
  }
})

// Auto-cleanup React trees after each test
afterEach(() => {
  cleanup()
})
