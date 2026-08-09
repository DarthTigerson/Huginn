import { describe, it, expect, beforeEach } from 'vitest'
import { clampSize, loadPanelSize } from '../panelSize'

const store: Record<string, string> = {}
;(global as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v },
}

describe('clampSize', () => {
  it('passes values already within bounds through unchanged', () => {
    expect(clampSize(20, 4, 40)).toBe(20)
  })

  it('clamps below the minimum', () => {
    expect(clampSize(1, 4, 40)).toBe(4)
  })

  it('clamps above the maximum', () => {
    expect(clampSize(90, 4, 40)).toBe(40)
  })
})

describe('loadPanelSize', () => {
  const KEY = 'test:panelSize'

  beforeEach(() => {
    delete store[KEY]
  })

  it('falls back to the default when nothing has been stored yet', () => {
    // Regression guard: localStorage.getItem returns null when unset, and
    // Number(null) is 0 — a naive `Number.isFinite(Number(raw))` check would
    // treat that as a valid stored 0 and clamp to `min` instead.
    expect(loadPanelSize(KEY, 26, 4, 40)).toBe(26)
  })

  it('uses a previously stored size, clamped to bounds', () => {
    store[KEY] = '35'
    expect(loadPanelSize(KEY, 26, 4, 40)).toBe(35)
  })

  it('clamps a stored size above the max', () => {
    store[KEY] = '90'
    expect(loadPanelSize(KEY, 26, 4, 40)).toBe(40)
  })

  it('falls back to the default for a corrupt stored value', () => {
    store[KEY] = 'not-a-number'
    expect(loadPanelSize(KEY, 26, 4, 40)).toBe(26)
  })
})
