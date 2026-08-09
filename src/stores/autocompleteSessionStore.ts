import { create } from 'zustand'

interface AutocompleteSessionStore {
  paused: boolean
  togglePaused: () => void
}

// Deliberately not persisted to localStorage: this is a same-session-only
// pause layered on top of the persisted Settings toggle, and resets to
// "not paused" every app launch by simply never being written to disk.
export const useAutocompleteSessionStore = create<AutocompleteSessionStore>((set) => ({
  paused: false,
  togglePaused: () => set((s) => ({ paused: !s.paused })),
}))
