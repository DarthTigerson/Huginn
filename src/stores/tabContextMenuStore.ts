import { create } from 'zustand'

interface OpenTabContextMenu {
  paneId: string
  path: string
  x: number
  y: number
}

interface TabContextMenuStore {
  open: OpenTabContextMenu | null
  openMenu: (paneId: string, path: string, x: number, y: number) => void
  closeMenu: () => void
}

// Shared across every pane's TabBar instance rather than local per-instance
// state - a right-click in one pane must close a menu already open in
// another (they're separate React component instances, so separate
// useState wouldn't see each other), and this being a single state slot
// makes "only one menu open at a time" true by construction rather than
// something each instance has to coordinate via event listeners.
export const useTabContextMenuStore = create<TabContextMenuStore>((set) => ({
  open: null,
  openMenu: (paneId, path, x, y) => set({ open: { paneId, path, x, y } }),
  closeMenu: () => set({ open: null }),
}))
