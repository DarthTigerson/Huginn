import { create } from 'zustand'

interface SearchState {
  commandPaletteOpen: boolean
  searchOpen: boolean
  searchCaseSensitive: boolean
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openSearch: (caseSensitive: boolean) => void
  closeSearch: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  commandPaletteOpen: false,
  searchOpen: false,
  searchCaseSensitive: false,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openSearch: (caseSensitive) => set({ searchOpen: true, searchCaseSensitive: caseSensitive }),
  closeSearch: () => set({ searchOpen: false }),
}))
