// src/components/Graphify/__tests__/graphLayout.test.ts
import { describe, it, expect } from 'vitest'
import { computeGraphLayout } from '../graphLayout'
import type { GraphifyNode, GraphifyLink } from '@/types/graphify'

const nodes: GraphifyNode[] = [
  { id: 'src_main', label: 'main.py', file_type: 'code', source_file: 'src/main.py', source_location: 'L1', _origin: 'ast', community: 0 },
  { id: 'src_main_compute', label: 'compute()', file_type: 'code', source_file: 'src/main.py', source_location: 'L3', _origin: 'ast', _callable: true, community: 0 },
  { id: 'src_math_utils', label: 'math_utils.py', file_type: 'code', source_file: 'src/math_utils.py', source_location: 'L1', _origin: 'ast', community: 0 },
]

const links: GraphifyLink[] = [
  { source: 'src_main', target: 'src_main_compute', relation: 'contains', confidence: 'EXTRACTED', confidence_score: 1, source_file: 'src/main.py', source_location: 'L3', weight: 1, _origin: 'ast' },
  { source: 'src_main', target: 'src_math_utils', relation: 'imports_from', context: 'import', confidence: 'EXTRACTED', confidence_score: 1, source_file: 'src/main.py', source_location: 'L1', weight: 1, _origin: 'ast' },
]

describe('computeGraphLayout', () => {
  it('returns one positioned node per input node, with finite coordinates', () => {
    const { nodes: positioned } = computeGraphLayout(nodes, links, 800, 600)

    expect(positioned).toHaveLength(3)
    for (const n of positioned) {
      expect(Number.isFinite(n.x)).toBe(true)
      expect(Number.isFinite(n.y)).toBe(true)
    }
  })

  it('preserves node fields alongside the computed position', () => {
    const { nodes: positioned } = computeGraphLayout(nodes, links, 800, 600)
    const compute = positioned.find((n) => n.id === 'src_main_compute')

    expect(compute).toMatchObject({ id: 'src_main_compute', label: 'compute()', _callable: true })
  })

  it('resolves link source/target ids to the corresponding positioned nodes', () => {
    const { links: positionedLinks } = computeGraphLayout(nodes, links, 800, 600)

    expect(positionedLinks).toHaveLength(2)
    const first = positionedLinks[0]
    expect(first.source.id).toBe('src_main')
    expect(first.target.id).toBe('src_main_compute')
    expect(first.link.relation).toBe('contains')
  })

  it('is deterministic for the same inputs', () => {
    const a = computeGraphLayout(nodes, links, 800, 600)
    const b = computeGraphLayout(nodes, links, 800, 600)

    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(b.nodes.map((n) => [n.x, n.y]))
  })

  it('handles an empty graph without throwing', () => {
    const { nodes: positioned, links: positionedLinks } = computeGraphLayout([], [], 800, 600)
    expect(positioned).toEqual([])
    expect(positionedLinks).toEqual([])
  })
})
