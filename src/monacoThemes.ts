import type { Monaco } from '@monaco-editor/react'
import type { ThemeId } from '@/stores/themeStore'

interface ThemePalette {
  base: 'vs' | 'vs-dark'
  background: string
  foreground: string
  accent: string
  border: string
  fgMuted: string
  fgSubtle: string
}

// Mirrors the hex values in index.css / themeStore's XTERM_THEMES — Monaco's
// theming API needs literal colors, it can't read our CSS custom properties.
const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  'claude-dark':  { base: 'vs-dark', background: '#1e1e1e', foreground: '#cccccc', accent: '#d97757', border: '#3c3c3c', fgMuted: '#858585', fgSubtle: '#555555' },
  'claude-light': { base: 'vs',      background: '#ffffff', foreground: '#1e1e1e', accent: '#c4613d', border: '#e0e0e0', fgMuted: '#717171', fgSubtle: '#999999' },
  'codex-dark':   { base: 'vs-dark', background: '#202020', foreground: '#cccccc', accent: '#ffffff', border: '#333333', fgMuted: '#8a8a8a', fgSubtle: '#555555' },
  'codex-light':  { base: 'vs',      background: '#ffffff', foreground: '#24292f', accent: '#0969da', border: '#d0d7de', fgMuted: '#6e7781', fgSubtle: '#aaaaaa' },
  'thomas-dark':  { base: 'vs-dark', background: '#221c15', foreground: '#e8e0d0', accent: '#f5c242', border: '#4a3d29', fgMuted: '#9c9080', fgSubtle: '#665c4a' },
  'thomas-light': { base: 'vs',      background: '#fffcf2', foreground: '#2a2013', accent: '#ad7b00', border: '#d8c89a', fgMuted: '#74684f', fgSubtle: '#a89876' },
}

let defined = false

export function defineMonacoThemes(monaco: Monaco) {
  if (defined) return
  defined = true

  for (const [id, p] of Object.entries(THEME_PALETTES) as [ThemeId, ThemePalette][]) {
    monaco.editor.defineTheme(id, {
      base: p.base,
      inherit: true,
      rules: [],
      colors: {
        'editor.background':                  p.background,
        'editor.foreground':                   p.foreground,
        'editorCursor.foreground':              p.accent,
        'editor.selectionBackground':           p.accent + '40',
        'editor.inactiveSelectionBackground':   p.accent + '20',
        'editor.lineHighlightBackground':       p.accent + '12',
        'editorLineNumber.foreground':          p.fgSubtle,
        'editorLineNumber.activeForeground':    p.fgMuted,
        'editorIndentGuide.background':         p.border,
        'editorIndentGuide.activeBackground':   p.fgSubtle,
        'editorWhitespace.foreground':          p.border,
      },
    })
  }
}
