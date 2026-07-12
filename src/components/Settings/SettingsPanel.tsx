import { useEditorStore } from '@/stores/editorStore'
import { THEMES_TAB_PATH, DISPLAY_TAB_PATH } from './paths'

const SETTINGS_TABS = [
  { path: DISPLAY_TAB_PATH, label: 'Display' },
  { path: THEMES_TAB_PATH,  label: 'Themes' },
]

export function SettingsPanel() {
  const activeTabPath = useEditorStore((s) => s.activeTabPath)

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider truncate">
          Settings
        </span>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {SETTINGS_TABS.map(({ path, label }) => (
          <button
            key={path}
            type="button"
            onClick={() =>
              useEditorStore.getState().openTab({ path, content: '', dirty: false })
            }
            className={[
              'w-full text-left px-3 py-1.5 text-sm transition-colors',
              activeTabPath === path
                ? 'bg-accent/10 text-fg'
                : 'text-fg hover:bg-white/5',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
