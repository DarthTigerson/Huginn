import { Toggle } from '@/components/ui/Toggle'
import { useLspSettingsStore, type LspServerId } from '@/stores/lspSettingsStore'
import { useLspStatusStore } from '@/stores/lspStatusStore'

export function LspServerRow({ id }: { id: LspServerId }) {
  const enabled = useLspSettingsStore((s) => s.enabled[id])
  const setEnabled = useLspSettingsStore((s) => s.setEnabled)
  const status = useLspStatusStore((s) => s.status[id])
  const loaded = useLspStatusStore((s) => s.loaded)
  const installing = useLspStatusStore((s) => s.installing[id] ?? false)
  const output = useLspStatusStore((s) => s.installOutput[id])
  const install = useLspStatusStore((s) => s.install)

  const label = status?.label ?? id
  const ramEstimate = status?.ramEstimate

  const statusText = !loaded
    ? 'Checking…'
    : installing
      ? 'Installing…'
      : status?.found
        ? `${status.version ?? 'installed'}${ramEstimate ? ` · ${ramEstimate}` : ''}`
        : 'Not installed'

  return (
    <div className="flex flex-col gap-2">
      <Toggle label={label} description={statusText} checked={enabled ?? false} onChange={(v) => setEnabled(id, v)} />

      {loaded && (
        <button
          type="button"
          className="self-start text-xs font-medium text-accent hover:underline disabled:opacity-40 disabled:pointer-events-none"
          disabled={installing}
          onClick={() => install(id)}
        >
          {installing ? 'Installing…' : status?.found ? 'Reinstall / update' : 'Install'}
        </button>
      )}

      {output !== undefined && output.length > 0 && (
        <div className="text-xs whitespace-pre-wrap border border-border rounded p-2 max-h-40 overflow-y-auto text-fg-muted">
          {output}
        </div>
      )}
    </div>
  )
}
