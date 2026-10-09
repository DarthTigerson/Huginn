import { create } from 'zustand'
import { notifySettingChanged } from '../lib/notifySettingChanged'

const NEW_TAB_PANE_KEY = 'vide:general:newTabPane'
// The old per-page "Always open in biggest pane" switch. Only read once, so
// someone who had turned it off starts on 'active' (VIDE-145 cleanup).
const LEGACY_OPEN_IN_BIGGEST_PANE_KEY = 'vide:general:openInBiggestPane'
const FILE_TREE_GIT_STATUS_KEY = 'vide:general:fileTreeGitStatus'

// How the file tree shows each file's git status (Settings > General > File
// Tree): nothing, just the M/A/D/R/U letter, or the letter plus coloured
// file and folder names.
export type FileTreeGitStatus = 'off' | 'letter' | 'letterAndColour'
const FILE_TREE_GIT_STATUS_VALUES: FileTreeGitStatus[] = ['off', 'letter', 'letterAndColour']

// Which editor window a newly opened tab lands in (Settings > General). Every
// editorStore.openTab follows it; actions that name their own window (split,
// move, drag, a tab-bar double-click) don't.
export type NewTabPane = 'active' | 'biggest'

// editorStore imports this store, so it loads in every test that touches
// tabs, including plain-node ones with no localStorage. Reads fall back to
// the defaults there instead of throwing at import time.
function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function getNewTabPane(): NewTabPane {
  const value = read(NEW_TAB_PANE_KEY)
  if (value === 'active' || value === 'biggest') return value
  return read(LEGACY_OPEN_IN_BIGGEST_PANE_KEY) === 'false' ? 'active' : 'biggest'
}

function getFileTreeGitStatus(): FileTreeGitStatus {
  const value = read(FILE_TREE_GIT_STATUS_KEY) as FileTreeGitStatus | null
  return value && FILE_TREE_GIT_STATUS_VALUES.includes(value) ? value : 'letterAndColour'
}

interface GeneralSettingsStore {
  newTabPane: NewTabPane
  setNewTabPane: (value: NewTabPane) => void
  fileTreeGitStatus: FileTreeGitStatus
  setFileTreeGitStatus: (value: FileTreeGitStatus) => void
}

export const useGeneralSettingsStore = create<GeneralSettingsStore>((set) => ({
  newTabPane: getNewTabPane(),

  setNewTabPane: (value) => {
    localStorage.setItem(NEW_TAB_PANE_KEY, value)
    set({ newTabPane: value })
    notifySettingChanged()
  },

  fileTreeGitStatus: getFileTreeGitStatus(),

  setFileTreeGitStatus: (value) => {
    localStorage.setItem(FILE_TREE_GIT_STATUS_KEY, value)
    set({ fileTreeGitStatus: value })
    notifySettingChanged()
  },
}))
