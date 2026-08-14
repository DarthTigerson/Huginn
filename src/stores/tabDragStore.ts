import { create } from 'zustand'

interface DraggingTab {
  path: string
  sourcePaneId: string
}

interface TabDragStore {
  dragging: DraggingTab | null
  startDrag: (path: string, sourcePaneId: string) => void
  endDrag: () => void
}

// Shared across every pane's TabBar instance (same reasoning as
// tabContextMenuStore) - the drop-zone overlay over a pane's content area
// needs to know a drag is in progress and where it came from, regardless of
// which pane's TabBar started it.
export const useTabDragStore = create<TabDragStore>((set) => ({
  dragging: null,
  startDrag: (path, sourcePaneId) => set({ dragging: { path, sourcePaneId } }),
  endDrag: () => set({ dragging: null }),
}))
