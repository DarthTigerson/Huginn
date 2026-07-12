import { useState } from 'react'
import { useGitStore } from '@/stores/gitStore'
import { useGitSettingsStore } from '@/stores/gitSettingsStore'
import { useFileStore } from '@/stores/fileStore'
import { ConfirmForcePushModal } from './ConfirmForcePushModal'
import type { GitCommandAction } from '@/types/index'

interface Props {
  onClose: () => void
}

type ForceAction = Extract<GitCommandAction, 'forcePush' | 'forcePushLease'>

export function GitActionsMenu({ onClose }: Props) {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const commandStatus = useGitStore((s) => s.commandStatus)
  const fetch = useGitStore((s) => s.fetch)
  const pull = useGitStore((s) => s.pull)
  const push = useGitStore((s) => s.push)
  const forceSafetyEnabled = useGitSettingsStore((s) => s.forceSafetyEnabled)
  const [forceAction, setForceAction] = useState<ForceAction | null>(null)

  const disabled = commandStatus === 'running' || !projectRoot

  async function run(action: () => Promise<void>) {
    onClose()
    await action()
  }

  function handleForce(action: ForceAction) {
    onClose()
    if (!forceSafetyEnabled) {
      const fn = useGitStore.getState()[action]
      if (projectRoot) fn(projectRoot)
    } else {
      setForceAction(action)
    }
  }

  const itemClass =
    'w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <>
      <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-border bg-sidebar shadow-lg shadow-black/40 py-1 z-50">
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
      {forceAction && projectRoot && (
        <ConfirmForcePushModal
          action={forceAction}
          cwd={projectRoot}
          onClose={() => setForceAction(null)}
        />
      )}
    </>
  )
}
