import { create } from 'zustand'

interface AutocompleteStatusStore {
  busy: boolean
  setBusy: (value: boolean) => void
}

export const useAutocompleteStatusStore = create<AutocompleteStatusStore>((set) => ({
  busy: false,
  setBusy: (value) => set({ busy: value }),
}))
