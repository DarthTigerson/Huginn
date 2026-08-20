import { useModelSettingsStore } from '@/stores/modelSettingsStore'
import { Toggle } from '@/components/ui/Toggle'
import type { AssistantKind } from '@/types/api'

const MODEL_TOGGLES: Array<{ id: AssistantKind; label: string; description: string }> = [
  { id: 'claude', label: 'Claude', description: 'Claude Code CLI, run as a terminal panel.' },
  { id: 'codex', label: 'Codex', description: 'OpenAI Codex CLI, run as a terminal panel.' },
  { id: 'bridge', label: 'Bridge', description: 'Any OpenAI-compatible local LLM endpoint.' },
]

export function AssistantsStep() {
  const enabledModels = useModelSettingsStore((s) => s.enabled)
  const setModelEnabled = useModelSettingsStore((s) => s.setEnabled)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">Which assistants do you use?</h2>
        <p className="text-xs text-fg-muted mt-0.5">
          Controls what shows up in the assistant dropdown. Change this anytime in Settings → Models.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {MODEL_TOGGLES.map((model) => (
          <Toggle
            key={model.id}
            label={model.label}
            description={model.description}
            checked={enabledModels[model.id]}
            onChange={(value) => setModelEnabled(model.id, value)}
          />
        ))}
      </div>
    </div>
  )
}
