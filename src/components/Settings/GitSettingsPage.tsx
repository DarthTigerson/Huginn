import { useGitSettingsStore } from '@/stores/gitSettingsStore'

function Toggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div>
        <div className="text-sm text-fg">{label}</div>
        <div className="text-xs text-fg-muted mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5',
          checked ? 'bg-accent' : 'bg-fg-subtle/40',
        ].join(' ')}
      >
        <span className={[
          'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')} />
      </button>
    </label>
  )
}

export function GitSettingsPage() {
  const {
    forceSafetyEnabled, setForceSafetyEnabled,
    countdownEnabled, setCountdownEnabled,
    countdownSeconds, setCountdownSeconds,
    autoContinueOnCountdownEnd, setAutoContinueOnCountdownEnd,
  } = useGitSettingsStore()

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Git</h1>
      <p className="text-sm text-fg-muted mb-8">Safety settings for destructive git operations.</p>

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
      </div>
    </div>
  )
}
