import { useMobileSettingsStore } from '@/stores/mobileSettingsStore'
import type { MobileDefaultMode } from '@/stores/mobileSettingsStore'
import { RadioGroup } from '@/components/ui/RadioGroup'
import { FeatureBlock, SettingRow } from './FeatureBlock'

const DEFAULT_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ask', label: 'Ask each time' },
  { value: 'graph', label: 'Graph Display' },
  { value: 'vide', label: 'vIDE' },
]

export function MobileSettingsPage() {
  const enabled = useMobileSettingsStore((s) => s.enabled)
  const setEnabled = useMobileSettingsStore((s) => s.setEnabled)
  const defaultMode = useMobileSettingsStore((s) => s.defaultMode)
  const setDefaultMode = useMobileSettingsStore((s) => s.setDefaultMode)

  return (
    <div className="h-full overflow-auto bg-panel p-6">
      <div className="max-w-[1000px]">
        <h1 className="mb-1 text-base font-semibold text-fg">Mobile</h1>
        <p className="mb-4 text-sm text-fg-muted">Preview your app on a phone by pairing it to this project over the LAN.</p>

        <FeatureBlock
          title="Mobile Display"
          description="Adds a phone icon to the activity bar for pairing devices by QR code."
          toggle={{ checked: enabled, onChange: setEnabled, label: 'Enable Mobile Display' }}
        >
          <SettingRow label="After pairing, open" description="Skip the chooser. A Switch mode link on the page always leads back to it.">
            <RadioGroup
              ariaLabel="Default mode after pairing"
              value={defaultMode ?? 'ask'}
              onChange={(value: string) => setDefaultMode(value === 'ask' ? null : value as MobileDefaultMode)}
              options={DEFAULT_MODE_OPTIONS}
            />
          </SettingRow>
        </FeatureBlock>
      </div>
    </div>
  )
}
