import { describe, it, expect, beforeEach } from 'vitest'
import { useTabDragStore } from '../tabDragStore'

describe('tabDragStore', () => {
  beforeEach(() => useTabDragStore.setState({ dragging: null }))

  it('defaults to no drag in progress', () => {
    expect(useTabDragStore.getState().dragging).toBeNull()
  })

  it('startDrag records the path and source pane', () => {
    useTabDragStore.getState().startDrag('/a.ts', 'pane-1')
    expect(useTabDragStore.getState().dragging).toEqual({ path: '/a.ts', sourcePaneId: 'pane-1' })
  })

  it('endDrag clears it', () => {
    useTabDragStore.getState().startDrag('/a.ts', 'pane-1')
    useTabDragStore.getState().endDrag()
    expect(useTabDragStore.getState().dragging).toBeNull()
  })
})
