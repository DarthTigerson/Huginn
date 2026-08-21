import { useEffect, useState } from 'react'
import { useTodoStore, EMPTY_TODOS } from '@/stores/todoStore'
import { TODO_COLUMNS, groupTodosByStatus } from '@/lib/todoBoard'
import { TodoCard } from './TodoCard'
import { TodoArchiveList } from './TodoArchiveList'
import { TodoDetailModal } from './TodoDetailModal'

export function TodoBoardPage({ projectId }: { projectId: string }) {
  const project = useTodoStore((s) => s.projects.find((p) => p.id === projectId))
  const todos = useTodoStore((s) => s.todosByProject[projectId] ?? EMPTY_TODOS)
  const loadTodos = useTodoStore((s) => s.loadTodos)
  const createTodo = useTodoStore((s) => s.createTodo)
  const updateTodo = useTodoStore((s) => s.updateTodo)
  const archiveTodo = useTodoStore((s) => s.archiveTodo)

  const [view, setView] = useState<'board' | 'archive'>('board')
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    loadTodos(projectId)
  }, [projectId, loadTodos])

  const groups = groupTodosByStatus(todos)
  const archived = todos.filter((t) => t.archived)
  const selectedTodo = todos.find((t) => t.id === selectedTodoId) ?? null

  async function handleCreate() {
    const title = newTitle.trim()
    if (!title) return
    await createTodo(projectId, title)
    setNewTitle('')
  }

  return (
    <div className="h-full flex flex-col bg-panel overflow-hidden">
      <div className="h-11 px-4 border-b border-border shrink-0 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-fg">{project?.name ?? 'Todo'}</h1>
        <div className="flex gap-1">
          <button
            type="button"
            aria-pressed={view === 'board'}
            onClick={() => setView('board')}
            className={`text-xs px-2 py-1 rounded ${view === 'board' ? 'bg-white/10 text-fg' : 'text-fg-muted'}`}
          >
            Board
          </button>
          <button
            type="button"
            aria-pressed={view === 'archive'}
            onClick={() => setView('archive')}
            className={`text-xs px-2 py-1 rounded ${view === 'archive' ? 'bg-white/10 text-fg' : 'text-fg-muted'}`}
          >
            Archive
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <>
          <div className="shrink-0 px-4 py-2 flex gap-2 border-b border-border">
            <input
              aria-label="New todo title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              placeholder="New todo title"
              className="flex-1 bg-sidebar border border-border rounded px-2 py-1 text-sm text-fg focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={handleCreate}
              className="px-3 py-1 rounded text-sm bg-accent text-on-accent hover:bg-accent/90"
            >
              Add
            </button>
          </div>
          <div className="flex-1 overflow-x-auto flex divide-x divide-border">
            {TODO_COLUMNS.map((col) => (
              <div key={col.status} className="flex-1 min-w-[240px] flex flex-col bg-sidebar/30">
                <div className="px-3 py-2 flex items-center justify-between shrink-0 border-b border-border/60">
                  <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">
                    {col.title}
                  </h2>
                  <span className="text-[0.65rem] leading-none px-1.5 py-1 rounded-full bg-white/5 text-fg-subtle">
                    {groups[col.status].length}
                  </span>
                </div>
                <div className="flex-1 flex flex-col gap-2 overflow-y-auto p-3">
                  {groups[col.status].length === 0 ? (
                    <p className="text-xs text-fg-subtle/70 italic">No todos</p>
                  ) : (
                    groups[col.status].map((todo) => (
                      <TodoCard
                        key={todo.id}
                        todo={todo}
                        onOpen={() => setSelectedTodoId(todo.id)}
                        onStatusChange={(status) => updateTodo(todo.id, { status })}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <TodoArchiveList
          todos={archived}
          onOpen={(id) => setSelectedTodoId(id)}
          onUnarchive={(id) => archiveTodo(id, false)}
        />
      )}

      {selectedTodo && <TodoDetailModal todo={selectedTodo} onClose={() => setSelectedTodoId(null)} />}
    </div>
  )
}
