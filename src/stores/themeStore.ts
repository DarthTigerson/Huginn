import { create } from 'zustand'
import type { ITheme } from '@xterm/xterm'

export type ThemeId = 'claude-dark' | 'claude-light' | 'codex-dark' | 'codex-light'

interface ThemeStore {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

const STORAGE_KEY = 'huginn:theme'

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

const initialTheme = (localStorage.getItem(STORAGE_KEY) as ThemeId | null) ?? 'claude-dark'
applyTheme(initialTheme)

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
}))

export const MONACO_THEMES: Record<ThemeId, string> = {
  'claude-dark':  'vs-dark',
  'claude-light': 'vs',
  'codex-dark':   'vs-dark',
  'codex-light':  'vs',
}

export const XTERM_THEMES: Record<ThemeId, ITheme> = {
  'claude-dark': {
    background:          '#1a1a1a',
    foreground:          '#cccccc',
    cursor:              '#d97757',
    selectionBackground: '#d9775740',
  },
  'claude-light': {
    background:          '#f3f3f3',
    foreground:          '#1e1e1e',
    cursor:              '#c4613d',
    selectionBackground: '#c4613d40',
  },
  'codex-dark': {
    background:          '#1a1a1a',
    foreground:          '#cccccc',
    cursor:              '#ffffff',
    selectionBackground: '#ffffff30',
  },
  'codex-light': {
    background:          '#fafafa',
    foreground:          '#24292f',
    cursor:              '#0969da',
    selectionBackground: '#0969da40',
  },
}
