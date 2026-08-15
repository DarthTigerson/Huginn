import { describe, it, expect } from 'vitest'
import { xFor, yFor, buildLinePoints, buildProjectionLine, nearestSnapshotByTime, USAGE_RANGE_MS } from '../sparkline'

describe('xFor', () => {
  it('maps the start of the window to 0 and the end to 100', () => {
    expect(xFor(1000, 1000, 2000)).toBe(0)
    expect(xFor(2000, 1000, 2000)).toBe(100)
  })

  it('maps the midpoint of the window to 50', () => {
    expect(xFor(1500, 1000, 2000)).toBe(50)
  })
})

describe('yFor', () => {
  it('inverts pct so 0% sits at the bottom (100) and 100% at the top (0)', () => {
    expect(yFor(0)).toBe(100)
    expect(yFor(100)).toBe(0)
    expect(yFor(50)).toBe(50)
  })
})

const sessionPctOf = (s: { sessionPct: number }) => s.sessionPct
const weeklyPctOf = (s: { weeklyPct: number }) => s.weeklyPct

describe('buildLinePoints', () => {
  it('returns an empty string with fewer than two snapshots', () => {
    expect(buildLinePoints([], 0, 1000, sessionPctOf)).toBe('')
    expect(buildLinePoints([{ ts: 0, sessionPct: 10 }], 0, 1000, sessionPctOf)).toBe('')
  })

  it('builds an "x,y x,y" polyline string from snapshots', () => {
    const snaps = [
      { ts: 0, sessionPct: 0 },
      { ts: 1000, sessionPct: 100 },
    ]
    expect(buildLinePoints(snaps, 0, 1000, sessionPctOf)).toBe('0.00,100.00 100.00,0.00')
  })

  it('works with any pct accessor, e.g. weeklyPct', () => {
    const snaps = [
      { ts: 0, weeklyPct: 20 },
      { ts: 1000, weeklyPct: 40 },
    ]
    expect(buildLinePoints(snaps, 0, 1000, weeklyPctOf)).toBe('0.00,80.00 100.00,60.00')
  })
})

describe('buildProjectionLine', () => {
  const lastSnapshot = { ts: 1000, sessionPct: 50 }

  it('returns null when there is no cutoff', () => {
    expect(buildProjectionLine(lastSnapshot, sessionPctOf, null, 0, 2000)).toBeNull()
  })

  it('returns null when there is no last snapshot', () => {
    expect(buildProjectionLine<{ ts: number; sessionPct: number }>(undefined, sessionPctOf, 1500, 0, 2000)).toBeNull()
  })

  it('returns null when the cutoff falls outside the visible window', () => {
    expect(buildProjectionLine(lastSnapshot, sessionPctOf, 5000, 0, 2000)).toBeNull()
    expect(buildProjectionLine(lastSnapshot, sessionPctOf, -100, 0, 2000)).toBeNull()
  })

  it('builds a segment from the last real point to the cutoff at 100%', () => {
    const line = buildProjectionLine(lastSnapshot, sessionPctOf, 1500, 0, 2000)
    expect(line).toEqual({ x1: 50, y1: 50, x2: 75, y2: 0 })
  })
})

describe('USAGE_RANGE_MS', () => {
  it('covers 1h/24h/7d/30d in milliseconds', () => {
    expect(USAGE_RANGE_MS['1h']).toBe(3_600_000)
    expect(USAGE_RANGE_MS['24h']).toBe(86_400_000)
    expect(USAGE_RANGE_MS['7d']).toBe(604_800_000)
    expect(USAGE_RANGE_MS['30d']).toBe(2_592_000_000)
  })
})

describe('nearestSnapshotByTime', () => {
  const snaps = [
    { ts: 0, sessionPct: 10 },
    { ts: 1000, sessionPct: 20 },
    { ts: 3000, sessionPct: 30 },
  ]

  it('returns undefined for an empty series', () => {
    expect(nearestSnapshotByTime([], 500)).toBeUndefined()
  })

  it('returns the snapshot with the closest timestamp', () => {
    expect(nearestSnapshotByTime(snaps, 900)).toEqual({ ts: 1000, sessionPct: 20 })
    expect(nearestSnapshotByTime(snaps, 100)).toEqual({ ts: 0, sessionPct: 10 })
  })

  it('breaks ties by preferring the earlier snapshot', () => {
    expect(nearestSnapshotByTime(snaps, 500)).toEqual({ ts: 0, sessionPct: 10 })
  })
})
