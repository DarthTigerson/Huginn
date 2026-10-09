import { create } from 'zustand'
import { useEditorStore } from './editorStore'
import { ABOUT_SETTINGS_TAB_PATH } from '@/components/Settings/paths'

// Set by updateStore.restart() right before the app relaunches, so they
// survive the process restart via localStorage: the version just installed,
// and the one it replaced. Read and cleared exactly once on the next
// startup.
export const PENDING_CHANGELOG_KEY = 'vide:pendingChangelogVersion'
export const UPDATED_FROM_KEY = 'vide:updatedFromVersion'

export interface JustUpdated {
  to: string
  // null when the restart came from a build that didn't record it.
  from: string | null
}

interface ChangelogState {
  // Set for the rest of this session after starting up on a new version, so
  // Settings > About can say "Updated from v…".
  justUpdated: JustUpdated | null
  checkPending: () => void
}

// After an update (VIDE-143), open Settings > About — it lands on the new
// version's notes — instead of the old "What's New" modal.
export const useChangelogStore = create<ChangelogState>((set) => ({
  justUpdated: null,

  checkPending: () => {
    const to = localStorage.getItem(PENDING_CHANGELOG_KEY)
    const from = localStorage.getItem(UPDATED_FROM_KEY)
    localStorage.removeItem(PENDING_CHANGELOG_KEY)
    localStorage.removeItem(UPDATED_FROM_KEY)
    if (!to) return

    set({ justUpdated: { to, from: from && from !== to ? from : null } })
    const tab = { path: ABOUT_SETTINGS_TAB_PATH, content: '', dirty: false }
    useEditorStore.getState().openTab(tab)
  },
}))
