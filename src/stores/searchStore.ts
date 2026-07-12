import { create } from 'zustand'

interface SearchState {
  commandPaletteOpen: boolean
  searchOpen: boolean
  searchCaseSensitive: boolean
  actionPaletteOpen: boolean
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openSearch: (caseSensitive: boolean) => void
  closeSearch: () => void
  openActionPalette: () => void
  closeActionPalette: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  commandPaletteOpen: false,
  searchOpen: false,
  searchCaseSensitive: false,
  actionPaletteOpen: false,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openSearch: (caseSensitive) => set({ searchOpen: true, searchCaseSensitive: caseSensitive }),
  closeSearch: () => set({ searchOpen: false }),
  openActionPalette: () => set({ actionPaletteOpen: true }),
  closeActionPalette: () => set({ actionPaletteOpen: false }),
}))
