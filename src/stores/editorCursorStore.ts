import { create } from 'zustand'

export interface EditorCursor {
  // The tab this position belongs to — the footer only shows it while that
  // tab is the active one, so a settings/graph tab never shows a stale line.
  path: string
  line: number
  column: number
}

// Cursor position for the StatusBar (VIDE-140). Same ownership
// rules as footerBlameStore: the focused editor publishes under its own
// owner token, and an editor can only clear it if it's still the last one
// that wrote — so disposing a background pane never wipes the focused
// pane's position.
interface EditorCursorStore {
  cursor: EditorCursor | null
  owner: object | null
  publish: (owner: object, cursor: EditorCursor) => void
  release: (owner: object) => void
}

export const useEditorCursorStore = create<EditorCursorStore>((set, get) => ({
  cursor: null,
  owner: null,

  publish: (owner, cursor) => set({ owner, cursor }),

  release: (owner) => {
    if (get().owner === owner) set({ owner: null, cursor: null })
  },
}))
