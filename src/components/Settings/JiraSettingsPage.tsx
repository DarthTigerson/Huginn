import { useJiraSettingsStore } from '@/stores/jiraSettingsStore'
import { useFileStore } from '@/stores/fileStore'
import { Switch } from '@/components/ui/Toggle'
import { TextField } from './SettingsLayout'
import { FeatureBlock, SettingRow } from './FeatureBlock'

export function JiraSettingsPage() {
  const enabled = useJiraSettingsStore((s) => s.enabled)
  const setEnabled = useJiraSettingsStore((s) => s.setEnabled)
  const externalUrl = useJiraSettingsStore((s) => s.externalUrl)
  const setExternalUrl = useJiraSettingsStore((s) => s.setExternalUrl)
  const projectUrls = useJiraSettingsStore((s) => s.projectUrls)
  const setProjectUrl = useJiraSettingsStore((s) => s.setProjectUrl)
  const closeSidePanelOnOpen = useJiraSettingsStore((s) => s.closeSidePanelOnOpen)
  const setCloseSidePanelOnOpen = useJiraSettingsStore((s) => s.setCloseSidePanelOnOpen)
  const projectRoot = useFileStore((s) => s.projectRoot)

  return (
    <div className="h-full overflow-auto bg-panel p-6">
      <div className="max-w-[1000px]">
        <h1 className="mb-1 text-base font-semibold text-fg">Jira</h1>
        <p className="mb-4 text-sm text-fg-muted">Point the Jira icon at your team's Jira instance and it'll open as a browser tab.</p>

        <FeatureBlock
          title="Jira"
          description="Shows the Jira icon in the activity bar once a URL below is set too."
          toggle={{ checked: enabled, onChange: setEnabled, label: 'Enable Jira' }}
        >
          <TextField
            id="jira-external-url"
            label="Default URL"
            value={externalUrl}
            onChange={setExternalUrl}
            placeholder="https://your-team.atlassian.net"
            className="flex max-w-[460px] flex-col gap-1.5 py-1.5"
          />
          {projectRoot && (
            <TextField
              id="jira-project-url"
              label="This project's URL"
              value={projectUrls[projectRoot] ?? ''}
              onChange={(v) => setProjectUrl(projectRoot, v)}
              placeholder={externalUrl || 'Same as default URL above'}
              className="flex max-w-[460px] flex-col gap-1.5 py-1.5"
            />
          )}
          <SettingRow label="Close side panel when opening" description="Give Jira the full width.">
            <Switch label="Close side panel when opening" checked={closeSidePanelOnOpen} onChange={setCloseSidePanelOnOpen} />
          </SettingRow>
        </FeatureBlock>
      </div>
    </div>
  )
}
