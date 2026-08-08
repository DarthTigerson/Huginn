import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { useAutocompleteSettingsStore, AUTOCOMPLETE_MODELS } from '@/stores/autocompleteSettingsStore'
import { Toggle } from '@/components/ui/Toggle'

export function EditorSettingsPage() {
  const autoSaveEnabled = useEditorSettingsStore((s) => s.autoSaveEnabled)
  const setAutoSaveEnabled = useEditorSettingsStore((s) => s.setAutoSaveEnabled)
  const autocompleteEnabled = useAutocompleteSettingsStore((s) => s.enabled)
  const setAutocompleteEnabled = useAutocompleteSettingsStore((s) => s.setEnabled)
  const autocompleteModel = useAutocompleteSettingsStore((s) => s.model)
  const setAutocompleteModel = useAutocompleteSettingsStore((s) => s.setModel)

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

        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Autocomplete
          </h2>

          <Toggle
            label="Inline Autocomplete"
            description="Show ghost-text code suggestions as you type, powered by your claude subscription."
            checked={autocompleteEnabled}
            onChange={setAutocompleteEnabled}
          />

          <div>
            <label htmlFor="autocomplete-model" className="text-xs text-fg-muted mb-1.5 block">Model</label>
            <div className="relative">
              <select
                id="autocomplete-model"
                value={autocompleteModel}
                onChange={(e) => setAutocompleteModel(e.target.value)}
                className="w-full appearance-none px-3 py-2.5 pr-9 text-sm bg-bg border border-border rounded-lg text-fg focus:outline-none focus:border-accent/60 transition-colors cursor-pointer"
              >
                {AUTOCOMPLETE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle text-xs">
                ▾
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
