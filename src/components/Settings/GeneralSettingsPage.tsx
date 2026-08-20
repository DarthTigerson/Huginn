import { useState } from 'react'
import { useOnboardingStore } from '@/stores/onboardingStore'

export function GeneralSettingsPage() {
  const [replaying, setReplaying] = useState(false)

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">General</h1>
      <p className="text-sm text-fg-muted mb-8">App-level setup and preferences.</p>

      <div className="max-w-lg">
        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Setup Wizard</h2>
          <p className="text-sm text-fg-muted">
            Re-run the first-launch setup wizard — theme, assistant selection, CLI check, git identity,
            and (on macOS) the Automation permission prompt.
          </p>
          <button
            type="button"
            disabled={replaying}
            onClick={() => {
              setReplaying(true)
              useOnboardingStore.getState().replay().finally(() => setReplaying(false))
            }}
            className="self-start h-8 px-3 rounded border border-border text-sm text-fg hover:border-fg-subtle transition-colors disabled:opacity-50"
          >
            Replay Setup Wizard
          </button>
        </section>
      </div>
    </div>
  )
}
