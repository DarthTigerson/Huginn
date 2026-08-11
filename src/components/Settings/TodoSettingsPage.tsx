import { useTodoSettingsStore } from '@/stores/todoSettingsStore'
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

export function TodoSettingsPage() {
  const enabled = useTodoSettingsStore((s) => s.enabled)
  const setEnabled = useTodoSettingsStore((s) => s.setEnabled)
  const externalUrl = useTodoSettingsStore((s) => s.externalUrl)
  const setExternalUrl = useTodoSettingsStore((s) => s.setExternalUrl)
  const closeSidePanelOnOpen = useTodoSettingsStore((s) => s.closeSidePanelOnOpen)
  const setCloseSidePanelOnOpen = useTodoSettingsStore((s) => s.setCloseSidePanelOnOpen)

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">To Do</h1>
      <p className="text-sm text-fg-muted mb-8">
        Internal task tracking isn't built yet — for now, point the To Do
        icon at an external tracker (Jira, Linear, GitHub Issues, etc.) and
        it'll open as a browser tab.
      </p>

      <div className="grid grid-cols-1 gap-6 max-w-lg">
        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            General
          </h2>

          <Toggle
            label="Enable To Do"
            description="Show the To Do icon in the activity bar. Turning this off hides it entirely; this page stays reachable so you can turn it back on."
            checked={enabled}
            onChange={setEnabled}
          />
        </section>

        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            External Todos
          </h2>

          <Field
            id="todo-external-url"
            label="URL"
            value={externalUrl}
            onChange={setExternalUrl}
            placeholder="https://your-team.atlassian.net/jira/..."
          />

          <Toggle
            label="Close side panel when opening"
            description="Collapse the currently open sidebar (Files, Git, etc.) when jumping to the To Do browser tab, to give it the full width."
            checked={closeSidePanelOnOpen}
            onChange={setCloseSidePanelOnOpen}
          />
        </section>
      </div>
    </div>
  )
}
