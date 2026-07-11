import { useEditorStore } from '@/stores/editorStore'
import { THEMES_TAB_PATH } from './paths'

export function SettingsPanel() {
  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">
          Settings
        </span>
      </div>
      <div className="flex-1 overflow-auto py-1">
        <button
          type="button"
          onClick={() =>
            useEditorStore.getState().openTab({ path: THEMES_TAB_PATH, content: '', dirty: false })
          }
          className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          Themes
        </button>
      </div>
    </div>
  )
}
