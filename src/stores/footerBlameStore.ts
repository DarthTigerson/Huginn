import { create } from 'zustand'

// The footer lays these out itself (author + message inline, full details in a
// hover panel), so it gets the raw parts rather than the editor's one-line text.
export type FooterBlame =
  | { kind: 'commit'; author: string; summary: string; date: string; relDate: string }
  | { kind: 'uncommitted' }

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
