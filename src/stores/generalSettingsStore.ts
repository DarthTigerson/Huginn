import { create } from 'zustand'
import { notifySettingChanged } from '../lib/notifySettingChanged'

const OPEN_IN_BIGGEST_PANE_KEY = 'vide:general:openInBiggestPane'
const FILE_TREE_GIT_STATUS_KEY = 'vide:general:fileTreeGitStatus'

// How the file tree shows each file's git status (Settings > General > File
// Tree): nothing, just the M/A/D/R/U letter, or the letter plus coloured
// file and folder names.
export type FileTreeGitStatus = 'off' | 'letter' | 'letterAndColour'
const FILE_TREE_GIT_STATUS_VALUES: FileTreeGitStatus[] = ['off', 'letter', 'letterAndColour']

function getBool(key: string, def: boolean): boolean {
  const value = localStorage.getItem(key)
  return value === null ? def : value === 'true'
}

function getFileTreeGitStatus(): FileTreeGitStatus {
  const value = localStorage.getItem(FILE_TREE_GIT_STATUS_KEY) as FileTreeGitStatus | null
  return value && FILE_TREE_GIT_STATUS_VALUES.includes(value) ? value : 'letterAndColour'
}

interface GeneralSettingsStore {
  openInBiggestPane: boolean
  setOpenInBiggestPane: (value: boolean) => void
  fileTreeGitStatus: FileTreeGitStatus
  setFileTreeGitStatus: (value: FileTreeGitStatus) => void
}

export const useGeneralSettingsStore = create<GeneralSettingsStore>((set) => ({
  openInBiggestPane: getBool(OPEN_IN_BIGGEST_PANE_KEY, true),

  setOpenInBiggestPane: (value) => {
    localStorage.setItem(OPEN_IN_BIGGEST_PANE_KEY, String(value))
    set({ openInBiggestPane: value })
  },

  fileTreeGitStatus: getFileTreeGitStatus(),

  setFileTreeGitStatus: (value) => {
    localStorage.setItem(FILE_TREE_GIT_STATUS_KEY, value)
    set({ fileTreeGitStatus: value })
    notifySettingChanged()
  },
}))
