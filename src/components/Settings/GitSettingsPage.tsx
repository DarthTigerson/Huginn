import { useEffect, useState } from 'react'
import { useGitSettingsStore } from '@/stores/gitSettingsStore'
import { useGitRemoteSettingsStore } from '@/stores/gitRemoteSettingsStore'
import { useFileStore } from '@/stores/fileStore'
import { Toggle } from '@/components/ui/Toggle'

function Field({ id, label, value, onChange, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-fg">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="h-8 px-2 text-sm text-fg bg-bg border border-border rounded-lg focus:outline-none focus:border-accent/60"
      />
    </div>
  )
}

export function GitSettingsPage() {
  const {
    forceSafetyEnabled, setForceSafetyEnabled,
    countdownEnabled, setCountdownEnabled,
    countdownSeconds, setCountdownSeconds,
    autoContinueOnCountdownEnd, setAutoContinueOnCountdownEnd,
    getListDiffTargetBranch, setListDiffTargetBranch,
    periodicFetchEnabled, setPeriodicFetchEnabled,
    periodicFetchIntervalMinutes, setPeriodicFetchIntervalMinutes,
  } = useGitSettingsStore()
  const gitRemoteUrl = useGitRemoteSettingsStore((s) => s.externalUrl)
  const setGitRemoteUrl = useGitRemoteSettingsStore((s) => s.setExternalUrl)
  const gitRemoteCloseSidePanelOnOpen = useGitRemoteSettingsStore((s) => s.closeSidePanelOnOpen)
  const setGitRemoteCloseSidePanelOnOpen = useGitRemoteSettingsStore((s) => s.setCloseSidePanelOnOpen)

  const projectRoot = useFileStore((s) => s.projectRoot)
  const [branches, setBranches] = useState<string[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const listDiffTarget = projectRoot ? getListDiffTargetBranch(projectRoot) : ''

  useEffect(() => {
    if (!projectRoot) {
      setBranches([])
      return
    }
    let cancelled = false
    setLoadingBranches(true)
    window.api.gitBranches(projectRoot).then((result) => {
      if (cancelled) return
      setBranches(result)
      setLoadingBranches(false)
    })
    return () => {
      cancelled = true
    }
  }, [projectRoot])

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Git</h1>
      <p className="text-sm text-fg-muted mb-8">Safety settings and defaults for git operations.</p>

      <div className="grid grid-cols-1 gap-6 max-w-lg">
        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Force Push Safety</h2>

          <Toggle
            label="Confirm before force-pushing"
            description="Show a confirmation modal before running force push or force push with lease."
            checked={forceSafetyEnabled}
            onChange={setForceSafetyEnabled}
          />

          <div className={forceSafetyEnabled ? '' : 'opacity-40 pointer-events-none'}>
            <Toggle
              label="Countdown before confirming"
              description="Show a countdown timer instead of an immediate Confirm button."
              checked={countdownEnabled}
              onChange={setCountdownEnabled}
            />
          </div>

          {forceSafetyEnabled && countdownEnabled && (
            <div className="flex items-center gap-3 pl-1">
              <label className="text-sm text-fg-muted shrink-0">Countdown duration</label>
              <input
                type="number"
                min={1}
                max={30}
                value={countdownSeconds}
                onChange={(e) => setCountdownSeconds(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))}
                className="w-16 px-2 py-1 text-sm text-fg bg-bg border border-border rounded-lg focus:outline-none focus:border-accent/60"
              />
              <span className="text-sm text-fg-muted">seconds</span>
            </div>
          )}

          {forceSafetyEnabled && countdownEnabled && (
            <div className={countdownEnabled ? '' : 'opacity-40 pointer-events-none'}>
              <Toggle
                label="Continue automatically when countdown ends"
                description="The force push fires when the timer reaches zero, without requiring a Confirm click."
                checked={autoContinueOnCountdownEnd}
                onChange={setAutoContinueOnCountdownEnd}
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Fetch</h2>

          <Toggle
            label="Periodic background fetch"
            description="Silently fetch from the remote on an interval, on top of automatic fetches on repo open and branch switch. Keeps the ahead/behind counts in the footer accurate without a manual Fetch."
            checked={periodicFetchEnabled}
            onChange={setPeriodicFetchEnabled}
          />

          {periodicFetchEnabled && (
            <div className="flex items-center gap-3 pl-1">
              <label className="text-sm text-fg-muted shrink-0">Fetch every</label>
              <input
                type="number"
                min={1}
                max={120}
                value={periodicFetchIntervalMinutes}
                onChange={(e) => setPeriodicFetchIntervalMinutes(parseInt(e.target.value, 10) || 1)}
                className="w-16 px-2 py-1 text-sm text-fg bg-bg border border-border rounded-lg focus:outline-none focus:border-accent/60"
              />
              <span className="text-sm text-fg-muted">minutes</span>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">List Diff</h2>

          {!projectRoot ? (
            <p className="text-sm text-fg-muted">Open a repo to set its default target branch.</p>
          ) : (
            <div>
              <label htmlFor="list-diff-target-branch" className="text-xs text-fg-muted mb-1.5 block">
                Default target branch
              </label>
              <div className="relative">
                <select
                  id="list-diff-target-branch"
                  value={listDiffTarget}
                  disabled={loadingBranches}
                  onChange={(e) => setListDiffTargetBranch(projectRoot, e.target.value)}
                  className="w-full appearance-none px-3 py-2.5 pr-9 text-sm bg-bg border border-border rounded-lg text-fg focus:outline-none focus:border-accent/60 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <option value="">Use repo default</option>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle text-xs">
                  ▾
                </span>
              </div>
              <p className="text-xs text-fg-subtle mt-1.5">
                Used to compare against the current branch when opening List Diff. Leave as "Use repo default" to fall back to git's own default branch.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Git Remote</h2>
          <p className="text-xs text-fg-subtle -mt-3">
            Point this at your repo's page on GitHub, GitLab, or Bitbucket and a
            matching launcher button appears at the bottom of the Git panel.
          </p>

          <Field
            id="git-remote-external-url"
            label="URL"
            value={gitRemoteUrl}
            onChange={setGitRemoteUrl}
            placeholder="https://github.com/your-org/your-repo"
          />

          <Toggle
            label="Close side panel when opening"
            description="Collapse the currently open sidebar (Files, Git, etc.) when jumping to the repo browser tab, to give it the full width."
            checked={gitRemoteCloseSidePanelOnOpen}
            onChange={setGitRemoteCloseSidePanelOnOpen}
          />
        </section>
      </div>
    </div>
  )
}
