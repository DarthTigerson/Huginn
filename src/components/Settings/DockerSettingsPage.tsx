import { useDockerSettingsStore, type DockerBadgeMode, type DockerMemoryFormat } from '@/stores/dockerSettingsStore'
import { Switch } from '@/components/ui/Toggle'
import { Select } from '@/components/ui/Select'
import { FeatureBlock, SettingRow } from './FeatureBlock'
import { DockerBadgePreview, DockerRowsPreview } from './previews/dockerPreviews'

export function DockerSettingsPage() {
  const enabled = useDockerSettingsStore((s) => s.enabled)
  const setEnabled = useDockerSettingsStore((s) => s.setEnabled)
  const showBadge = useDockerSettingsStore((s) => s.showBadge)
  const setShowBadge = useDockerSettingsStore((s) => s.setShowBadge)
  const badgeMode = useDockerSettingsStore((s) => s.badgeMode)
  const setBadgeMode = useDockerSettingsStore((s) => s.setBadgeMode)
  const showMemory = useDockerSettingsStore((s) => s.showMemory)
  const setShowMemory = useDockerSettingsStore((s) => s.setShowMemory)
  const memoryFormat = useDockerSettingsStore((s) => s.memoryFormat)
  const setMemoryFormat = useDockerSettingsStore((s) => s.setMemoryFormat)

  return (
    <div className="h-full overflow-auto bg-panel p-6">
      <div className="max-w-[1000px]">
        <h1 className="mb-1 text-base font-semibold text-fg">Docker</h1>
        <p className="mb-4 text-sm text-fg-muted">See and control local Docker containers without leaving vIDE.</p>

        <FeatureBlock
          title="Docker"
          description="Adds a Docker icon to the activity bar with a live container panel and per-container logs."
          toggle={{ checked: enabled, onChange: setEnabled, label: 'Enable Docker' }}
          preview={<DockerBadgePreview />}
        >
          <SettingRow label="Show running count" description="A live badge on the Docker icon, kept up to date even while the panel is closed.">
            <Switch label="Show running count" checked={showBadge} onChange={setShowBadge} />
          </SettingRow>
          <fieldset disabled={!showBadge} className={['m-0 min-w-0 border-0 p-0', showBadge ? '' : 'opacity-50'].join(' ')}>
            <SettingRow label="Count" htmlFor="docker-badge-mode" sub>
              <div className="w-72">
                <Select
                  id="docker-badge-mode"
                  value={badgeMode}
                  onChange={(v) => setBadgeMode(v as DockerBadgeMode)}
                  options={[
                    { value: 'containers', label: 'All running containers' },
                    { value: 'projects', label: 'All running projects' },
                  ]}
                />
              </div>
            </SettingRow>
          </fieldset>
        </FeatureBlock>

        <FeatureBlock
          title="Container memory"
          description="Each container's memory use on its row. Uses docker stats, a noticeably heavier command than the container list, so it only polls while the panel is open."
          toggle={{ checked: showMemory, onChange: setShowMemory, label: 'Show memory usage' }}
          preview={<DockerRowsPreview />}
        >
          <SettingRow label="Format" htmlFor="docker-memory-format">
            <div className="w-72">
              <Select
                id="docker-memory-format"
                value={memoryFormat}
                onChange={(v) => setMemoryFormat(v as DockerMemoryFormat)}
                options={[
                  { value: 'usedPercent', label: 'Used %' },
                  { value: 'availablePercent', label: 'Available %' },
                  { value: 'usedAbsolute', label: 'Used (e.g. 512 MB)' },
                  { value: 'usedOverLimit', label: 'Used / limit (e.g. 512 MB / 1 GB)' },
                ]}
              />
            </div>
          </SettingRow>
          <p className="max-w-[460px] text-xs text-fg-subtle">
            A container with no memory limit reports the host's total RAM as its limit, so "%" for one of
            those means its share of the whole machine.
          </p>
        </FeatureBlock>
      </div>
    </div>
  )
}
