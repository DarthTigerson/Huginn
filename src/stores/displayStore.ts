import { create } from 'zustand'

const FONT_KEY = 'huginn:font'
const PANEL_STYLE_KEY = 'huginn:panelStyle'

// Presets are limited to monospace fonts that ship preinstalled with a
// major OS (macOS: Menlo/Monaco, Windows: Consolas, both: Courier New).
// "SF Mono" and other popular coding fonts (JetBrains Mono, Fira Code, etc.)
// were removed — they aren't registered for CSS font-family matching unless
// the user has separately installed them, so picking them silently fell
// back to the generic monospace font and looked like the picker was broken.
export const FONT_PRESETS = [
  { label: 'Menlo',       value: 'Menlo, monospace' },
  { label: 'Monaco',      value: 'Monaco, monospace' },
  { label: 'Consolas',    value: 'Consolas, monospace' },
  { label: 'Courier New', value: 'Courier New, monospace' },
] as const

export type PanelStyle = 'matt' | 'glossy'

const DEFAULT_FONT = 'SF Mono, Menlo, Monaco, Consolas, monospace'

interface DisplayStore {
  font: string
  panelStyle: PanelStyle
  setFont: (font: string) => void
  setPanelStyle: (style: PanelStyle) => void
}

function applyFont(font: string) {
  document.documentElement.style.setProperty('--font-mono', font)
  localStorage.setItem(FONT_KEY, font)
}

function applyPanelStyle(style: PanelStyle) {
  document.documentElement.setAttribute('data-panel-style', style)
  localStorage.setItem(PANEL_STYLE_KEY, style)
}

const initialFont = localStorage.getItem(FONT_KEY) || DEFAULT_FONT
const initialPanelStyle = (localStorage.getItem(PANEL_STYLE_KEY) as PanelStyle | null) || 'matt'
applyFont(initialFont)
applyPanelStyle(initialPanelStyle)

export const useDisplayStore = create<DisplayStore>((set) => ({
  font: initialFont,
  panelStyle: initialPanelStyle,
  setFont: (font) => {
    applyFont(font)
    set({ font })
  },
  setPanelStyle: (style) => {
    applyPanelStyle(style)
    set({ panelStyle: style })
  },
}))
