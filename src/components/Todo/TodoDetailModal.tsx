import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useTodoStore } from '@/stores/todoStore'
import { AttachmentThumbnails } from './AttachmentThumbnails'
import { TODO_LABELS, TODO_LABEL_META } from './labels'
import { extractPastedImageFiles, readFileAsDataUrl } from '@/lib/attachmentPaste'
import type { Todo, TodoLabel } from '@/types/api'

const inputClass =
  'bg-panel border border-border rounded px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-accent'

async function uploadPastedImages(
  clipboardData: DataTransfer | null,
  saveAttachment: (dataUrl: string) => Promise<string>
): Promise<string[]> {
  const files = extractPastedImageFiles(clipboardData)
  if (files.length === 0) return []
  const dataUrls = await Promise.all(files.map(readFileAsDataUrl))
  return Promise.all(dataUrls.map((dataUrl) => saveAttachment(dataUrl)))
}

export function TodoDetailModal({ todo, onClose }: { todo: Todo; onClose: () => void }) {
  const updateTodo = useTodoStore((s) => s.updateTodo)
  const archiveTodo = useTodoStore((s) => s.archiveTodo)
  const deleteTodo = useTodoStore((s) => s.deleteTodo)
  const addComment = useTodoStore((s) => s.addComment)
  const saveAttachment = useTodoStore((s) => s.saveAttachment)

  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description)
  const [prUrl, setPrUrl] = useState(todo.prUrl ?? '')
  const [commentBody, setCommentBody] = useState('')
  const [commentAttachments, setCommentAttachments] = useState<string[]>([])
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function toggleLabel(label: TodoLabel) {
    const labels = todo.labels.includes(label)
      ? todo.labels.filter((l) => l !== label)
      : [...todo.labels, label]
    updateTodo(todo.id, { labels })
  }

  async function handleDescriptionPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const ids = await uploadPastedImages(e.clipboardData, saveAttachment)
    if (ids.length > 0) updateTodo(todo.id, { attachments: [...todo.attachments, ...ids] })
  }

  async function handleCommentPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const ids = await uploadPastedImages(e.clipboardData, saveAttachment)
    if (ids.length > 0) setCommentAttachments((prev) => [...prev, ...ids])
  }

  async function handleAddComment() {
    if (!commentBody.trim()) return
    await addComment(todo.id, commentBody.trim(), commentAttachments)
    setCommentBody('')
    setCommentAttachments([])
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    await deleteTodo(todo.id)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto w-[32rem] max-w-full">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-fg-subtle">{todo.id}</span>
          <button
            type="button"
            onClick={() => archiveTodo(todo.id, !todo.archived)}
            className="text-xs text-fg-muted hover:text-fg"
          >
            {todo.archived ? 'Unarchive' : 'Archive'}
          </button>
        </div>

        <label htmlFor="todo-title" className="flex flex-col gap-1 text-xs text-fg-muted">
          Title
          <input
            id="todo-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== todo.title) updateTodo(todo.id, { title })
            }}
            className={inputClass}
          />
        </label>

        <div className="flex gap-1.5">
          {TODO_LABELS.map((label) => {
            const active = todo.labels.includes(label)
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleLabel(label)}
                className={`text-xs px-2 py-1 rounded border ${
                  active ? TODO_LABEL_META[label].className : 'border-border text-fg-subtle'
                }`}
              >
                {TODO_LABEL_META[label].text}
              </button>
            )
          })}
        </div>

        <label htmlFor="todo-description" className="flex flex-col gap-1 text-xs text-fg-muted">
          Description
          <textarea
            id="todo-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== todo.description) updateTodo(todo.id, { description })
            }}
            onPaste={handleDescriptionPaste}
            className={inputClass}
          />
        </label>
        <AttachmentThumbnails
          attachments={todo.attachments}
          onRemove={(id) =>
            updateTodo(todo.id, { attachments: todo.attachments.filter((a) => a !== id) })
          }
        />

        <label htmlFor="todo-pr-url" className="flex flex-col gap-1 text-xs text-fg-muted">
          PR/MR URL
          <input
            id="todo-pr-url"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            onBlur={() => {
              if (prUrl !== (todo.prUrl ?? '')) updateTodo(todo.id, { prUrl: prUrl || null })
            }}
            className={inputClass}
          />
        </label>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Comments</h3>
          {todo.comments.map((comment) => (
            <div key={comment.id} className="flex flex-col gap-1 rounded border border-border/60 p-2">
              <p className="text-sm text-fg whitespace-pre-wrap">{comment.body}</p>
              <AttachmentThumbnails attachments={comment.attachments} />
            </div>
          ))}
          <label htmlFor="todo-new-comment" className="sr-only">
            New comment
          </label>
          <textarea
            id="todo-new-comment"
            rows={2}
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            onPaste={handleCommentPaste}
            placeholder="Add a comment…"
            className={inputClass}
          />
          <AttachmentThumbnails
            attachments={commentAttachments}
            onRemove={(id) => setCommentAttachments((prev) => prev.filter((a) => a !== id))}
          />
          <button
            type="button"
            onClick={handleAddComment}
            disabled={!commentBody.trim()}
            className="self-end px-3 py-1.5 rounded text-sm bg-accent text-on-accent hover:bg-accent/90 disabled:opacity-40 disabled:pointer-events-none"
          >
            Add Comment
          </button>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs text-red-400 hover:text-red-300"
          >
            {confirmingDelete ? 'Confirm delete?' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm text-fg-muted hover:text-fg hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
