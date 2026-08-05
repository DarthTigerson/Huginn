import { useEffect, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import type { GitFileEntry } from '@/types/index'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore } from '@/stores/gitStore'
import { useEditorStore } from '@/stores/editorStore'
import { useGitGraphStore } from '@/stores/gitGraphStore'
import { buildGitDiffPath } from './paths'
import { GIT_BRANCH_DIFF_TAB_PATH, GIT_GRAPH_TAB_PATH } from '@/components/Settings/paths'
import { Modal } from '@/components/ui/Modal'
import { FileRow } from './FileRow'

const pillButtonClass =
  'group w-full h-7 rounded-full flex items-center justify-center text-[0.625rem] font-bold tracking-tight bg-gradient-to-br from-accent/25 to-accent/5 text-accent ring-1 ring-accent/30 shadow-sm shadow-black/20 transition-all duration-150 hover:ring-accent/60 hover:from-accent/35 hover:to-accent/10 hover:scale-105 active:scale-95'

interface ContextMenuState {
  x: number
  y: number
  file: GitFileEntry
  staged: boolean
}

export function GitPanel() {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const {
    status,
    commitMessage,
    commitError,
    refreshStatus,
    stage,
    unstage,
    stageAll,
    unstageAll,
    discard,
    setCommitMessage,
    commit,
  } = useGitStore()
  const openTab = useEditorStore((s) => s.openTab)
  const loadGraph = useGitGraphStore((s) => s.load)

  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [discardTarget, setDiscardTarget] = useState<GitFileEntry | null>(null)

  useEffect(() => {
    refreshStatus(projectRoot)
    const onFocus = () => refreshStatus(projectRoot)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [projectRoot, refreshStatus])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    window.addEventListener('click', close)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [menu])

  function openContextMenu(event: MouseEvent, file: GitFileEntry, staged: boolean) {
    event.preventDefault()
    event.stopPropagation()
    setMenu({
      x: Math.min(event.clientX, window.innerWidth - 176),
      y: Math.min(event.clientY, window.innerHeight - 200),
      file,
      staged,
    })
  }

  function openDiff(path: string, staged: boolean) {
    openTab({ path: buildGitDiffPath(path, staged), content: '', dirty: false })
  }

  function copyPath(path: string) {
    navigator.clipboard?.writeText(path).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = path
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    })
  }

  async function trashUntrackedFile(file: GitFileEntry) {
    if (!projectRoot) return
    await window.api.trashPath(`${projectRoot}/${file.path}`)
    await refreshStatus(projectRoot)
  }

  const isUntracked = menu?.file.status === '?'
  const isTrackedChange = menu && !menu.staged && menu.file.status !== '?'

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="h-9 px-3 border-b border-border shrink-0 flex items-center">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Git Panel
        </span>
      </div>

      <div className="px-3 py-2 border-b border-border shrink-0 flex flex-col gap-1.5">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Message"
          rows={3}
          className="w-full resize-none rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        {commitError && <p className="text-xs text-red-400">{commitError}</p>}
        <button
          type="button"
          disabled={!commitMessage.trim() || status.staged.length === 0}
          onClick={() => projectRoot && commit(projectRoot)}
          className="w-full h-7 rounded-full flex items-center justify-center text-xs font-semibold bg-accent/80 text-bg transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Commit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <div className="mb-2">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[0.6875rem] font-semibold text-fg-muted uppercase tracking-wider">
              Staged Changes ({status.staged.length})
            </span>
            <button
              type="button"
              onClick={() => projectRoot && unstageAll(projectRoot)}
              className="text-[0.6875rem] text-fg-muted transition-colors hover:text-fg"
            >
              -
            </button>
          </div>
          {status.staged.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              staged
              onToggle={() => projectRoot && unstage(projectRoot, file.path)}
              onOpenDiff={() => openDiff(file.path, true)}
              onContextMenu={(e) => openContextMenu(e, file, true)}
            />
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[0.6875rem] font-semibold text-fg-muted uppercase tracking-wider">
              Changes ({status.unstaged.length})
            </span>
            <button
              type="button"
              onClick={() => projectRoot && stageAll(projectRoot)}
              className="text-[0.6875rem] text-fg-muted transition-colors hover:text-fg"
            >
              +
            </button>
          </div>
          {status.unstaged.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              staged={false}
              onToggle={() => projectRoot && stage(projectRoot, file.path)}
              onOpenDiff={() => openDiff(file.path, false)}
              onContextMenu={(e) => openContextMenu(e, file, false)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border shrink-0 px-3 py-2 flex flex-col gap-1.5">
        <button
          type="button"
          className={pillButtonClass}
          onClick={() => {
            openTab({ path: GIT_GRAPH_TAB_PATH, content: '', dirty: false })
            if (projectRoot) loadGraph(projectRoot)
          }}
        >
          Graph
        </button>
        <button
          type="button"
          className={pillButtonClass}
          onClick={() => openTab({ path: GIT_BRANCH_DIFF_TAB_PATH, content: '', dirty: false })}
        >
          List Diff
        </button>
      </div>

      {menu && (
        <div
          className="fixed z-[200] w-44 rounded border border-border bg-popover p-1 shadow-2xl shadow-black/50"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {!isUntracked && (
            <ContextMenuButton onClick={() => { openDiff(menu.file.path, menu.staged); setMenu(null) }}>
              View Diff
            </ContextMenuButton>
          )}
          {menu.staged ? (
            <ContextMenuButton onClick={() => { projectRoot && unstage(projectRoot, menu.file.path); setMenu(null) }}>
              Unstage
            </ContextMenuButton>
          ) : (
            <ContextMenuButton onClick={() => { projectRoot && stage(projectRoot, menu.file.path); setMenu(null) }}>
              Stage
            </ContextMenuButton>
          )}
          {isTrackedChange && (
            <>
              <ContextMenuDivider />
              <ContextMenuButton danger onClick={() => { setDiscardTarget(menu.file); setMenu(null) }}>
                Discard Changes
              </ContextMenuButton>
            </>
          )}
          {isUntracked && (
            <>
              <ContextMenuDivider />
              <ContextMenuButton danger onClick={() => { trashUntrackedFile(menu.file); setMenu(null) }}>
                Move to Trash
              </ContextMenuButton>
            </>
          )}
          <ContextMenuDivider />
          <ContextMenuButton onClick={() => { copyPath(menu.file.path); setMenu(null) }}>
            Copy Path
          </ContextMenuButton>
        </div>
      )}

      {discardTarget && (
        <Modal onClose={() => setDiscardTarget(null)}>
          <h2 className="text-sm font-semibold text-fg mb-1">Discard Changes</h2>
          <p className="text-sm text-fg-muted mb-5">
            Discard local changes to{' '}
            <span className="font-mono text-fg break-all">
              {discardTarget.path.split('/').pop()}
            </span>
            ? This cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDiscardTarget(null)}
              className="px-4 py-1.5 text-sm rounded-lg border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (projectRoot) discard(projectRoot, discardTarget.path)
                setDiscardTarget(null)
              }}
              className="px-4 py-1.5 text-sm rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold transition-colors"
            >
              Discard
            </button>
          </div>
        </Modal>
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
