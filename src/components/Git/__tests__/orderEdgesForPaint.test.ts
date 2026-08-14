import { describe, it, expect } from 'vitest'
import { orderEdgesForPaint } from '../GitGraphPage'
import type { RowEdge } from '../graphLayout'

describe('orderEdgesForPaint', () => {
  it('renders straight (same-lane) edges after diagonal ones, so a primary pipe never paints under a crossing diagonal', () => {
    const straight: RowEdge = { fromLane: 0, toLane: 0, color: 'blue' }
    const diagonal: RowEdge = { fromLane: 1, toLane: 0, color: 'red' }
    const result = orderEdgesForPaint([straight, diagonal])
    expect(result).toEqual([diagonal, straight])
  })

  it('is a no-op when there are no straight edges', () => {
    const a: RowEdge = { fromLane: 0, toLane: 1, color: 'red' }
    const b: RowEdge = { fromLane: 1, toLane: 0, color: 'blue' }
    expect(orderEdgesForPaint([a, b])).toEqual([a, b])
  })

  it('preserves relative order within each group (stable)', () => {
    const straight1: RowEdge = { fromLane: 0, toLane: 0, color: 'blue' }
    const diagonal1: RowEdge = { fromLane: 1, toLane: 0, color: 'red' }
    const straight2: RowEdge = { fromLane: 2, toLane: 2, color: 'green' }
    const diagonal2: RowEdge = { fromLane: 0, toLane: 1, color: 'blue' }
    const result = orderEdgesForPaint([straight1, diagonal1, straight2, diagonal2])
    expect(result).toEqual([diagonal1, diagonal2, straight1, straight2])
  })

  it('does not mutate the original array', () => {
    const straight: RowEdge = { fromLane: 0, toLane: 0, color: 'blue' }
    const diagonal: RowEdge = { fromLane: 1, toLane: 0, color: 'red' }
    const original = [straight, diagonal]
    orderEdgesForPaint(original)
    expect(original).toEqual([straight, diagonal])
  })
})
