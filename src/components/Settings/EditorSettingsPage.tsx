import { useEditorSettingsStore } from '@/stores/editorSettingsStore'

function Toggle({ label, description, checked, onChange }: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
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
        <span
          className={[
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </label>
  )
}

export function EditorSettingsPage() {
  const autoSaveEnabled = useEditorSettingsStore((s) => s.autoSaveEnabled)
  const setAutoSaveEnabled = useEditorSettingsStore((s) => s.setAutoSaveEnabled)

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Editor</h1>
      <p className="text-sm text-fg-muted mb-8">Editing behaviour for file tabs.</p>

      <div className="grid grid-cols-1 gap-6 max-w-lg">
        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Save
          </h2>

          <Toggle
            label="Auto Save"
            description="Automatically save the active file shortly after changes."
            checked={autoSaveEnabled}
            onChange={setAutoSaveEnabled}
          />
        </section>
      </div>
    </div>
  )
}
