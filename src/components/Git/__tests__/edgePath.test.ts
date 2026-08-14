import { describe, it, expect } from 'vitest'
import { edgePath, ROW_H } from '../GitGraphPage'
import type { RowEdge } from '../graphLayout'

// Parses "M x1 y1 [L x1 y1] C c1x c1y c2x c2y ex ey [L ...] C c1x c1y c2x c2y ex ey [L ...]"
// into the two cubic segments' numbers, tolerant of an optional lead-in/jog/trail-out.
function parseCubics(d: string): { c1: [number, number]; c2: [number, number]; end: [number, number] }[] {
  const matches = [...d.matchAll(/C ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/g)]
  return matches.map((m) => {
    const [, c1x, c1y, c2x, c2y, ex, ey] = m.map(Number)
    return { c1: [c1x, c1y], c2: [c2x, c2y], end: [ex, ey] }
  })
}

describe('edgePath', () => {
  it('draws a straight line when the edge stays in the same lane', () => {
    const edge: RowEdge = { fromLane: 0, toLane: 0, color: '#000' }
    const d = edgePath(edge, 200, 2, 0, 1)
    expect(d).toBe(`M 80 0 L 80 ${ROW_H}`)
  })

  it('starts and ends a diagonal edge with straight vertical segments before/after the curve', () => {
    // railWidth=200, laneCount=2 -> lane 0 at x=80, lane 1 at x=120
    const edge: RowEdge = { fromLane: 0, toLane: 1, color: '#000' }
    const d = edgePath(edge, 200, 2, 0, 1)
    // r = min(40, 72)/2 = 20, so lead-in to y=16 and trail-out from y=56
    expect(d.startsWith('M 80 0 L 80 16 C')).toBe(true)
    expect(d.endsWith('L 120 72')).toBe(true)
  })

  it('the two curve segments join with matching tangent directions (no kink)', () => {
    // Regression: an earlier version used SVG's native arc command with the
    // same sweep-flag for both halves of the S, which (getting the flag
    // sign wrong for a true S-shape) produced two circles meeting at a
    // corner instead of one smooth flow. A cubic's tangent direction at an
    // endpoint is the vector from that endpoint to its adjacent control
    // point - for a smooth join, curve A's exit tangent and curve B's entry
    // tangent must point the same direction, not just meet at the same spot.
    const edge: RowEdge = { fromLane: 0, toLane: 1, color: '#000' }
    const d = edgePath(edge, 200, 2, 0, 1)
    const [first, second] = parseCubics(d)

    const exitTangent = [first.end[0] - first.c2[0], first.end[1] - first.c2[1]]
    const entryTangent = [second.c1[0] - first.end[0], second.c1[1] - first.end[1]]
    expect(exitTangent[0]).toBeCloseTo(entryTangent[0], 5)
    expect(exitTangent[1]).toBeCloseTo(entryTangent[1], 5)
    // And that shared direction should be purely horizontal (mid-curve, the
    // S is momentarily moving sideways) with a positive magnitude — not a
    // degenerate zero vector, which would also trivially "match".
    expect(exitTangent[1]).toBeCloseTo(0, 5)
    expect(Math.abs(exitTangent[0])).toBeGreaterThan(0)
  })

  it('a merge-in and a branch-out sharing a row (a lane swap) meet at exactly the same point', () => {
    const branchOut: RowEdge = { fromLane: 0, toLane: 1, color: '#000' }
    const mergeIn: RowEdge = { fromLane: 1, toLane: 0, color: '#000' }
    const railWidth = 200
    const laneCount = 2

    const dA = edgePath(branchOut, railWidth, laneCount, 0, 1)
    const dB = edgePath(mergeIn, railWidth, laneCount, 0, 1)

    const [firstA] = parseCubics(dA)
    const [firstB] = parseCubics(dB)
    expect(firstA.end[0]).toBeCloseTo(100, 5)
    expect(firstA.end[1]).toBeCloseTo(36, 5)
    expect(firstB.end[0]).toBeCloseTo(100, 5)
    expect(firstB.end[1]).toBeCloseTo(36, 5)
  })

  it('inserts a straight horizontal jog when lanes are far enough apart that the row height caps the arc radius', () => {
    // railWidth=400, laneCount=4 -> lane 0 and lane 3 are 120px apart (> ROW_H)
    const edge: RowEdge = { fromLane: 0, toLane: 3, color: '#000' }
    const d = edgePath(edge, 400, 4, 0, 1)
    // r = min(120, 72)/2 = 36 (capped by row height), so no vertical lead-in
    // or trail-out, but there IS a horizontal jog at midY between the arcs.
    expect(d.startsWith('M 140 0 C')).toBe(true)
    expect(d).toMatch(/C [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+ 176 36 L 224 36 C/)
    expect(d.endsWith('260 72')).toBe(true)
  })
})
