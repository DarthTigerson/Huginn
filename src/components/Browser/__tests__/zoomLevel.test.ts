import { describe, it, expect } from 'vitest'
import { zoomLevelToPercent } from '../zoomLevel'

describe('zoomLevelToPercent', () => {
  it('returns 100 for level 0', () => {
    expect(zoomLevelToPercent(0)).toBe(100)
  })

  it('returns 120 for level 1', () => {
    expect(zoomLevelToPercent(1)).toBe(120)
  })

  it('returns 83 for level -1', () => {
    expect(zoomLevelToPercent(-1)).toBe(83)
  })

  it('returns 144 for level 2', () => {
    expect(zoomLevelToPercent(2)).toBe(144)
  })

  it('matches the min/max clamp levels used by the keyboard shortcut and menu (-8..9)', () => {
    expect(zoomLevelToPercent(9)).toBe(516)
    expect(zoomLevelToPercent(-8)).toBe(23)
  })
})
