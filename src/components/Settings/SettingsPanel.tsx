import { useEditorStore } from '@/stores/editorStore'
import { DISPLAY_TAB_PATH } from './paths'

export function SettingsPanel() {
  const activeTabPath = useEditorStore((s) => s.activeTabPath)
  const isActive = activeTabPath === DISPLAY_TAB_PATH

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider truncate">
          Settings
        </span>
      </div>
      <div className="flex-1 overflow-auto py-1">
        <button
          type="button"
          onClick={() =>
            useEditorStore.getState().openTab({ path: DISPLAY_TAB_PATH, content: '', dirty: false })
          }
          className={[
            'w-full text-left px-3 py-1.5 text-sm transition-colors',
            isActive ? 'bg-accent/10 text-fg' : 'text-fg hover:bg-white/5',
          ].join(' ')}
        >
          Display
        </button>
      </div>
    </div>
  )
}
