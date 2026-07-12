import { useEditorStore } from '@/stores/editorStore'
import { DISPLAY_TAB_PATH, EDITOR_SETTINGS_TAB_PATH, GIT_SETTINGS_TAB_PATH } from './paths'

export function SettingsPanel() {
  const activeTabPath = useEditorStore((s) => s.activeTabPath)
  const isActive = activeTabPath === DISPLAY_TAB_PATH
  const isEditorActive = activeTabPath === EDITOR_SETTINGS_TAB_PATH
  const isGitActive = activeTabPath === GIT_SETTINGS_TAB_PATH

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
      </div>
    </div>
  )
}
