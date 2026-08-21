import { useState } from 'react'
import { useTodoStore, EMPTY_TODOS } from '@/stores/todoStore'
import { useEditorStore } from '@/stores/editorStore'
import { buildTodoBoardPath, buildTodoNewPath } from '@/components/Settings/paths'
import { getProjectTags } from '@/lib/todoTags'
import { TODO_COLUMNS } from '@/lib/todoBoard'
import { AttachmentThumbnails } from './AttachmentThumbnails'
import { TODO_LABELS, TODO_LABEL_META } from './labels'
import { TodoTagInput } from './TodoTagInput'
import { inputClass, uploadPastedImages } from './todoFormShared'
import type { TodoLabel, TodoStatus, TodoUpdatePatch } from '@/types/api'

export function TodoNewPage({ projectId }: { projectId: string }) {
  const project = useTodoStore((s) => s.projects.find((p) => p.id === projectId))
  const createTodo = useTodoStore((s) => s.createTodo)
  const updateTodo = useTodoStore((s) => s.updateTodo)
  const saveAttachment = useTodoStore((s) => s.saveAttachment)
  const projectTodos = useTodoStore((s) => s.todosByProject[projectId] ?? EMPTY_TODOS)
  const tagSuggestions = getProjectTags(projectTodos)
  const closeTab = useEditorStore((s) => s.closeTab)
  const openTab = useEditorStore((s) => s.openTab)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [label, setLabel] = useState<TodoLabel | null>(null)
  const [status, setStatus] = useState<TodoStatus>('backlog')
  const [tags, setTags] = useState<string[]>([])
  const [prUrl, setPrUrl] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDescriptionPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const ids = await uploadPastedImages(e.clipboardData, saveAttachment)
    if (ids.length > 0) setAttachments((prev) => [...prev, ...ids])
  }

  function goToBoard() {
    closeTab(buildTodoNewPath(projectId))
    openTab({ path: buildTodoBoardPath(projectId), content: '', dirty: false })
  }

  async function handleCreate() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    setSubmitting(true)
    setError(null)
    try {
      const todo = await createTodo(projectId, trimmedTitle)

      const patch: TodoUpdatePatch = {}
      if (description.trim()) patch.description = description.trim()
      if (label) patch.label = label
      if (status !== 'backlog') patch.status = status
      if (tags.length > 0) patch.tags = tags
      if (prUrl.trim()) patch.prUrl = prUrl.trim()
      if (attachments.length > 0) patch.attachments = attachments
      if (Object.keys(patch).length > 0) await updateTodo(todo.id, patch)

      goToBoard()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create todo')
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-panel p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <h1 className="text-sm font-semibold text-fg">New Todo — {project?.name ?? ''}</h1>

        <label htmlFor="todo-new-title" className="flex flex-col gap-1 text-xs text-fg-muted">
          Title
          <input
            id="todo-new-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="flex gap-3">
          <label htmlFor="todo-new-label" className="flex-1 flex flex-col gap-1 text-xs text-fg-muted">
            Label
            <select
              id="todo-new-label"
              value={label ?? ''}
              onChange={(e) => setLabel(e.target.value === '' ? null : (e.target.value as TodoLabel))}
              className={inputClass}
            >
              <option value="">No label</option>
              {TODO_LABELS.map((l) => (
                <option key={l} value={l}>
                  {TODO_LABEL_META[l].text}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="todo-new-status" className="flex-1 flex flex-col gap-1 text-xs text-fg-muted">
            Status
            <select
              id="todo-new-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TodoStatus)}
              className={inputClass}
            >
              {TODO_COLUMNS.map((col) => (
                <option key={col.status} value={col.status}>
                  {col.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <TodoTagInput tags={tags} suggestions={tagSuggestions} onChange={setTags} />

        <label htmlFor="todo-new-description" className="flex flex-col gap-1 text-xs text-fg-muted">
          Description
          <textarea
            id="todo-new-description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onPaste={handleDescriptionPaste}
            placeholder="Whatever details you've got so far…"
            className={inputClass}
          />
        </label>
        <AttachmentThumbnails
          attachments={attachments}
          onRemove={(id) => setAttachments((prev) => prev.filter((a) => a !== id))}
        />

        <label htmlFor="todo-new-pr-url" className="flex flex-col gap-1 text-xs text-fg-muted">
          PR/MR URL
          <input
            id="todo-new-pr-url"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => closeTab(buildTodoNewPath(projectId))}
            className="px-3 py-1.5 rounded text-sm text-fg-muted hover:text-fg hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim() || submitting}
            className="px-3 py-1.5 rounded text-sm bg-accent text-on-accent hover:bg-accent/90 disabled:opacity-40 disabled:pointer-events-none"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
