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
  // expandTarget only makes sense for a directory target (e.g. a git repo
  // root) — file targets (CommitDetailsPanel) leave it unset so the file
  // itself is just scrolled to/highlighted, not "expanded".
  revealRequest: { path: string; expandTarget?: boolean } | null
  requestReveal: (path: string, expandTarget?: boolean) => void
  clearRevealRequest: () => void
}

export const useSidebarUiStore = create<SidebarUiState>((set) => ({
  pendingCreate: null,
  requestCreate: (kind) => set({ pendingCreate: kind }),
  clearPendingCreate: () => set({ pendingCreate: null }),
  revealRequest: null,
  requestReveal: (path, expandTarget) => set({ revealRequest: { path, expandTarget } }),
  clearRevealRequest: () => set({ revealRequest: null }),
}))
