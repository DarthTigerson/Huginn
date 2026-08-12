import { create } from 'zustand'

type CreateKind = 'file' | 'directory'

interface SidebarUiState {
  pendingCreate: CreateKind | null
  requestCreate: (kind: CreateKind) => void
  clearPendingCreate: () => void
  // A fresh object every call (rather than a bare string) so requesting the
  // same path twice in a row still triggers Sidebar's effect — mirrors
  // editorStore's revealRequest, which solves the identical "reveal the
  // same target again" problem for Monaco's line-reveal.
  revealRequest: { path: string } | null
  requestReveal: (path: string) => void
  clearRevealRequest: () => void
}

export const useSidebarUiStore = create<SidebarUiState>((set) => ({
  pendingCreate: null,
  requestCreate: (kind) => set({ pendingCreate: kind }),
  clearPendingCreate: () => set({ pendingCreate: null }),
  revealRequest: null,
  requestReveal: (path) => set({ revealRequest: { path } }),
  clearRevealRequest: () => set({ revealRequest: null }),
}))
