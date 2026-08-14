import { describe, it, expect, beforeEach } from 'vitest'
import { useTabContextMenuStore } from '../tabContextMenuStore'

describe('tabContextMenuStore', () => {
  beforeEach(() => useTabContextMenuStore.setState({ open: null }))

  it('defaults to no menu open', () => {
    expect(useTabContextMenuStore.getState().open).toBeNull()
  })

  it('openMenu records which pane/tab/position is open', () => {
    useTabContextMenuStore.getState().openMenu('pane-1', '/a.ts', 10, 20)
    expect(useTabContextMenuStore.getState().open).toEqual({ paneId: 'pane-1', path: '/a.ts', x: 10, y: 20 })
  })

  it('opening a menu in a different pane replaces any menu already open elsewhere - only one can be open at a time', () => {
    useTabContextMenuStore.getState().openMenu('pane-1', '/a.ts', 10, 20)
    useTabContextMenuStore.getState().openMenu('pane-2', '/b.ts', 100, 200)
    expect(useTabContextMenuStore.getState().open).toEqual({ paneId: 'pane-2', path: '/b.ts', x: 100, y: 200 })
  })

  it('closeMenu clears it', () => {
    useTabContextMenuStore.getState().openMenu('pane-1', '/a.ts', 10, 20)
    useTabContextMenuStore.getState().closeMenu()
    expect(useTabContextMenuStore.getState().open).toBeNull()
  })
})
