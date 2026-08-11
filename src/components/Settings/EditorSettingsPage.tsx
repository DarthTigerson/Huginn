import { useEffect } from 'react'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { Toggle } from '@/components/ui/Toggle'
import { LSP_SERVER_IDS } from '@/stores/lspSettingsStore'
import { useLspStatusStore, subscribeLspInstallEvents } from '@/stores/lspStatusStore'
import { LspServerRow } from './LspServerRow'

export function EditorSettingsPage() {
  const autoSaveEnabled = useEditorSettingsStore((s) => s.autoSaveEnabled)
  const setAutoSaveEnabled = useEditorSettingsStore((s) => s.setAutoSaveEnabled)
  const refreshLspStatus = useLspStatusStore((s) => s.refresh)

  useEffect(() => {
    subscribeLspInstallEvents()
    refreshLspStatus()
  }, [refreshLspStatus])

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
          <div>
            <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
              Language Intelligence
            </h2>
            <p className="text-xs text-fg-muted mt-1">
              Cmd+click go-to-definition, backed by each language's own language server. Off by
              default since a running server has a real memory cost — enable only the languages
              you use.
            </p>
          </div>

          {LSP_SERVER_IDS.map((id) => (
            <LspServerRow key={id} id={id} />
          ))}
        </section>
      </div>
    </div>
  )
}
