import { useThemeStore, THEME_OPTIONS } from '@/stores/themeStore'

export function ThemeStep() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">Pick a theme</h2>
        <p className="text-xs text-fg-muted mt-0.5">You can switch or add "match system" later in Display settings.</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
        {THEME_OPTIONS.map((t) => {
          const isActive = t.id === theme
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={[
                'text-left rounded-lg border-2 p-3 transition-colors',
                isActive ? 'border-accent' : 'border-border hover:border-fg-muted',
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
