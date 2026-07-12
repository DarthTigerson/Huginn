import { useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { FileIcon } from '@/components/Sidebar/FileIcon'

export function TabBar({ paneId }: { paneId: string }) {
  const tabs = useEditorStore((s) => s.tabs)
  const paneTabs = useEditorStore((s) => s.paneTabs)
  const closeTab = useEditorStore((s) => s.closeTab)
  const moveTab = useEditorStore((s) => s.moveTab)
  const setPaneActive = useEditorStore((s) => s.setPaneActive)
  const activePath = paneTabs[paneId] ?? null

  const [draggedPath, setDraggedPath] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    path: string
    placement: 'before' | 'after'
  } | null>(null)

  if (tabs.length === 0) return null

  function getDropPlacement(e: React.DragEvent<HTMLElement>): 'before' | 'after' {
    const rect = e.currentTarget.getBoundingClientRect()
    return e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  }

  function clearDragState() {
    setDraggedPath(null)
    setDropTarget(null)
  }

  return (
    <div className="flex bg-tab-bar border-b border-border overflow-x-auto shrink-0 select-none">
      {tabs.map((tab) => {
        const name = tab.path.split('/').pop() ?? tab.path
        const isActive = activePath === tab.path
        const isDragging = draggedPath === tab.path
        const isDropTarget = dropTarget?.path === tab.path && draggedPath !== tab.path
        return (
          <div
            key={tab.path}
            draggable
            className={`relative flex items-center gap-1.5 px-3 py-1.5 border-r border-border cursor-grab active:cursor-grabbing whitespace-nowrap text-sm ${
              isActive
                ? 'bg-panel text-fg border-t-2 border-t-accent -mt-px'
                : 'text-fg-muted hover:text-fg hover:bg-white/5'
            } ${isDragging ? 'opacity-45' : ''}`}
            onClick={() => setPaneActive(paneId, tab.path)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', tab.path)
              e.dataTransfer.setData('application/x-huginn-pane', paneId)
              setDraggedPath(tab.path)
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('text/plain')) return
              if (draggedPath === tab.path) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDropTarget({ path: tab.path, placement: getDropPlacement(e) })
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setDropTarget((target) => (target?.path === tab.path ? null : target))
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              const sourcePath = e.dataTransfer.getData('text/plain')
              const sourcePaneId = e.dataTransfer.getData('application/x-huginn-pane')
              const placement =
                dropTarget?.path === tab.path ? dropTarget.placement : getDropPlacement(e)
              if (sourcePath && sourcePath !== tab.path) {
                if (sourcePaneId !== paneId) {
                  setPaneActive(paneId, sourcePath)
                } else {
                  moveTab(sourcePath, tab.path, placement)
                }
              }
              clearDragState()
            }}
            onDragEnd={clearDragState}
          >
            {isDropTarget && (
              <span
                className={[
                  'absolute top-1 bottom-1 w-0.5 rounded-full bg-accent',
                  dropTarget.placement === 'before' ? 'left-0' : 'right-0',
                ].join(' ')}
              />
            )}
            <FileIcon name={name} />
            <span>{name}</span>
            {tab.missing && (
              <span
                title="File no longer exists on disk. Press Cmd+S to save it again."
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-amber-400/70 text-[10px] font-bold leading-none text-amber-300"
              >
                !
              </span>
            )}
            {tab.dirty && (
              <span className="text-accent" title="Unsaved changes">
                ●
              </span>
            )}
            <button
              type="button"
              draggable={false}
              aria-label={`Close ${name}`}
              className="text-fg-subtle hover:text-fg text-base leading-none ml-1"
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
