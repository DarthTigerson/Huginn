import { Modal } from '@/components/ui/Modal'
import { useDockerStore } from '@/stores/dockerStore'
import type { DockerContainer } from '@/types/api'

interface Props {
  container: DockerContainer
  onClose: () => void
}

export function ConfirmRemoveContainerModal({ container, onClose }: Props) {
  const removeContainer = useDockerStore((s) => s.removeContainer)

  async function handleConfirm() {
    await removeContainer(container.id)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-sm font-semibold text-fg mb-1">Remove container</h2>
      <p className="text-sm text-fg-muted mb-5">
        Remove <span className="font-mono text-fg">{container.name}</span>?
        {container.state === 'running' && ' It is currently running and will be stopped first.'}
      </p>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-sm rounded-lg border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="px-4 py-1.5 text-sm rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold transition-colors"
        >
          Remove
        </button>
      </div>
    </Modal>
  )
}
