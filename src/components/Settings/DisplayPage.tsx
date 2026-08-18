import { useDisplayStore, FONT_PRESETS, type PanelStyle, type FooterContent } from '@/stores/displayStore'
import { useThemeStore, type ThemeId } from '@/stores/themeStore'
import { Toggle } from '@/components/ui/Toggle'
import { Select } from '@/components/ui/Select'

const PANEL_STYLE_OPTIONS: { value: PanelStyle; label: string; description: string }[] = [
  { value: 'matt',   label: 'Matt',          description: 'Solid panels' },
  { value: 'solid',  label: 'Solid Colours', description: 'Solid panels, bolder dividing lines' },
  { value: 'glossy', label: 'Glossy',        description: 'Frosted glass' },
  { value: 'glass',  label: 'Glass',         description: 'See-through, reveals the background image' },
]

// More may be added later — see FooterContent's own comment in displayStore.
const FOOTER_CONTENT_OPTIONS: { value: FooterContent; label: string }[] = [
  { value: 'hints', label: 'Hints' },
  { value: 'clock', label: 'Clock' },
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
  const {
    font, panelStyle, footerContent, memoryUsageVisible, backgroundImageVisible, navbarPosition,
    setFont, setPanelStyle, setFooterContent, setMemoryUsageVisible, setBackgroundImageVisible, setNavbarPosition,
  } = useDisplayStore()
  const { theme, setTheme, matchSystem, setMatchSystem } = useThemeStore()

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

        {/* Panel Style + General — grouped as one flex item so General always
            stacks directly under Panel Style, using the vertical space that
            column has left over next to the taller Theme card, rather than
            wrapping independently onto its own row. */}
        <div className="flex-1 min-w-[240px] flex flex-col gap-6">
          <section className="rounded-xl border border-border/60 p-4">
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
                        colors, solid is the same solid colors with a bolder divider
                        (see [data-panel-style="solid"] in index.css), glossy is the
                        same theme colors made translucent with blur (see
                        [data-panel-style="glossy"] in index.css), no color shift */}
                    <div className="h-14 relative overflow-hidden bg-bg">
                      {opt.value === 'glass' && (
                        <div className="absolute right-1 bottom-0 w-6 h-6 rounded-full bg-accent/70 blur-[3px]" />
                      )}
                      {opt.value === 'glossy' ? (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-7 bg-sidebar/50 backdrop-blur-sm" />
                          <div className="absolute left-7 top-0 right-0 h-5 bg-tab-bar/60 backdrop-blur-sm border-b border-border/40" />
                          <div className="absolute left-7 top-5 right-0 bottom-0 bg-panel/50 backdrop-blur-sm" />
                        </>
                      ) : opt.value === 'glass' ? (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-7 bg-sidebar/20 backdrop-blur-sm" />
                          <div className="absolute left-7 top-0 right-0 h-5 bg-tab-bar/25 backdrop-blur-sm border-b border-border/30" />
                          <div className="absolute left-7 top-5 right-0 bottom-0 bg-panel/20 backdrop-blur-sm" />
                        </>
                      ) : opt.value === 'solid' ? (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-7 bg-sidebar border-r-2 border-fg-subtle" />
                          <div className="absolute left-7 top-0 right-0 h-5 bg-tab-bar border-b-2 border-fg-subtle" />
                          <div className="absolute left-7 top-5 right-0 bottom-0 bg-panel" />
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

          <section className="rounded-xl border border-border/60 p-4">
            <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">General</h2>
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex-1 min-w-[220px]">
                <label htmlFor="footer-content-select" className="text-xs text-fg-muted mb-1.5 block">Footer Content</label>
                <Select
                  id="footer-content-select"
                  value={footerContent}
                  onChange={(v) => setFooterContent(v as FooterContent)}
                  options={FOOTER_CONTENT_OPTIONS}
                />
              </div>

              <div className="flex-1 min-w-[220px]">
                <label htmlFor="font-select" className="text-xs text-fg-muted mb-1.5 block">Font</label>
                <Select
                  id="font-select"
                  value={font}
                  onChange={setFont}
                  options={FONT_PRESETS.map((preset) => ({ value: preset.value, label: preset.label, style: { fontFamily: preset.value } }))}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <Toggle
                label="Show background image"
                description="Decorative badge in the corner of the empty editor pane, and (with Glass panel style) behind the editor and terminal panels."
                checked={backgroundImageVisible}
                onChange={setBackgroundImageVisible}
              />
              <Toggle
                label="Show memory usage"
                description="Show the RAM used/total indicator next to the model dropdown in the title bar."
                checked={memoryUsageVisible}
                onChange={setMemoryUsageVisible}
              />
              <Toggle
                label="Navbar on right"
                description="Move the Explorer/Git/Settings navbar and its panel to the right edge. The Claude navbar and chat panel swap to the left."
                checked={navbarPosition === 'right'}
                onChange={(checked) => setNavbarPosition(checked ? 'right' : 'left')}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
