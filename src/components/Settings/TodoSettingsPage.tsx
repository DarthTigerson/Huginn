import { useTodoSettingsStore } from '@/stores/todoSettingsStore'
import { Toggle } from '@/components/ui/Toggle'

export function TodoSettingsPage() {
  const enabled = useTodoSettingsStore((s) => s.enabled)
  const setEnabled = useTodoSettingsStore((s) => s.setEnabled)

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">To Do</h1>
      <p className="text-sm text-fg-muted mb-8">
        Internal task tracking isn't built yet. Coming soon.
      </p>

      <div className="grid grid-cols-1 gap-6 max-w-lg">
        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            General
          </h2>

          <Toggle
            label="Enable To Do"
            description="Coming soon."
            checked={enabled}
            onChange={setEnabled}
            disabled
          />
        </section>
      </div>
    </div>
  )
}
