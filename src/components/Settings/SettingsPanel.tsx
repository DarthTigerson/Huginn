import { useEditorStore } from '@/stores/editorStore'
import { useModelSettingsStore } from '@/stores/modelSettingsStore'
import { Toggle } from '@/components/ui/Toggle'
import type { AssistantKind } from '@/types/api'
import { DISPLAY_TAB_PATH, EDITOR_SETTINGS_TAB_PATH, GIT_SETTINGS_TAB_PATH, COSMOS_SETTINGS_TAB_PATH, BROWSER_SETTINGS_TAB_PATH } from './paths'

const MODEL_TOGGLES: Array<{ id: AssistantKind; label: string; description: string }> = [
  { id: 'claude', label: 'Claude', description: 'Show Claude Code in the model dropdown.' },
  { id: 'codex', label: 'Codex', description: 'Show Codex in the model dropdown.' },
  { id: 'cosmos', label: 'Cosmos', description: 'Show Cosmos in the model dropdown.' },
]

export function SettingsPanel() {
  const activeTabPath = useEditorStore((s) => s.activeTabPath)
  const enabledModels = useModelSettingsStore((s) => s.enabled)
  const setModelEnabled = useModelSettingsStore((s) => s.setEnabled)
  const isActive = activeTabPath === DISPLAY_TAB_PATH
  const isEditorActive = activeTabPath === EDITOR_SETTINGS_TAB_PATH
  const isGitActive = activeTabPath === GIT_SETTINGS_TAB_PATH
  const isCosmosActive = activeTabPath === COSMOS_SETTINGS_TAB_PATH
  const isBrowserActive = activeTabPath === BROWSER_SETTINGS_TAB_PATH

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="h-9 px-3 border-b border-border shrink-0 flex items-center">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider truncate">
          Settings
        </span>
      </div>
      <div className="flex-1 overflow-auto py-1">
        <button
          type="button"
          onClick={() =>
            useEditorStore.getState().openTab({
              path: DISPLAY_TAB_PATH,
              content: '',
              dirty: false,
            })
          }
          className={[
            'w-full text-left px-3 py-1.5 text-sm transition-colors',
            isActive ? 'bg-accent/10 text-fg' : 'text-fg hover:bg-white/5',
          ].join(' ')}
        >
          Display
        </button>
        <button
          type="button"
          onClick={() =>
            useEditorStore.getState().openTab({
              path: EDITOR_SETTINGS_TAB_PATH,
              content: '',
              dirty: false,
            })
          }
          className={[
            'w-full text-left px-3 py-1.5 text-sm transition-colors',
            isEditorActive ? 'bg-accent/10 text-fg' : 'text-fg hover:bg-white/5',
          ].join(' ')}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() =>
            useEditorStore.getState().openTab({
              path: GIT_SETTINGS_TAB_PATH,
              content: '',
              dirty: false,
            })
          }
          className={[
            'w-full text-left px-3 py-1.5 text-sm transition-colors',
            isGitActive ? 'bg-accent/10 text-fg' : 'text-fg hover:bg-white/5',
          ].join(' ')}
        >
          Git
        </button>
        <button
          type="button"
          onClick={() =>
            useEditorStore.getState().openTab({
              path: COSMOS_SETTINGS_TAB_PATH,
              content: '',
              dirty: false,
            })
          }
          className={[
            'w-full text-left px-3 py-1.5 text-sm transition-colors',
            isCosmosActive ? 'bg-accent/10 text-fg' : 'text-fg hover:bg-white/5',
          ].join(' ')}
        >
          Cosmos
        </button>
        <button
          type="button"
          onClick={() =>
            useEditorStore.getState().openTab({
              path: BROWSER_SETTINGS_TAB_PATH,
              content: '',
              dirty: false,
            })
          }
          className={[
            'w-full text-left px-3 py-1.5 text-sm transition-colors',
            isBrowserActive ? 'bg-accent/10 text-fg' : 'text-fg hover:bg-white/5',
          ].join(' ')}
        >
          Browser
        </button>

        <div className="mt-3 px-3 py-1 text-[0.6875rem] font-semibold text-fg-muted uppercase tracking-wider">
          Models
        </div>
        <div className="px-3 py-1 flex flex-col gap-3">
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
    </div>
  )
}
