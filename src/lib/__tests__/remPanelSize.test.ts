import { describe, it, expect, beforeEach } from 'vitest'
import { SIDEBAR_PANEL, CHAT_PANEL, clampRem, remToPercent, percentToRem, percentLimits, loadRem } from '../remPanelSize'

const store: Record<string, string> = {}
;(global as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v },
}

beforeEach(() => Object.keys(store).forEach((k) => delete store[k]))

describe('remPanelSize', () => {
  it('defaults the side panel to 18rem and the chat panel to 32rem', () => {
    expect(SIDEBAR_PANEL.defaultRem).toBe(18)
    expect(CHAT_PANEL.defaultRem).toBe(32)
  })

  it('converts rem to a share of the panel group and back', () => {
    // 18rem at a 16px root = 288px of a 1440px group = 20%.
    expect(remToPercent(18, 1440, 16)).toBeCloseTo(20)
    expect(percentToRem(20, 1440, 16)).toBeCloseTo(18)
  })

  it('keeps the same pixel width when the window grows, so the percentage drops', () => {
    expect(remToPercent(18, 2880, 16)).toBeCloseTo(10)
  })

  it('grows with the text size', () => {
    // Bigger text = bigger root font = the same 18rem is more pixels.
    expect(remToPercent(18, 1440, 20)).toBeCloseTo(25)
  })

  it('clamps to the rem limits and never past half the group', () => {
    expect(clampRem(4, SIDEBAR_PANEL, 1440, 16)).toBe(SIDEBAR_PANEL.minRem)
    expect(clampRem(39, SIDEBAR_PANEL, 4000, 16)).toBe(39)
    expect(clampRem(39, SIDEBAR_PANEL, 1000, 16)).toBeCloseTo(1000 * 0.5 / 16)
  })

  it('gives min and max as percentages for the panel library', () => {
    // 1600px group at 16px: the 40rem cap (640px) is under half the group.
    const wide = percentLimits(SIDEBAR_PANEL, 1600, 16)
    expect(wide.min).toBeCloseTo((12 * 16) / 1600 * 100)
    expect(wide.max).toBeCloseTo(40)
    // 1000px group: half the group (500px) is under the 40rem cap.
    expect(percentLimits(SIDEBAR_PANEL, 1000, 16).max).toBeCloseTo(50)
  })

  it('reports no size while the group has not been measured', () => {
    expect(remToPercent(18, 0, 16)).toBe(0)
    expect(percentToRem(20, 0, 16)).toBe(0)
  })

  it('loads a saved width, falling back to the default when unset or garbage', () => {
    expect(loadRem('k', SIDEBAR_PANEL)).toBe(18)
    store.k = '22.5'
    expect(loadRem('k', SIDEBAR_PANEL)).toBe(22.5)
    store.k = '999'
    expect(loadRem('k', SIDEBAR_PANEL)).toBe(SIDEBAR_PANEL.maxRem)
    store.k = 'nope'
    expect(loadRem('k', SIDEBAR_PANEL)).toBe(18)
  })
})
