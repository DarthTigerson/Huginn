import { useGeneralSettingsStore, type FileTreeGitStatus } from '@/stores/generalSettingsStore'
import { RadioGroup } from '@/components/ui/RadioGroup'
import { Section, Row } from './SettingsLayout'

export function FileTreeSettingsPage() {
  const fileTreeGitStatus = useGeneralSettingsStore((s) => s.fileTreeGitStatus)
  const setFileTreeGitStatus = useGeneralSettingsStore((s) => s.setFileTreeGitStatus)

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">File Tree</h1>
      <p className="text-sm text-fg-muted mb-4">How the file tree shows your project's files.</p>

      <Section label="Git Status">
        <Row>
          <p className="text-sm text-fg mb-1">Git status in file tree</p>
          <p className="text-xs text-fg-muted max-w-[60ch] mb-3">
            Mark changed files with their git status letter (M, A, D, R or U), and optionally colour
            the file name and its folders to match.
          </p>
          <RadioGroup<FileTreeGitStatus>
            ariaLabel="Git status in file tree"
            value={fileTreeGitStatus}
            onChange={setFileTreeGitStatus}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'letter', label: 'Letter' },
              { value: 'letterAndColour', label: 'Letter + Colour' },
            ]}
          />
        </Row>
      </Section>
    </div>
  )
}
