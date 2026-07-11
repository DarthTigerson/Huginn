import { useThemeStore, type ThemeId } from '@/stores/themeStore'

interface ThemeOption {
  id: ThemeId
  name: string
  swatches: string[]
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'claude-dark',
    name: 'Claude Dark',
    swatches: ['#1a1a1a', '#252526', '#1e1e1e', '#d97757', '#3c3c3c'],
  },
  {
    id: 'claude-light',
    name: 'Claude Light',
    swatches: ['#f3f3f3', '#ececec', '#ffffff', '#c4613d', '#e0e0e0'],
  },
  {
    id: 'codex-dark',
    name: 'Codex Dark',
    swatches: ['#1a1a1a', '#1a1a1a', '#202020', '#ffffff', '#333333'],
  },
  {
    id: 'codex-light',
    name: 'Codex Light',
    swatches: ['#fafafa', '#fafafa', '#ffffff', '#0969da', '#d0d7de'],
  },
]

export function ThemesPage() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Themes</h1>
      <p className="text-sm text-fg-muted mb-6">Choose a colour theme for the editor.</p>
      <div className="grid grid-cols-2 gap-3">
        {THEME_OPTIONS.map((t) => {
          const isActive = t.id === theme
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={[
                'text-left rounded-lg border-2 p-3 transition-colors',
                isActive
                  ? 'border-accent'
                  : 'border-border hover:border-fg-muted',
              ].join(' ')}
            >
              <div className="flex gap-1 mb-3 rounded overflow-hidden h-10">
                {t.swatches.map((color, i) => (
                  <div key={i} className="flex-1" style={{ background: color }} />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-fg truncate">{t.name}</span>
                {isActive && (
                  <span className="shrink-0 text-xs font-medium text-accent px-1.5 py-0.5 rounded bg-accent/10">
                    Active
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
