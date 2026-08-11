import { describe, it, expect } from 'vitest'
import { computeLayout } from '../graphLayout'
import type { GitCommit } from '@/types/index'

function makeCommit(hash: string, parents: string[], refs: string[] = []): GitCommit {
  return { hash, parents, subject: `commit ${hash}`, author: 'Test', date: '2024-01-01T00:00:00Z', refs }
}

describe('computeLayout', () => {
  it('assigns a single commit to lane 0', () => {
    const result = computeLayout([makeCommit('a', [])])
    expect(result).toHaveLength(1)
    expect(result[0].lane).toBe(0)
  })

  it('linear history stays in lane 0', () => {
    const commits = [
      makeCommit('a', ['b']),
      makeCommit('b', ['c']),
      makeCommit('c', []),
    ]
    const result = computeLayout(commits)
    expect(result[0].lane).toBe(0)
    expect(result[1].lane).toBe(0)
    expect(result[2].lane).toBe(0)
  })

  it('branch head gets a new lane', () => {
    const commits = [
      makeCommit('a', ['c']),
      makeCommit('b', ['c']),
      makeCommit('c', []),
    ]
    const result = computeLayout(commits)
    expect(result[0].lane).toBe(0)
    expect(result[1].lane).toBe(1)
    expect(result[2].lane).toBe(0)
  })

  it('merge commit creates a branch-out edge for the second parent', () => {
    const commits = [
      makeCommit('a', ['b', 'c']),
      makeCommit('b', ['d']),
      makeCommit('c', ['d']),
      makeCommit('d', []),
    ]
    const result = computeLayout(commits)
    const mergeRow = result[0]
    const branchOutEdge = mergeRow.edges.find(
      (e) => e.fromLane === mergeRow.lane && e.toLane !== mergeRow.lane
    )
    expect(branchOutEdge).toBeDefined()
  })

  it('each layout row has a color', () => {
    const result = computeLayout([makeCommit('a', ['b']), makeCommit('b', [])])
    for (const row of result) {
      expect(row.color).toBeTruthy()
    }
  })

  it('totalLanes is at least 1', () => {
    const result = computeLayout([makeCommit('a', [])])
    expect(result[0].totalLanes).toBeGreaterThanOrEqual(1)
  })

  it('pass-through lanes get straight edges', () => {
    // a → b → c, and x → b (so when rendering 'a', lane 1 should pass through)
    const commits = [
      makeCommit('a', ['b']),
      makeCommit('x', ['b']),
      makeCommit('b', []),
    ]
    const layouts = computeLayout(commits)
    // Row for 'x' (index 1) should have a pass-through for lane 0
    const xRow = layouts[1]
    const passThrough = xRow.edges.find((e) => e.fromLane === e.toLane && e.fromLane !== xRow.lane)
    expect(passThrough).toBeDefined()
  })

  it('root commit has no continuation edge if no parents', () => {
    const result = computeLayout([makeCommit('a', [])])
    // Lane 0 should have no edges (no parents, no pass-throughs)
    expect(result[0].edges).toHaveLength(0)
  })

  it('draws both the merge-in and branch-out edges when a merge\'s extra parent reuses a lane freed by an incoming convergence on the same row', () => {
    // Regression test: 'x' and 'f' both converge into 'm' on the same row
    // (lanes 0 and 1 are both waiting for 'm'). 'm' is itself a merge, and
    // its second parent 's' lands in lane 1 — the very lane that just
    // converged in. Both the merge-in (1->0) and the branch-out (0->1) must
    // be drawn, or nothing visually connects 'm' down to 's' in the row
    // below (previously the merge-in silently swallowed the branch-out).
    const commits = [
      makeCommit('x', ['m']),
      makeCommit('f', ['m']),
      makeCommit('m', ['p', 's']),
      makeCommit('p', []),
      makeCommit('s', []),
    ]
    const result = computeLayout(commits)
    const mergeRow = result[2]
    expect(mergeRow.commit.hash).toBe('m')
    expect(mergeRow.lane).toBe(0)

    const mergeIn = mergeRow.edges.find((e) => e.fromLane === 1 && e.toLane === 0)
    const branchOut = mergeRow.edges.find((e) => e.fromLane === 0 && e.toLane === 1)
    expect(mergeIn).toBeDefined()
    expect(branchOut).toBeDefined()

    // The row for 's' (the reused parent) should start in lane 1, matching
    // the branch-out edge's target — otherwise it's a lane with no edge
    // connecting it to anything above.
    const secondParentRow = result[4]
    expect(secondParentRow.commit.hash).toBe('s')
    expect(secondParentRow.lane).toBe(1)
  })
})
