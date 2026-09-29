import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useTodoStore } from '@/stores/todoStore'
import type { TodoProject } from '@/types/api'

export function TrashTodoProjectModal({
  project,
  onClose,
}: {
  project: TodoProject
  onClose: () => void
}) {
  const trashProject = useTodoStore((s) => s.trashProject)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleTrash() {
    setSubmitting(true)
    setError(null)
    try {
      await trashProject(project.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move project to the Trash')
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-sm font-semibold text-fg mb-2">Move to Trash</h2>
      <p className="text-xs text-fg-muted mb-4">
        Move <span className="font-semibold text-fg">{project.name}</span> and its todos to the Trash? You can
        restore it any time from Trash at the bottom of the To Do panel.
      </p>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
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
          autoFocus
          onClick={handleTrash}
          disabled={submitting}
          className="px-4 py-1.5 text-sm rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          Move to Trash
        </button>
      </div>
    </Modal>
  )
}
