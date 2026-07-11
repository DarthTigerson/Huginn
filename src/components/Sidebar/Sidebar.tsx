import { useRef, useState } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'
import { FileTree } from './FileTree'

export function Sidebar() {
  const { projectRoot, tree, openFolder, refreshRoot } = useFileStore()
  const { openTab } = useEditorStore()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startCreate() {
    setNewName('')
    setCreating(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelCreate() {
    setCreating(false)
    setNewName('')
  }

  async function commitCreate() {
    const name = newName.trim()
    if (!name || !projectRoot) { cancelCreate(); return }
    const path = `${projectRoot}/${name}`
    await window.api.writeFile(path, '')
    await refreshRoot()
    const content = await window.api.readFile(path)
    openTab({ path, content, dirty: false })
    cancelCreate()
  }

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      {projectRoot ? (
        <>
          <div className="px-3 py-2 flex items-center justify-between border-b border-border shrink-0 group">
            <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider truncate">
              {projectRoot.split('/').pop()}
            </span>
            <button
              onClick={startCreate}
              title="New File"
              className="text-fg-muted hover:text-fg transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {creating && (
            <div className="px-2 py-1 border-b border-border shrink-0">
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCreate()
                  if (e.key === 'Escape') cancelCreate()
                }}
                onBlur={cancelCreate}
                placeholder="filename.ext"
                className="w-full bg-panel border border-accent rounded px-2 py-0.5 text-sm text-fg placeholder-fg-subtle outline-none"
                style={{ userSelect: 'text' }}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-1">
            <FileTree nodes={tree} />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-xs text-fg-muted text-center">No folder open</p>
          <button
            onClick={openFolder}
            className="px-3 py-1.5 text-sm bg-accent hover:bg-accent/80 text-panel rounded transition-colors"
          >
            Open Folder
          </button>
        </div>
      )}
    </div>
  )
}
