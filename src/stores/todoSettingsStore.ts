import { create } from 'zustand'
import { TODO_PROJECT_SORT_MODES } from '@/lib/todoProjectSort'
import type { TodoProjectSortMode } from '@/lib/todoProjectSort'
import { TODO_COLUMNS } from '@/lib/todoBoard'
import type { TodoStatus } from '@/types/api'

const ENABLED_KEY = 'vide:todo:enabled'
const PROJECT_SORT_KEY = 'vide:todo:projectSort'
const SHOWN_COUNTS_KEY = 'vide:todo:shownCounts'

const ALL_STATUSES = TODO_COLUMNS.map((c) => c.status)

function getBool(key: string, def: boolean): boolean {
  const value = localStorage.getItem(key)
  return value === null ? def : value === 'true'
}

function getProjectSort(): TodoProjectSortMode {
  const value = localStorage.getItem(PROJECT_SORT_KEY)
  return TODO_PROJECT_SORT_MODES.some((m) => m.mode === value) ? (value as TodoProjectSortMode) : 'alphabetical'
}

// Which per-status counts the sidebar shows next to each project. Stored as a
// list and read back in board-column order; defaults to all four.
function getShownCounts(): TodoStatus[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SHOWN_COUNTS_KEY) ?? 'null')
    if (Array.isArray(parsed)) return ALL_STATUSES.filter((status) => parsed.includes(status))
  } catch {
    // fall through to the default
  }
  return ALL_STATUSES
}

interface TodoSettingsStore {
  enabled: boolean
  setEnabled: (value: boolean) => void
  projectSort: TodoProjectSortMode
  setProjectSort: (value: TodoProjectSortMode) => void
  shownCounts: TodoStatus[]
  toggleShownCount: (status: TodoStatus) => void
}

export const useTodoSettingsStore = create<TodoSettingsStore>((set, get) => ({
  enabled: getBool(ENABLED_KEY, true),

  setEnabled: (value) => {
    localStorage.setItem(ENABLED_KEY, String(value))
    set({ enabled: value })
  },

  projectSort: getProjectSort(),

  setProjectSort: (value) => {
    localStorage.setItem(PROJECT_SORT_KEY, value)
    set({ projectSort: value })
  },

  shownCounts: getShownCounts(),

  toggleShownCount: (status) => {
    const current = get().shownCounts
    const next = ALL_STATUSES.filter((s) => (s === status ? !current.includes(s) : current.includes(s)))
    localStorage.setItem(SHOWN_COUNTS_KEY, JSON.stringify(next))
    set({ shownCounts: next })
  },
}))
