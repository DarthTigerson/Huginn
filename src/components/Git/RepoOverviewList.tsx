import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MouseEvent } from 'react'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGitStore, useRepoGitState } from '@/stores/gitStore'
import { useSidebarUiStore } from '@/stores/sidebarUiStore'
import { clampToViewport } from '@/components/ui/clampToViewport'
import { ContextMenuButton } from './ContextMenu'

interface Props {
  onClose: () => void
}

interface ContextMenuState {
  x: number
  y: number
  repo: string
}

function RepoRow({ repo, onSelect, onContextMenu }: {
  repo: string
  onSelect: (repo: string) => void
  onContextMenu: (event: MouseEvent, repo: string) => void
}) {
  const { branch, status, aheadBehind } = useRepoGitState(repo)
  const name = repo.split('/').pop()

  return (
    <button
      type="button"
      onClick={() => onSelect(repo)}
      onContextMenu={(e) => onContextMenu(e, repo)}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors border-b border-border last:border-b-0"
    >
      <span className="flex flex-col min-w-0">
        <span className="truncate text-fg">{name}</span>
        <span className="truncate text-xs text-fg-muted">{branch ?? '—'}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0 text-xs text-fg-muted tabular-nums">
        {aheadBehind && (
          <span className="flex items-center gap-1">
            <span>↓{aheadBehind.behind}</span>
            <span>↑{aheadBehind.ahead}</span>
          </span>
        )}
        <span>{status.staged.length + status.unstaged.length}</span>
      </span>
    </button>
  )
}

// Re-fetches every repo on each open rather than continuously polling
// repos that aren't selected — matches the refresh strategy in the design
// doc (only selectedRepo stays "live" via the git file watcher; this list
// is a point-in-time snapshot, refreshed on demand).
export function RepoOverviewList({ onClose }: Props) {
  const repos = useGitReposStore((s) => s.repos)
  const selectRepo = useGitReposStore((s) => s.selectRepo)
  const refresh = useGitStore((s) => s.refresh)
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    repos.forEach((repo) => refresh(repo))
    // Re-fetch every time this view mounts (i.e. every time it's opened),
    // not on every repos-array identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Same clamp-after-measure approach as GitPanel's file context menu —
  // a hardcoded size guess at the click site can under-guess it and let
  // the menu overhang the window.
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const clamped = clampToViewport(menu.x, menu.y, rect.width, rect.height)
    menuRef.current.style.left = `${clamped.x}px`
    menuRef.current.style.top = `${clamped.y}px`
  }, [menu])

  function handleSelect(repo: string) {
    selectRepo(repo)
    onClose()
  }

  function openContextMenu(event: MouseEvent, repo: string) {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, repo })
  }

  function goToFileTree(repo: string) {
    useSidebarUiStore.getState().requestReveal(repo)
    onClose()
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {repos.map((repo) => (
        <RepoRow key={repo} repo={repo} onSelect={handleSelect} onContextMenu={openContextMenu} />
      ))}

      {menu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[200] w-44 rounded border border-border bg-popover p-1 shadow-2xl shadow-black/50"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuButton onClick={() => { goToFileTree(menu.repo); setMenu(null) }}>
            Go to File Tree
          </ContextMenuButton>
        </div>,
        document.body
      )}
    </div>
  )
}
