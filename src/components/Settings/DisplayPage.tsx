import { useDisplayStore, FONT_PRESETS, type PanelStyle } from '@/stores/displayStore'
import { useThemeStore, type ThemeId } from '@/stores/themeStore'
import { Toggle } from '@/components/ui/Toggle'

const PANEL_STYLE_OPTIONS: { value: PanelStyle; label: string; description: string }[] = [
  { value: 'matt',   label: 'Matt',   description: 'Solid panels' },
  { value: 'glossy', label: 'Glossy', description: 'Frosted glass' },
]

interface ThemeOption {
  id: ThemeId
  name: string
  swatches: string[]
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'claude-dark',  name: 'Claude Dark',  swatches: ['#1a1a1a', '#252526', '#1e1e1e', '#d97757', '#3c3c3c'] },
  { id: 'claude-light', name: 'Claude Light', swatches: ['#f3f3f3', '#ececec', '#ffffff', '#c4613d', '#e0e0e0'] },
  { id: 'codex-dark',   name: 'Codex Dark',   swatches: ['#1a1a1a', '#1a1a1a', '#202020', '#ffffff', '#333333'] },
  { id: 'codex-light',  name: 'Codex Light',  swatches: ['#fafafa', '#fafafa', '#ffffff', '#0969da', '#d0d7de'] },
  { id: 'thomas-dark',  name: 'Thomas Dark',  swatches: ['#1c1712', '#2b2319', '#221c15', '#f5c242', '#4a3d29'] },
  { id: 'thomas-light', name: 'Thomas Light', swatches: ['#f7f1e0', '#efe6cd', '#fffcf2', '#ad7b00', '#d8c89a'] },
  // Luuk hates light mode — "Luuk Light" is a gag, identical to "Luuk Dark".
  { id: 'luuk-dark',    name: 'Luuk Dark',    swatches: ['#0d0d0d', '#111111', '#141414', '#9e9e9e', '#2e2e2e'] },
  { id: 'luuk-light',   name: 'Luuk Light',   swatches: ['#0d0d0d', '#111111', '#141414', '#9e9e9e', '#2e2e2e'] },
]

export function DisplayPage() {
  const { font, panelStyle, setFont, setPanelStyle } = useDisplayStore()
  const { theme, setTheme, matchSystem, setMatchSystem } = useThemeStore()

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFont(e.target.value)
  }

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Display</h1>
      <p className="text-sm text-fg-muted mb-8">Colour theme, fonts, and panel appearance.</p>

      {/* flex-wrap (not a grid + lg: breakpoint) so cards reflow based on this
          pane's actual rendered width, not the viewport — this page can end up
          narrow inside a split editor pane even when the window itself is wide.
          items-start stops a short card from being stretched to match a tall one. */}
      <div className="flex flex-wrap items-start gap-6">
        {/* Theme */}
        <section className="flex-1 min-w-[320px] rounded-xl border border-border/60 p-4">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Theme</h2>

          <div className="mb-4 pb-4 border-b border-border/40">
            <Toggle
              label="Match system appearance"
              description="Automatically switch this theme between its light and dark variant when macOS does."
              checked={matchSystem}
              onChange={setMatchSystem}
            />
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
        </section>

        {/* Panel Style */}
        <section className="flex-1 min-w-[240px] rounded-xl border border-border/60 p-4">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Panel Style</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
            {PANEL_STYLE_OPTIONS.map((opt) => {
              const isActive = panelStyle === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPanelStyle(opt.value)}
                  className={[
                    'text-left rounded-lg border-2 overflow-hidden transition-colors',
                    isActive ? 'border-accent' : 'border-border hover:border-fg-muted',
                  ].join(' ')}
                >
                  {/* Visual preview — reflects the real effect: matt is solid theme
                      colors, glossy is the same theme colors made translucent with
                      blur (see [data-panel-style="glossy"] in index.css), no color shift */}
                  <div className="h-14 relative overflow-hidden bg-bg">
                    {opt.value === 'glossy' ? (
                      <>
                        <div className="absolute left-0 top-0 bottom-0 w-7 bg-sidebar/50 backdrop-blur-sm" />
                        <div className="absolute left-7 top-0 right-0 h-5 bg-tab-bar/60 backdrop-blur-sm border-b border-border/40" />
                        <div className="absolute left-7 top-5 right-0 bottom-0 bg-panel/50 backdrop-blur-sm" />
                      </>
                    ) : (
                      <>
                        <div className="absolute left-0 top-0 bottom-0 w-7 bg-sidebar" />
                        <div className="absolute left-7 top-0 right-0 h-5 bg-tab-bar border-b border-border" />
                        <div className="absolute left-7 top-5 right-0 bottom-0 bg-panel" />
                      </>
                    )}
                  </div>
                  {/* Label */}
                  <div className={['px-3 py-2', isActive ? 'bg-accent/10' : 'bg-sidebar'].join(' ')}>
                    <div className={['text-sm font-medium', isActive ? 'text-fg' : 'text-fg-muted'].join(' ')}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-fg-subtle mt-0.5">{opt.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Typography */}
        <section className="w-full rounded-xl border border-border/60 p-4">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Typography</h2>
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs text-fg-muted mb-1.5 block">Font</label>
              <div className="relative">
                <select
                  value={font}
                  onChange={handleSelectChange}
                  className="w-full appearance-none px-3 py-2.5 pr-9 text-sm bg-bg border border-border rounded-lg text-fg focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
                >
                  {FONT_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value} style={{ fontFamily: preset.value }}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle text-xs">
                  ▾
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
