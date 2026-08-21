import { TODO_COLUMNS } from '@/lib/todoBoard'
import { TODO_LABEL_META } from './labels'
import type { Todo, TodoStatus } from '@/types/api'

export function TodoCard({
  todo,
  onOpen,
  onStatusChange,
}: {
  todo: Todo
  onOpen: () => void
  onStatusChange: (status: TodoStatus) => void
}) {
  return (
    <div
      onClick={onOpen}
      className="rounded border border-border bg-sidebar p-2 flex flex-col gap-1.5 cursor-pointer hover:border-accent/60"
    >
      <span className="text-[0.65rem] font-mono text-fg-subtle">{todo.id}</span>
      <p className="text-sm text-fg">{todo.title}</p>
      {todo.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {todo.labels.map((label) => (
            <span
              key={label}
              className={`text-[0.6rem] px-1.5 py-0.5 rounded border ${TODO_LABEL_META[label].className}`}
            >
              {TODO_LABEL_META[label].text}
            </span>
          ))}
        </div>
      )}
      <select
        value={todo.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatusChange(e.target.value as TodoStatus)}
        className="text-xs bg-panel border border-border rounded px-1 py-0.5 text-fg-muted"
      >
        {TODO_COLUMNS.map((col) => (
          <option key={col.status} value={col.status}>
            {col.title}
          </option>
        ))}
      </select>
    </div>
  )
}
