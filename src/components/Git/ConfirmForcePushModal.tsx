import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useGitStore, useRepoGitState } from '@/stores/gitStore'
import { useGitSettingsStore } from '@/stores/gitSettingsStore'
import type { GitCommandAction } from '@/types/index'

interface Props {
  action: Extract<GitCommandAction, 'forcePush' | 'forcePushLease'>
  cwd: string
  onClose: () => void
}

export function ConfirmForcePushModal({ action, cwd, onClose }: Props) {
  const branch = useRepoGitState(cwd).branch
  const runAction = useGitStore((s) => s[action])
  const countdownEnabled = useGitSettingsStore((s) => s.countdownEnabled)
  const countdownSeconds = useGitSettingsStore((s) => s.countdownSeconds)
  const autoContinueOnCountdownEnd = useGitSettingsStore((s) => s.autoContinueOnCountdownEnd)

  const [remaining, setRemaining] = useState(countdownEnabled ? countdownSeconds : null)
  const [countdownDone, setCountdownDone] = useState(false)

  useEffect(() => {
    if (!countdownEnabled || !countdownSeconds || countdownSeconds <= 0) return
    const timeouts: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < countdownSeconds; i++) {
      timeouts.push(
        setTimeout(() => {
          const next = countdownSeconds - i - 1
          setRemaining(next)
          if (next <= 0) setCountdownDone(true)
        }, (i + 1) * 1000)
      )
    }
    return () => timeouts.forEach(clearTimeout)
  }, [countdownEnabled, countdownSeconds])

  useEffect(() => {
    if (!countdownDone || !autoContinueOnCountdownEnd) return
    runAction(cwd)
    onClose()
  }, [countdownDone, autoContinueOnCountdownEnd, runAction, cwd, onClose])

  async function handleConfirm() {
    await runAction(cwd)
    onClose()
  }

  const label = action === 'forcePush' ? 'Force push' : 'Force push with lease'

  return (
    <Modal onClose={onClose}>
      <h2 className="text-sm font-semibold text-fg mb-1">{label}</h2>
      <p className="text-sm text-fg-muted mb-5">
        Push to <span className="font-mono text-fg">origin/{branch ?? '…'}</span>?
        This can overwrite remote history.
      </p>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-sm rounded-lg border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
        >
          Cancel
        </button>
        {!countdownEnabled || countdownDone ? (
          !autoContinueOnCountdownEnd || !countdownEnabled ? (
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-1.5 text-sm rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold transition-colors"
            >
              Confirm
            </button>
          ) : null
        ) : (
          <span className="tabular-nums text-sm text-fg-muted w-8 text-center select-none">
            {remaining}
          </span>
        )}
      </div>
    </Modal>
  )
}
