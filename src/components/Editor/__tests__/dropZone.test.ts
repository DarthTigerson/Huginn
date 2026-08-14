import { describe, it, expect } from 'vitest'
import { computeDropZone } from '../dropZone'

// A 200x100 pane at some arbitrary screen offset, to make sure the function
// works off pointer-position-relative-to-rect, not absolute coordinates.
const rect = { left: 50, top: 20, width: 200, height: 100 }

describe('computeDropZone', () => {
  it('returns center for the middle of the pane', () => {
    expect(computeDropZone(rect, 50 + 100, 20 + 50)).toBe('center')
  })

  it('returns left for the outer-left edge', () => {
    expect(computeDropZone(rect, 50 + 10, 20 + 50)).toBe('left')
  })

  it('returns right for the outer-right edge', () => {
    expect(computeDropZone(rect, 50 + 190, 20 + 50)).toBe('right')
  })

  it('returns up for the outer-top edge (middle column)', () => {
    expect(computeDropZone(rect, 50 + 100, 20 + 10)).toBe('up')
  })

  it('returns down for the outer-bottom edge (middle column)', () => {
    expect(computeDropZone(rect, 50 + 100, 20 + 90)).toBe('down')
  })

  it('resolves corners to the left/right edge rather than up/down (left/right checked first)', () => {
    expect(computeDropZone(rect, 50 + 10, 20 + 10)).toBe('left')
    expect(computeDropZone(rect, 50 + 190, 20 + 90)).toBe('right')
  })

  it('treats exactly the 25%/75% boundary as still inside the zone', () => {
    expect(computeDropZone(rect, 50 + 50, 20 + 50)).toBe('left') // exactly 25% of width
    expect(computeDropZone(rect, 50 + 150, 20 + 50)).toBe('right') // exactly 75% of width
  })
})
