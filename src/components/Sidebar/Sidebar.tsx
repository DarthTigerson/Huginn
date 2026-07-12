import { useEffect, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import type { FileNode } from '@/types/index'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'
import { FileTree, type TreePromptState } from './FileTree'
import { Modal } from '@/components/ui/Modal'

type CreateKind = 'file' | 'directory'

interface ContextMenuState {
  x: number
  y: number
  node: FileNode | null
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx <= 0 ? '/' : path.slice(0, idx)
}

function joinPath(dir: string, name: string): string {
  return `${dir.replace(/\/$/, '')}/${name}`
}

function copyText(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  })
}

export function Sidebar() {
  const { projectRoot, tree, openFolder, refreshRoot, expandDir } = useFileStore()
  const { openTab } = useEditorStore()
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [prompt, setPrompt] = useState<TreePromptState | null>(null)
  const [autoExpandPath, setAutoExpandPath] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileNode | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menu])

  function targetDirectory(node: FileNode | null): string | null {
    if (!projectRoot) return null
    if (!node) return projectRoot
    return node.isDirectory ? node.path : dirname(node.path)
  }

  function openContextMenu(event: MouseEvent, node: FileNode | null) {
    event.preventDefault()
    event.stopPropagation()
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - 184),
      y: Math.min(event.clientY, window.innerHeight - 260),
      node,
    })
  }

  async function startCreate(kind: CreateKind, node: FileNode | null) {
    const directory = targetDirectory(node)
    if (!directory) return
    if (node?.isDirectory && node.children === undefined) await expandDir(node.path)
    setAutoExpandPath(node?.isDirectory ? node.path : null)
    setMenu(null)
    setPrompt({
      kind,
      value: '',
      directory,
      node: null,
    })
  }

  function startRename(node: FileNode) {
    setMenu(null)
    setPrompt({
      kind: 'rename',
      value: node.name,
      directory: dirname(node.path),
      node,
    })
  }

  async function openFile(node: FileNode) {
    if (node.isDirectory) return
    setMenu(null)
    const content = await window.api.readFile(node.path)
    openTab({ path: node.path, content, dirty: false })
  }

  async function commitPrompt() {
    if (!prompt) return
    const name = prompt.value.trim()
    if (!name) {
      setAutoExpandPath(null)
      setPrompt(null)
      return
    }

    const path = joinPath(prompt.directory, name)
    if (prompt.kind === 'file') {
      await window.api.writeFile(path, '')
      await refreshRoot()
      const content = await window.api.readFile(path)
      openTab({ path, content, dirty: false })
      setAutoExpandPath(null)
    } else if (prompt.kind === 'directory') {
      await window.api.mkdir(path)
      await refreshRoot()
      setAutoExpandPath(null)
    } else if (prompt.node && path !== prompt.node.path) {
      await window.api.renamePath(prompt.node.path, path)
      await refreshRoot()
      setAutoExpandPath(null)
    }

    setPrompt(null)
  }

  function setPromptValue(value: string) {
    setPrompt((current) => current ? { ...current, value } : current)
  }

  function cancelPrompt() {
    setAutoExpandPath(null)
    setPrompt(null)
  }

  function requestTrashNode(node: FileNode) {
    setMenu(null)
    setDeleteTarget(node)
  }

  async function trashNode(node: FileNode) {
    await window.api.trashPath(node.path)
    useEditorStore.getState().markTabsMissingForDeletedPath(node.path)
    await refreshRoot()
    setDeleteTarget(null)
  }

  return (
    <div
      className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden"
      onContextMenu={(event) => openContextMenu(event, null)}
    >
      {projectRoot ? (
        <>
          <div className="h-9 px-3 flex items-center justify-between border-b border-border shrink-0">
            <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider truncate">
              {projectRoot.split('/').pop()}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            <FileTree
              nodes={tree}
              directoryPath={projectRoot}
              onContextMenu={openContextMenu}
              prompt={prompt}
              autoExpandPath={autoExpandPath}
              setPromptValue={setPromptValue}
              commitPrompt={commitPrompt}
              cancelPrompt={cancelPrompt}
            />
          </div>

          {menu && (
            <div
              className="fixed z-[200] w-44 rounded border border-border bg-sidebar p-1 shadow-2xl shadow-black/50"
              style={{ left: menu.x, top: menu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              {menu.node && !menu.node.isDirectory && (
                <ContextMenuButton onClick={() => openFile(menu.node!)}>
                  Open / Edit
                </ContextMenuButton>
              )}
              <ContextMenuButton onClick={() => startCreate('file', menu.node)}>
                Create File
              </ContextMenuButton>
              <ContextMenuButton onClick={() => startCreate('directory', menu.node)}>
                Create Directory
              </ContextMenuButton>
              {menu.node && (
                <>
                  <ContextMenuDivider />
                  <ContextMenuButton onClick={() => startRename(menu.node!)}>
                    Rename
                  </ContextMenuButton>
                  <ContextMenuButton onClick={() => {
                    copyText(menu.node!.path)
                    setMenu(null)
                  }}>
                    Copy Path
                  </ContextMenuButton>
                  <ContextMenuDivider />
                  <ContextMenuButton danger onClick={() => requestTrashNode(menu.node!)}>
                    Move to Trash
                  </ContextMenuButton>
                </>
              )}
            </div>
          )}

          {deleteTarget && (
            <Modal onClose={() => setDeleteTarget(null)}>
              <h2 className="text-sm font-semibold text-fg mb-1">Move to Trash</h2>
              <p className="text-sm text-fg-muted mb-5">
                Move{' '}
                <span className="font-mono text-fg break-all">
                  {deleteTarget.name}
                </span>{' '}
                to the Trash?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-1.5 text-sm rounded-lg border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => trashNode(deleteTarget)}
                  className="px-4 py-1.5 text-sm rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold transition-colors"
                >
                  Move to Trash
                </button>
              </div>
            </Modal>
          )}
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

function ContextMenuButton({ children, danger = false, onClick }: {
  children: ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded px-2 py-1.5 text-left text-xs transition-colors',
        danger
          ? 'text-red-300 hover:bg-red-500/15 hover:text-red-200'
          : 'text-fg-muted hover:bg-white/5 hover:text-fg',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ContextMenuDivider() {
  return <div className="my-1 h-px bg-border" />
}
