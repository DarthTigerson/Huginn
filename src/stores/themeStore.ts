import { create } from 'zustand'
import type { ITheme } from '@xterm/xterm'

export type ThemeId =
  | 'claude-dark' | 'claude-light'
  | 'codex-dark'  | 'codex-light'
  | 'thomas-dark' | 'thomas-light'

interface ThemeStore {
  theme: ThemeId
  matchSystem: boolean
  setTheme: (theme: ThemeId) => void
  setMatchSystem: (matchSystem: boolean) => void
}

const STORAGE_KEY = 'huginn:theme'
const MATCH_SYSTEM_STORAGE_KEY = 'huginn:themeMatchSystem'

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

function familyOf(theme: ThemeId): string {
  return theme.replace(/-(dark|light)$/, '')
}

function variantFor(family: string, dark: boolean): ThemeId {
  return `${family}-${dark ? 'dark' : 'light'}` as ThemeId
}

const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')

const initialMatchSystem = localStorage.getItem(MATCH_SYSTEM_STORAGE_KEY) === 'true'
const storedTheme = (localStorage.getItem(STORAGE_KEY) as ThemeId | null) ?? 'claude-dark'
const initialTheme = initialMatchSystem
  ? variantFor(familyOf(storedTheme), systemDarkQuery.matches)
  : storedTheme
applyTheme(initialTheme)

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  matchSystem: initialMatchSystem,
  setTheme: (theme) => {
    applyTheme(theme)
    localStorage.setItem(MATCH_SYSTEM_STORAGE_KEY, 'false')
    set({ theme, matchSystem: false })
  },
  setMatchSystem: (matchSystem) => {
    localStorage.setItem(MATCH_SYSTEM_STORAGE_KEY, String(matchSystem))
    if (matchSystem) {
      const next = variantFor(familyOf(get().theme), systemDarkQuery.matches)
      applyTheme(next)
      set({ matchSystem, theme: next })
    } else {
      set({ matchSystem })
    }
  },
}))

systemDarkQuery.addEventListener('change', (e) => {
  const { matchSystem, theme } = useThemeStore.getState()
  if (!matchSystem) return
  const next = variantFor(familyOf(theme), e.matches)
  applyTheme(next)
  useThemeStore.setState({ theme: next })
})

export const MONACO_THEMES: Record<ThemeId, string> = {
  'claude-dark':  'vs-dark',
  'claude-light': 'vs',
  'codex-dark':   'vs-dark',
  'codex-light':  'vs',
  'thomas-dark':  'vs-dark',
  'thomas-light': 'vs',
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
  'thomas-dark': {
    background:          '#1a1a1a',
    foreground:          '#e0e0e0',
    cursor:              '#f5c242',
    selectionBackground: '#f5c24240',
  },
  'thomas-light': {
    background:          '#f5f5f3',
    foreground:          '#1e1e1e',
    cursor:              '#ad8b00',
    selectionBackground: '#ad8b0040',
  },
}
