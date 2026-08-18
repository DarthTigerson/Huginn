import { useGitStore, useRepoGitState } from '@/stores/gitStore'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useGitFavoriteReposStore } from '@/stores/gitFavoriteReposStore'
import { useSearchStore } from '@/stores/searchStore'
import type { GitCommandAction } from '@/types/index'

interface Props {
  onClose: () => void
  onRequestForce: (action: ForceAction) => void
}

type ForceAction = Extract<GitCommandAction, 'forcePush' | 'forcePushLease'>

export function GitActionsMenu({ onClose, onRequestForce }: Props) {
  const repos = useGitReposStore((s) => s.repos)
  const selectedRepo = useGitReposStore((s) => s.selectedRepo)
  const selectRepo = useGitReposStore((s) => s.selectRepo)
  const favorites = useGitFavoriteReposStore((s) => s.favorites)
  const { branch, commandStatus } = useRepoGitState(selectedRepo)
  const fetch = useGitStore((s) => s.fetch)
  const pull = useGitStore((s) => s.pull)
  const push = useGitStore((s) => s.push)
  const publishBranch = useGitStore((s) => s.publishBranch)

  const disabled = commandStatus === 'running' || !selectedRepo
  // Quick-switch list here is deliberately just the repos you've starred in
  // the Git panel — a multi-repo project can easily have more repos than
  // fit comfortably in a footer menu, favorites keep it to the ones you
  // actually jump between.
  const favoriteRepos = repos.filter((repo) => favorites[repo]).sort()

  async function run(action: () => Promise<void>) {
    onClose()
    await action()
  }

  function handleSelectRepo(repo: string) {
    // StatusBar's own effect re-fetches branch/status for whatever repo
    // becomes selected, so passive (not-yet-loaded) repos still end up
    // fresh here without this menu needing to trigger that itself.
    selectRepo(repo)
    onClose()
  }

  function handleSwitchBranch() {
    onClose()
    useSearchStore.getState().openBranchPalette()
  }

  function handlePublishBranch() {
    if (!selectedRepo || !branch) return
    onClose()
    publishBranch(selectedRepo, branch)
  }

  function handleForce(action: ForceAction) {
    onClose()
    onRequestForce(action)
  }

  const itemClass =
    'w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="absolute bottom-full left-0 mb-1 w-56 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg shadow-black/40 py-1 z-50">
      {repos.length > 1 && favoriteRepos.length > 0 && (
        <>
          <div className="px-3 pt-1 pb-0.5 text-[0.625rem] font-semibold text-fg-subtle uppercase tracking-wider">
            Favorite Repos
          </div>
          {favoriteRepos.map((repo) => (
            <button
              key={repo}
              type="button"
              className={[itemClass, 'truncate', repo === selectedRepo ? 'text-fg font-semibold' : 'text-fg-muted'].join(' ')}
              onClick={() => handleSelectRepo(repo)}
            >
              {repo.split('/').pop()}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
        </>
      )}

      <button type="button" className={itemClass} disabled={!selectedRepo} onClick={handleSwitchBranch}>
        Switch Branch…
      </button>
      <div className="my-1 border-t border-border" />
      <button type="button" className={itemClass} disabled={disabled}
        onClick={() => run(() => fetch(selectedRepo!))}>
        Fetch
      </button>
      <button type="button" className={itemClass} disabled={disabled}
        onClick={() => run(() => pull(selectedRepo!))}>
        Pull
      </button>
      <div className="my-1 border-t border-border" />
      <button type="button" className={itemClass} disabled={disabled}
        onClick={() => run(() => push(selectedRepo!))}>
        Push
      </button>
      <button
        type="button"
        className={itemClass}
        disabled={disabled || !branch}
        title={branch ? `git push -u origin ${branch}` : undefined}
        onClick={handlePublishBranch}
      >
        Publish Branch
      </button>
      <button type="button" className={`${itemClass} text-red-400`} disabled={disabled}
        onClick={() => handleForce('forcePush')}>
        Force Push
      </button>
      <button type="button" className={`${itemClass} text-red-400`} disabled={disabled}
        onClick={() => handleForce('forcePushLease')}>
        Force Push with Lease
      </button>
    </div>
  )
}
