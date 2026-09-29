import { create } from 'zustand'
import { TODO_PROJECT_SORT_MODES } from '@/lib/todoProjectSort'
import type { TodoProjectSortMode } from '@/lib/todoProjectSort'

const ENABLED_KEY = 'vide:todo:enabled'
const OPEN_IN_BIGGEST_PANE_KEY = 'vide:todo:openInBiggestPane'
const PROJECT_SORT_KEY = 'vide:todo:projectSort'

function getBool(key: string, def: boolean): boolean {
  const value = localStorage.getItem(key)
  return value === null ? def : value === 'true'
}

function getProjectSort(): TodoProjectSortMode {
  const value = localStorage.getItem(PROJECT_SORT_KEY)
  return TODO_PROJECT_SORT_MODES.some((m) => m.mode === value) ? (value as TodoProjectSortMode) : 'alphabetical'
}

interface TodoSettingsStore {
  enabled: boolean
  setEnabled: (value: boolean) => void
  openInBiggestPane: boolean
  setOpenInBiggestPane: (value: boolean) => void
  projectSort: TodoProjectSortMode
  setProjectSort: (value: TodoProjectSortMode) => void
}

export const useTodoSettingsStore = create<TodoSettingsStore>((set) => ({
  enabled: getBool(ENABLED_KEY, true),

  setEnabled: (value) => {
    localStorage.setItem(ENABLED_KEY, String(value))
    set({ enabled: value })
  },

  openInBiggestPane: getBool(OPEN_IN_BIGGEST_PANE_KEY, true),

  setOpenInBiggestPane: (value) => {
    localStorage.setItem(OPEN_IN_BIGGEST_PANE_KEY, String(value))
    set({ openInBiggestPane: value })
  },

  projectSort: getProjectSort(),

  setProjectSort: (value) => {
    localStorage.setItem(PROJECT_SORT_KEY, value)
    set({ projectSort: value })
  },
}))
