import { useDisplayStore } from '@/stores/displayStore'
import { Toggle } from '@/components/ui/Toggle'
import { Section, Row } from './SettingsLayout'
import { ThemeSection } from './ThemeSection'
import { PanelStyleSection } from './PanelStyleSection'
import { FontSection } from './FontSection'
import { EditorColorsSection } from './EditorColorsSection'
import { BackgroundSection } from './BackgroundSection'

export function DisplayPage() {
  const {
    memoryUsageVisible, navbarPosition,
    setMemoryUsageVisible, setNavbarPosition,
  } = useDisplayStore()

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Display</h1>
      <p className="text-sm text-fg-muted mb-4">Colour theme, fonts, and panel appearance.</p>

      <ThemeSection />

      <PanelStyleSection />

      <FontSection />

      <EditorColorsSection />

      <BackgroundSection />

      {/* ── General ───────────────────────────────────────────────────────── */}
      <Section label="General">
        <Row>
          <Toggle
            className="max-w-[60ch]"
            label="Show memory usage"
            description="Show the RAM used/total indicator next to the model dropdown in the title bar."
            checked={memoryUsageVisible}
            onChange={setMemoryUsageVisible}
          />
        </Row>

        <Row>
          <Toggle
            className="max-w-[60ch]"
            label="Navbar on the right (Gabby Style)"
            description="Move the File Tree/Git/Settings navbar and its panel to the right edge. The Claude navbar and chat panel swap to the left."
            checked={navbarPosition === 'right'}
            onChange={(checked) => setNavbarPosition(checked ? 'right' : 'left')}
          />
        </Row>
      </Section>
    </div>
  )
}
