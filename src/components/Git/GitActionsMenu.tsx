import { useGitStore } from '@/stores/gitStore'
import { useFileStore } from '@/stores/fileStore'
import type { GitCommandAction } from '@/types/index'

interface Props {
  onClose: () => void
  onRequestForce: (action: ForceAction) => void
}

type ForceAction = Extract<GitCommandAction, 'forcePush' | 'forcePushLease'>

export function GitActionsMenu({ onClose, onRequestForce }: Props) {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const commandStatus = useGitStore((s) => s.commandStatus)
  const fetch = useGitStore((s) => s.fetch)
  const pull = useGitStore((s) => s.pull)
  const push = useGitStore((s) => s.push)

  const disabled = commandStatus === 'running' || !projectRoot

  async function run(action: () => Promise<void>) {
    onClose()
    await action()
  }

  // onRequestForce is owned by StatusBar (which outlives this menu) rather
  // than local state here — this menu unmounts the instant onClose() fires,
  // so any local "which force action was picked" state would be discarded
  // before the confirm modal ever got a chance to render.
  function handleForce(action: ForceAction) {
    onClose()
    onRequestForce(action)
  }

  const itemClass =
    'w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-border bg-popover shadow-lg shadow-black/40 py-1 z-50">
      <button type="button" className={itemClass} disabled={disabled}
        onClick={() => run(() => fetch(projectRoot!))}>
        Fetch
      </button>
      <button type="button" className={itemClass} disabled={disabled}
        onClick={() => run(() => pull(projectRoot!))}>
        Pull
      </button>
      <div className="my-1 border-t border-border" />
      <button type="button" className={itemClass} disabled={disabled}
        onClick={() => run(() => push(projectRoot!))}>
        Push
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
