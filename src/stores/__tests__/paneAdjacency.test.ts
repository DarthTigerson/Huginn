import { describe, it, expect } from 'vitest'
import { findAdjacentPane, type EditorLayoutNode } from '../editorStore'

describe('findAdjacentPane', () => {
  it('returns null when there is only one pane', () => {
    const layout: EditorLayoutNode = { type: 'pane', id: 'pane-1' }
    expect(findAdjacentPane(layout, 'pane-1', 'right')).toBeNull()
    expect(findAdjacentPane(layout, 'pane-1', 'left')).toBeNull()
    expect(findAdjacentPane(layout, 'pane-1', 'up')).toBeNull()
    expect(findAdjacentPane(layout, 'pane-1', 'down')).toBeNull()
  })

  describe('a simple two-pane horizontal split (pane-1 | pane-2)', () => {
    const layout: EditorLayoutNode = {
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'pane', id: 'pane-1' },
        { type: 'pane', id: 'pane-2' },
      ],
    }

    it('finds the pane to the right', () => {
      expect(findAdjacentPane(layout, 'pane-1', 'right')).toBe('pane-2')
    })

    it('finds the pane to the left', () => {
      expect(findAdjacentPane(layout, 'pane-2', 'left')).toBe('pane-1')
    })

    it('has no pane to the left of the leftmost pane', () => {
      expect(findAdjacentPane(layout, 'pane-1', 'left')).toBeNull()
    })

    it('has no pane above/below on the wrong axis', () => {
      expect(findAdjacentPane(layout, 'pane-1', 'up')).toBeNull()
      expect(findAdjacentPane(layout, 'pane-1', 'down')).toBeNull()
    })
  })

  describe('a simple two-pane vertical split (pane-1 above pane-2)', () => {
    const layout: EditorLayoutNode = {
      type: 'split',
      direction: 'vertical',
      children: [
        { type: 'pane', id: 'pane-1' },
        { type: 'pane', id: 'pane-2' },
      ],
    }

    it('finds the pane below', () => {
      expect(findAdjacentPane(layout, 'pane-1', 'down')).toBe('pane-2')
    })

    it('finds the pane above', () => {
      expect(findAdjacentPane(layout, 'pane-2', 'up')).toBe('pane-1')
    })
  })

  describe('nested layout: pane-1 | (pane-2 above pane-3)', () => {
    const layout: EditorLayoutNode = {
      type: 'split',
      direction: 'horizontal',
      children: [
        { type: 'pane', id: 'pane-1' },
        {
          type: 'split',
          direction: 'vertical',
          children: [
            { type: 'pane', id: 'pane-2' },
            { type: 'pane', id: 'pane-3' },
          ],
        },
      ],
    }

    it('crossing right from pane-1 lands on a representative pane in the nested column (top one, by convention)', () => {
      expect(findAdjacentPane(layout, 'pane-1', 'right')).toBe('pane-2')
    })

    it('both panes in the right column find pane-1 to their left', () => {
      expect(findAdjacentPane(layout, 'pane-2', 'left')).toBe('pane-1')
      expect(findAdjacentPane(layout, 'pane-3', 'left')).toBe('pane-1')
    })

    it('pane-2 finds pane-3 below it within the same column', () => {
      expect(findAdjacentPane(layout, 'pane-2', 'down')).toBe('pane-3')
    })
  })

  describe('nested layout: (pane-1 | pane-2) above pane-3', () => {
    const layout: EditorLayoutNode = {
      type: 'split',
      direction: 'vertical',
      children: [
        {
          type: 'split',
          direction: 'horizontal',
          children: [
            { type: 'pane', id: 'pane-1' },
            { type: 'pane', id: 'pane-2' },
          ],
        },
        { type: 'pane', id: 'pane-3' },
      ],
    }

    it('both top panes find pane-3 below, crossing up through the horizontal split', () => {
      expect(findAdjacentPane(layout, 'pane-1', 'down')).toBe('pane-3')
      expect(findAdjacentPane(layout, 'pane-2', 'down')).toBe('pane-3')
    })

    it('pane-3 crossing up lands on a representative pane in the row above (leftmost, by convention)', () => {
      expect(findAdjacentPane(layout, 'pane-3', 'up')).toBe('pane-1')
    })
  })
})
