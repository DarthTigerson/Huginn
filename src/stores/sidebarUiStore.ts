import { create } from 'zustand'

type CreateKind = 'file' | 'directory'

interface SidebarUiState {
  pendingCreate: CreateKind | null
  requestCreate: (kind: CreateKind) => void
  clearPendingCreate: () => void
}

export const useSidebarUiStore = create<SidebarUiState>((set) => ({
  pendingCreate: null,
  requestCreate: (kind) => set({ pendingCreate: kind }),
  clearPendingCreate: () => set({ pendingCreate: null }),
}))
