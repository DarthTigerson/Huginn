import { useEditorStore } from '@/stores/editorStore'

export function TabBar() {
  const { tabs, activeTabPath, setActive, closeTab } = useEditorStore()

  if (tabs.length === 0) return null

  return (
    <div className="flex bg-tab-bar border-b border-border overflow-x-auto shrink-0 select-none">
      {tabs.map((tab) => {
        const name = tab.path.split('/').pop() ?? tab.path
        const isActive = activeTabPath === tab.path
        return (
          <div
            key={tab.path}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-border cursor-pointer whitespace-nowrap text-sm ${
              isActive
                ? 'bg-panel text-white border-t-2 border-t-accent -mt-px'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
            onClick={() => setActive(tab.path)}
          >
            <span>{name}{tab.dirty ? ' ●' : ''}</span>
            <button
              className="text-gray-600 hover:text-gray-200 text-base leading-none ml-1"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.path)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
