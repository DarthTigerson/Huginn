import { useEffect } from 'react'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGitStore, useRepoGitState } from '@/stores/gitStore'

interface Props {
  onClose: () => void
}

function RepoRow({ repo, onSelect }: { repo: string; onSelect: (repo: string) => void }) {
  const { branch, status, aheadBehind } = useRepoGitState(repo)
  const name = repo.split('/').pop()

  return (
    <button
      type="button"
      onClick={() => onSelect(repo)}
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

  useEffect(() => {
    repos.forEach((repo) => refresh(repo))
    // Re-fetch every time this view mounts (i.e. every time it's opened),
    // not on every repos-array identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSelect(repo: string) {
    selectRepo(repo)
    onClose()
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {repos.map((repo) => (
        <RepoRow key={repo} repo={repo} onSelect={handleSelect} />
      ))}
    </div>
  )
}
