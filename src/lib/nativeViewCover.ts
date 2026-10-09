import { useEffect } from 'react'
import { create } from 'zustand'

// Browser tabs are native WebContentsViews, which Electron draws above the
// whole renderer: no z-index puts a modal, palette or right-click menu on top
// of one. So every popup that can sit over the editor area calls
// useCoverNativeViews while it's open; while anything is covering, each
// BrowserTab swaps its live page for a still snapshot and hides the native
// view, so the popup shows over what looks like the page. A test
// (nativeViewCover.guard.test.ts) fails if a full-window popup forgets it.

interface NativeViewCoverStore {
  count: number
  // Returns the release function; calling it more than once is a no-op.
  cover: () => () => void
}

export const useNativeViewCoverStore = create<NativeViewCoverStore>((set) => ({
  count: 0,
  cover: () => {
    set((s) => ({ count: s.count + 1 }))
    let released = false
    return () => {
      if (released) return
      released = true
      set((s) => ({ count: Math.max(0, s.count - 1) }))
    }
  },
}))

export function useCoverNativeViews(active = true): void {
  useEffect(() => {
    if (!active) return
    return useNativeViewCoverStore.getState().cover()
  }, [active])
}
