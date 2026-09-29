import type { Todo, TodoProject } from '@/types/api'

export type TodoProjectSortMode = 'alphabetical' | 'created' | 'count' | 'backlog'

export const TODO_PROJECT_SORT_MODES: { mode: TodoProjectSortMode; title: string }[] = [
  { mode: 'alphabetical', title: 'Alphabetical' },
  { mode: 'created', title: 'Created' },
  { mode: 'count', title: 'Count' },
  { mode: 'backlog', title: 'Backlog' },
]

// Todos still to do: anything not in Done and not archived.
export function countNotDone(todos: Todo[]): number {
  return todos.filter((todo) => !todo.archived && todo.status !== 'done').length
}

export function countBacklog(todos: Todo[]): number {
  return todos.filter((todo) => !todo.archived && todo.status === 'backlog').length
}

function compareNames(a: TodoProject, b: TodoProject): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
}

// A view-only sort for the To Do sidebar — stored project order is untouched.
// 'count' puts the projects with the most not-done todos first, 'backlog' the
// most Backlog todos first; a project whose todos aren't loaded yet counts as 0.
export function sortTodoProjects(
  projects: TodoProject[],
  mode: TodoProjectSortMode,
  todosByProject: Record<string, Todo[]>
): TodoProject[] {
  const sorted = [...projects]
  switch (mode) {
    case 'alphabetical':
      return sorted.sort(compareNames)
    case 'created':
      return sorted.sort((a, b) => a.createdAt - b.createdAt)
    case 'count':
    case 'backlog': {
      const count = mode === 'count' ? countNotDone : countBacklog
      const counts = new Map(projects.map((p) => [p.id, count(todosByProject[p.id] ?? [])]))
      return sorted.sort((a, b) => counts.get(b.id)! - counts.get(a.id)! || compareNames(a, b))
    }
  }
}
