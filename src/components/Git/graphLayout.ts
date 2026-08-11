import type { GitCommit } from '@/types/index'

export const LANE_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#facc15',
  '#06b6d4',
  '#f97316',
  '#9333ea',
  '#ec4899',
]

export interface RowEdge {
  fromLane: number
  toLane: number
  color: string
}

export interface CommitLayout {
  commit: GitCommit
  lane: number
  color: string
  totalLanes: number
  edges: RowEdge[]
}

type Lane = { hash: string; color: string } | null

export function computeLayout(commits: GitCommit[]): CommitLayout[] {
  const lanes: Lane[] = []
  const result: CommitLayout[] = []

  for (const commit of commits) {
    const { hash, parents } = commit

    // Find all lanes currently waiting for this commit's hash
    const incomingIndices: number[] = []
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i]?.hash === hash) incomingIndices.push(i)
    }

    // The commit sits in the first incoming lane, or a new/free lane for branch heads
    let commitLane: number
    if (incomingIndices.length > 0) {
      commitLane = incomingIndices[0]
    } else {
      commitLane = lanes.findIndex((l) => l === null)
      if (commitLane === -1) {
        commitLane = lanes.length
        lanes.push(null)
      }
    }

    const commitColor =
      lanes[commitLane]?.color ?? LANE_COLORS[commitLane % LANE_COLORS.length]

    // Snapshot state before updates (for edge computation)
    const lanesBefore: Lane[] = lanes.map((l) => (l ? { ...l } : null))

    // Clear all incoming lanes
    for (const idx of incomingIndices) {
      lanes[idx] = null
    }

    // Assign first parent to commit lane
    if (parents[0]) {
      lanes[commitLane] = { hash: parents[0], color: commitColor }
    }

    // Assign additional parents to free lanes (branch-out tracking)
    for (let p = 1; p < parents.length; p++) {
      let freeLane = lanes.findIndex((l) => l === null)
      if (freeLane === -1) {
        freeLane = lanes.length
        lanes.push(null)
      }
      lanes[freeLane] = { hash: parents[p], color: LANE_COLORS[freeLane % LANE_COLORS.length] }
    }

    const lanesAfter: Lane[] = lanes.map((l) => (l ? { ...l } : null))
    const totalLanes = Math.max(lanesBefore.length, lanesAfter.length, commitLane + 1)

    const edges: RowEdge[] = []

    for (let i = 0; i < totalLanes; i++) {
      const before = lanesBefore[i] ?? null
      const after = lanesAfter[i] ?? null

      if (i === commitLane) {
        // Straight continuation if first parent continues in same lane
        if (after !== null) {
          edges.push({ fromLane: i, toLane: i, color: commitColor })
        }
        continue
      }

      const isIncoming = incomingIndices.includes(i)

      // A commit is never its own parent, so an incoming lane's before.hash
      // (== this commit's hash) can never match a freshly-assigned parent
      // hash in after — isIncoming and this pass-through case are mutually
      // exclusive already, no extra guard needed.
      if (before !== null && after !== null && before.hash === after.hash) {
        // Pass-through: lane unchanged
        edges.push({ fromLane: i, toLane: i, color: before.color })
        continue
      }

      if (isIncoming) {
        // Merge-in: this lane was waiting for this commit, curves to commitLane
        edges.push({ fromLane: i, toLane: commitLane, color: before!.color })
      }

      // Branch-out: an additional parent now occupies this lane. Checked
      // independently of (not else-if'd against) the merge-in case above,
      // since the freed lane from an incoming merge is frequently the same
      // lane index an extra parent gets assigned to on this very row — both
      // edges are real and need to be drawn, or the second parent's line
      // has nothing connecting it to this commit in the row below.
      if (after !== null && (before === null || isIncoming)) {
        edges.push({ fromLane: commitLane, toLane: i, color: after.color })
      }
    }

    result.push({ commit, lane: commitLane, color: commitColor, totalLanes, edges })
  }

  return result
}
