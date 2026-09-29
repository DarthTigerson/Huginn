import { create } from 'zustand'

export interface FooterBlame {
  text: string
  hover: string
  // Set when text starts with the author's name, so the footer can emphasise it.
  author?: string
}

// Current-line git blame shown in the StatusBar when Settings > Git > Blame is
// set to "Footer". Each editor pane's attachCurrentLineBlame publishes under
// its own owner token; only the focused pane publishes, and a pane can only
// clear the footer if it's still the one that last wrote to it - so closing a
// background pane never wipes the blame the focused pane is showing.
interface FooterBlameStore {
  blame: FooterBlame | null
  owner: object | null
  publish: (owner: object, blame: FooterBlame | null) => void
  release: (owner: object) => void
}

export const useFooterBlameStore = create<FooterBlameStore>((set, get) => ({
  blame: null,
  owner: null,

  publish: (owner, blame) => set({ owner, blame }),

  release: (owner) => {
    if (get().owner === owner) set({ owner: null, blame: null })
  },
}))
