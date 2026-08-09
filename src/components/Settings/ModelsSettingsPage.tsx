import { useState } from 'react'
import { useModelSettingsStore } from '@/stores/modelSettingsStore'
import { useAutocompleteSettingsStore, AUTOCOMPLETE_MODELS } from '@/stores/autocompleteSettingsStore'
import { useCosmosSettingsStore } from '@/stores/cosmosSettingsStore'
import { useInlineEditSettingsStore } from '@/stores/inlineEditSettingsStore'
import { Toggle } from '@/components/ui/Toggle'
import type { AssistantKind } from '@/types/api'

const MODEL_TOGGLES: Array<{ id: AssistantKind; label: string; description: string }> = [
  { id: 'claude', label: 'Claude', description: 'Show Claude Code in the model dropdown.' },
  { id: 'codex', label: 'Codex', description: 'Show Codex in the model dropdown.' },
  { id: 'cosmos', label: 'Cosmos', description: 'Show Cosmos in the model dropdown.' },
]

function Field({ id, label, value, onChange, type = 'text' }: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-fg">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 px-2 text-sm text-fg bg-bg border border-border rounded-lg focus:outline-none focus:border-accent/60"
      />
    </div>
  )
}

function CosmosConnectionSection() {
  const { endpoint, apiKey, modelId, setEndpoint, setApiKey, setModelId } = useCosmosSettingsStore()
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  const runTest = async () => {
    setTestState('testing')
    setTestError('')
    const result = await window.api.cosmosTestConnection({ endpoint, apiKey, modelId })
    if (result.ok) {
      setTestState('ok')
    } else {
      setTestState('error')
      setTestError(result.error ?? 'Unknown error')
    }
  }

  return (
    <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
      <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Cosmos</h2>

      <Field id="cosmos-endpoint" label="Endpoint" value={endpoint} onChange={setEndpoint} />
      <Field id="cosmos-apikey" label="API Key" value={apiKey} onChange={setApiKey} />
      <Field id="cosmos-model" label="Model ID" value={modelId} onChange={setModelId} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runTest}
          disabled={testState === 'testing'}
          className="h-8 px-3 rounded border border-border text-sm text-fg hover:border-fg-subtle transition-colors disabled:opacity-50"
        >
          Test Connection
        </button>
        {testState === 'ok' && <span className="text-sm text-green-500">Connected</span>}
        {testState === 'error' && <span className="text-sm text-red-500">{testError}</span>}
      </div>
    </section>
  )
}

export function ModelsSettingsPage() {
  const enabledModels = useModelSettingsStore((s) => s.enabled)
  const setModelEnabled = useModelSettingsStore((s) => s.setEnabled)
  const autocompleteEnabled = useAutocompleteSettingsStore((s) => s.enabled)
  const setAutocompleteEnabled = useAutocompleteSettingsStore((s) => s.setEnabled)
  const autocompleteModel = useAutocompleteSettingsStore((s) => s.model)
  const setAutocompleteModel = useAutocompleteSettingsStore((s) => s.setModel)
  const inlineEditEnabled = useInlineEditSettingsStore((s) => s.enabled)
  const setInlineEditEnabled = useInlineEditSettingsStore((s) => s.setEnabled)
  const inlineEditModel = useInlineEditSettingsStore((s) => s.model)
  const setInlineEditModel = useInlineEditSettingsStore((s) => s.setModel)

  return (
    <div className="h-full overflow-auto p-6 bg-panel">
      <h1 className="text-base font-semibold text-fg mb-1">Models</h1>
      <p className="text-sm text-fg-muted mb-8">Assistants and model-powered features.</p>

      <div className="grid grid-cols-1 gap-6 max-w-lg">
        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Assistants
          </h2>

          {MODEL_TOGGLES.map((model) => (
            <Toggle
              key={model.id}
              label={model.label}
              description={model.description}
              checked={enabledModels[model.id]}
              onChange={(value) => setModelEnabled(model.id, value)}
            />
          ))}
        </section>

        {enabledModels.cosmos && <CosmosConnectionSection />}

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

        <section className="rounded-xl border border-border/60 p-4 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
            Inline Edit
          </h2>

          <Toggle
            label="Inline Edit (Cmd+K)"
            description="Select code (or place your cursor) and press Cmd+K to describe a change."
            checked={inlineEditEnabled}
            onChange={setInlineEditEnabled}
          />

          <div>
            <label htmlFor="inline-edit-model" className="text-xs text-fg-muted mb-1.5 block">Inline Edit Model</label>
            <div className="relative">
              <select
                id="inline-edit-model"
                value={inlineEditModel}
                onChange={(e) => setInlineEditModel(e.target.value)}
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
