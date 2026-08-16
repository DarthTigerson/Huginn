import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MouseEvent, ReactNode } from 'react'
import type { GitFileEntry } from '@/types/index'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore, useRepoGitState } from '@/stores/gitStore'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useEditorStore } from '@/stores/editorStore'
import { useGitGraphStore } from '@/stores/gitGraphStore'
import { buildGitDiffPath } from './paths'
import { GIT_BRANCH_DIFF_TAB_PATH, GIT_GRAPH_TAB_PATH } from '@/components/Settings/paths'
import { Modal } from '@/components/ui/Modal'
import { clampToViewport } from '@/components/ui/clampToViewport'
import { useSearchStore } from '@/stores/searchStore'
import { FileRow } from './FileRow'
import { ConfirmForcePushModal } from './ConfirmForcePushModal'
import { useForcePushConfirm } from './useForcePushConfirm'
import { useCommitMessageSettingsStore } from '@/stores/commitMessageSettingsStore'

const pillButtonClass =
  'group w-full h-7 rounded-full flex items-center justify-center text-[0.625rem] font-bold tracking-tight bg-gradient-to-br from-accent/25 to-accent/5 text-accent ring-1 ring-accent/30 shadow-sm shadow-black/20 transition-all duration-150 hover:ring-accent/60 hover:from-accent/35 hover:to-accent/10 active:scale-95'

const dangerPillButtonClass =
  'w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[0.625rem] font-bold tracking-tight bg-gradient-to-br from-red-500/25 to-red-500/5 text-red-400 ring-1 ring-red-500/30 shadow-sm shadow-black/20 transition-all duration-150 hover:ring-red-500/60 hover:from-red-500/35 hover:to-red-500/10 active:scale-95'

interface ContextMenuState {
  x: number
  y: number
  file: GitFileEntry
  staged: boolean
}

function SparkleIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" fill="currentColor" />
    </svg>
  )
}

function DiscardAllIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function GitPanel() {
  const repos = useGitReposStore((s) => s.repos)
  const selectedRepo = useGitReposStore((s) => s.selectedRepo)
  const selectRepo = useGitReposStore((s) => s.selectRepo)
  const {
    branch,
    status,
    commitMessage,
    commitError,
    commandStatus,
  } = useRepoGitState(selectedRepo)
  const {
    refreshStatus,
    stage,
    unstage,
    stageAll,
    unstageAll,
    discard,
    discardAll,
    setCommitMessage,
    commit,
    fetch: gitFetch,
    pull,
    push,
  } = useGitStore()
  const openTab = useEditorStore((s) => s.openTab)
  const loadGraph = useGitGraphStore((s) => s.load)
  const { forceAction, requestForce, closeForce } = useForcePushConfirm(selectedRepo)
  const commitMessageEnabled = useCommitMessageSettingsStore((s) => s.enabled)
  const commitMessageModel = useCommitMessageSettingsStore((s) => s.model)
  const commitMessagePrompt = useCommitMessageSettingsStore((s) => s.prompt)
  const [generatingMessage, setGeneratingMessage] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  async function generateCommitMessage() {
    if (!selectedRepo) return
    setGeneratingMessage(true)
    setGenerateError(null)
    try {
      const diff = await window.api.gitStagedDiff(selectedRepo)
      const message = await window.api.commitMessageGenerate(diff, commitMessageModel, commitMessagePrompt)
      if (message) {
        setCommitMessage(selectedRepo, message)
      } else {
        setGenerateError('Could not generate a commit message')
      }
    } finally {
      setGeneratingMessage(false)
    }
  }

  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [discardTarget, setDiscardTarget] = useState<GitFileEntry | null>(null)
  const [discardAllConfirmOpen, setDiscardAllConfirmOpen] = useState(false)

  useEffect(() => {
    refreshStatus(selectedRepo)
    const onFocus = () => refreshStatus(selectedRepo)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [selectedRepo, refreshStatus])

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

  // Measure the actual rendered menu and clamp for real, before paint —
  // a hardcoded size estimate at the click site can under-guess it and let
  // the menu overhang the window.
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const clamped = clampToViewport(menu.x, menu.y, rect.width, rect.height)
    menuRef.current.style.left = `${clamped.x}px`
    menuRef.current.style.top = `${clamped.y}px`
  }, [menu])

  function openContextMenu(event: MouseEvent, file: GitFileEntry, staged: boolean) {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, file, staged })
  }

  function openDiff(path: string, staged: boolean) {
    if (!selectedRepo) return
    openTab({ path: buildGitDiffPath(selectedRepo, path, staged), content: '', dirty: false })
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
    if (!selectedRepo) return
    await window.api.trashPath(`${selectedRepo}/${file.path}`)
    await refreshStatus(selectedRepo)
  }

  const isUntracked = menu?.file.status === '?'
  const isTrackedChange = menu && !menu.staged && menu.file.status !== '?'
  const remoteActionDisabled = commandStatus === 'running' || !selectedRepo
  // Matches discardAllChanges' scope (git reset --hard HEAD): staged changes
  // plus unstaged changes to already-tracked files. Untracked ('?') entries
  // aren't affected by that command, so they don't count toward "has
  // anything to discard" — the button would otherwise look enabled but do
  // nothing when only new/untracked files are present.
  const hasDiscardableChanges =
    status.staged.length > 0 || status.unstaged.some((file) => file.status !== '?')

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="h-9 px-3 border-b border-border shrink-0 flex items-center">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
          Git Panel
        </span>
      </div>

      {repos.length > 1 && (
        <div className="px-3 py-1.5 border-b border-border shrink-0">
          <select
            aria-label="Select repository"
            value={selectedRepo ?? ''}
            onChange={(e) => selectRepo(e.target.value)}
            className="w-full h-6 rounded border border-border bg-bg px-1.5 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            {repos.map((repo) => (
              <option key={repo} value={repo}>
                {repo.split('/').pop()}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="px-3 py-2 border-b border-border shrink-0 flex flex-col gap-1.5">
        <div className="relative">
          <textarea
            value={commitMessage}
            onChange={(e) => selectedRepo && setCommitMessage(selectedRepo, e.target.value)}
            placeholder="Message"
            rows={3}
            className="w-full resize-none rounded border border-border bg-bg px-2 py-1.5 pb-6 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          {commitMessageEnabled && (
            <button
              type="button"
              title="Generate commit message from staged changes"
              disabled={generatingMessage || status.staged.length === 0}
              onClick={generateCommitMessage}
              className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <SparkleIcon spinning={generatingMessage} />
            </button>
          )}
        </div>
        {generateError && <p className="text-xs text-red-400">{generateError}</p>}
        {commitError && <p className="text-xs text-red-400">{commitError}</p>}
        <button
          type="button"
          disabled={!commitMessage.trim() || status.staged.length === 0}
          onClick={() => selectedRepo && commit(selectedRepo)}
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
              onClick={() => selectedRepo && unstageAll(selectedRepo)}
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
              onToggle={() => selectedRepo && unstage(selectedRepo, file.path)}
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
            <span className="flex items-center gap-2">
              <button
                type="button"
                title="Discard All Changes"
                aria-label="Discard All Changes"
                disabled={!hasDiscardableChanges}
                onClick={() => setDiscardAllConfirmOpen(true)}
                className="text-fg-muted transition-colors hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-fg-muted"
              >
                <DiscardAllIcon />
              </button>
              <button
                type="button"
                onClick={() => selectedRepo && stageAll(selectedRepo)}
                className="text-[0.6875rem] text-fg-muted transition-colors hover:text-fg"
              >
                +
              </button>
            </span>
          </div>
          {status.unstaged.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              staged={false}
              onToggle={() => selectedRepo && stage(selectedRepo, file.path)}
              onOpenDiff={() => openDiff(file.path, false)}
              onContextMenu={(e) => openContextMenu(e, file, false)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border shrink-0 px-3 py-2 flex flex-col gap-1.5">
        <button
          type="button"
          className={`${pillButtonClass} px-2 overflow-hidden`}
          disabled={remoteActionDisabled}
          onClick={() => useSearchStore.getState().openBranchPalette()}
        >
          <span className="truncate min-w-0">Branch: {branch ?? '—'}</span>
        </button>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={pillButtonClass}
            disabled={remoteActionDisabled}
            onClick={() => selectedRepo && gitFetch(selectedRepo)}
          >
            Fetch
          </button>
          <button
            type="button"
            className={pillButtonClass}
            disabled={remoteActionDisabled}
            onClick={() => selectedRepo && pull(selectedRepo)}
          >
            Pull
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={pillButtonClass}
            disabled={remoteActionDisabled}
            onClick={() => selectedRepo && push(selectedRepo)}
          >
            Push
          </button>
          <button
            type="button"
            title="Force Push"
            className={dangerPillButtonClass}
            disabled={remoteActionDisabled}
            onClick={() => requestForce('forcePush')}
          >
            F
          </button>
          <button
            type="button"
            title="Force Push with Lease"
            className={dangerPillButtonClass}
            disabled={remoteActionDisabled}
            onClick={() => requestForce('forcePushLease')}
          >
            L
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={pillButtonClass}
            onClick={() => {
              openTab({ path: GIT_GRAPH_TAB_PATH, content: '', dirty: false })
              if (selectedRepo) loadGraph(selectedRepo)
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
      </div>

      {menu && createPortal(
        <div
          ref={menuRef}
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
            <ContextMenuButton onClick={() => { selectedRepo && unstage(selectedRepo, menu.file.path); setMenu(null) }}>
              Unstage
            </ContextMenuButton>
          ) : (
            <ContextMenuButton onClick={() => { selectedRepo && stage(selectedRepo, menu.file.path); setMenu(null) }}>
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
        </div>,
        document.body
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
                if (selectedRepo) discard(selectedRepo, discardTarget.path)
                setDiscardTarget(null)
              }}
              className="px-4 py-1.5 text-sm rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold transition-colors"
            >
              Discard
            </button>
          </div>
        </Modal>
      )}

      {discardAllConfirmOpen && (
        <Modal onClose={() => setDiscardAllConfirmOpen(false)}>
          <h2 className="text-sm font-semibold text-fg mb-1">Discard All Changes</h2>
          <p className="text-sm text-fg-muted mb-5">
            Discard all staged and unstaged changes to tracked files? Untracked files are left
            alone. This cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDiscardAllConfirmOpen(false)}
              className="px-4 py-1.5 text-sm rounded-lg border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedRepo) discardAll(selectedRepo)
                setDiscardAllConfirmOpen(false)
              }}
              className="px-4 py-1.5 text-sm rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold transition-colors"
            >
              Discard All
            </button>
          </div>
        </Modal>
      )}

      {forceAction && selectedRepo && (
        <ConfirmForcePushModal action={forceAction} cwd={selectedRepo} onClose={closeForce} />
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
