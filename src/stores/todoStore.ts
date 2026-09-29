import { create } from 'zustand'
import { useEditorStore } from './editorStore'
import { notifySettingChanged } from '../lib/notifySettingChanged'
import type { Todo, TodoProject, TodoStatus, TodoUpdatePatch } from '@/types/api'

// A stable reference for "no todos loaded yet" — selectors must never
// fall back to a fresh `[]` literal, since a new array on every call
// breaks useSyncExternalStore's referential-equality check and spins
// into "Maximum update depth exceeded".
export const EMPTY_TODOS: Todo[] = []

function replaceInBucket(
  todosByProject: Record<string, Todo[]>,
  updated: Todo
): Record<string, Todo[]> {
  const bucket = todosByProject[updated.projectId]
  if (!bucket) return todosByProject
  return {
    ...todosByProject,
    [updated.projectId]: bucket.map((t) => (t.id === updated.id ? updated : t)),
  }
}

export type TodoBoardView = 'board' | 'archive'

interface TodoStore {
  // Live projects only; ones in the Trash (trashedAt set) live in
  // trashedProjects so nothing that lists projects has to filter them out.
  projects: TodoProject[]
  trashedProjects: TodoProject[]
  todosByProject: Record<string, Todo[]>
  // Keyed by projectId so it survives TodoBoardPage remounting — the board
  // is unmounted whenever a todo detail tab becomes active (Editor.tsx only
  // renders the active tab's page), which would otherwise reset a plain
  // useState back to 'board' every time.
  boardViewByProject: Record<string, TodoBoardView>
  setBoardView: (projectId: string, view: TodoBoardView) => void
  // Survives TodoPanel remounting (it's unmounted whenever the sidebar
  // switches to a different activity-bar section) so switching back to the
  // Todo panel can re-focus the project you were last on.
  lastOpenedProjectId: string | null
  setLastOpenedProject: (projectId: string) => void
  // Per-column scroll offsets, keyed by project then status. Same
  // survives-remount rationale as boardViewByProject: TodoBoardPage
  // unmounts whenever a todo detail tab becomes active or the view flips
  // to archive, which would otherwise silently reset every column back to
  // the top (e.g. right after moving a card out of a scrolled-down column).
  columnScrollByProject: Record<string, Partial<Record<TodoStatus, number>>>
  setColumnScroll: (projectId: string, status: TodoStatus, scrollTop: number) => void
  loadProjects: () => Promise<void>
  createProject: (name: string, key: string) => Promise<TodoProject>
  renameProject: (id: string, name: string, key: string) => Promise<TodoProject>
  trashProject: (id: string) => Promise<void>
  restoreProject: (id: string) => Promise<void>
  loadTodos: (projectId: string) => Promise<void>
  createTodo: (projectId: string, title: string) => Promise<Todo>
  updateTodo: (id: string, patch: TodoUpdatePatch) => Promise<Todo>
  reorderTodo: (
    projectId: string,
    id: string,
    status: TodoStatus,
    beforeId: string | null
  ) => Promise<void>
  archiveTodo: (id: string, archived: boolean) => Promise<Todo>
  archiveTodos: (ids: string[], archived: boolean) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  addComment: (todoId: string, body: string, attachments?: string[]) => Promise<Todo>
  saveAttachment: (dataUrl: string) => Promise<string>
  refreshAll: () => Promise<void>
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  projects: [],
  trashedProjects: [],
  todosByProject: {},
  boardViewByProject: {},

  setBoardView: (projectId, view) => {
    set({ boardViewByProject: { ...get().boardViewByProject, [projectId]: view } })
  },

  lastOpenedProjectId: null,
  setLastOpenedProject: (projectId) => set({ lastOpenedProjectId: projectId }),

  columnScrollByProject: {},
  setColumnScroll: (projectId, status, scrollTop) => {
    const bucket = get().columnScrollByProject[projectId] ?? {}
    set({
      columnScrollByProject: {
        ...get().columnScrollByProject,
        [projectId]: { ...bucket, [status]: scrollTop },
      },
    })
  },

  loadProjects: async () => {
    const all = await window.api.todosListProjects()
    set({ projects: all.filter((p) => !p.trashedAt), trashedProjects: all.filter((p) => !!p.trashedAt) })
  },

  createProject: async (name, key) => {
    const project = await window.api.todosCreateProject(name, key)
    set({ projects: [...get().projects, project] })
    notifySettingChanged()
    return project
  },

  renameProject: async (id, name, key) => {
    const renamed = await window.api.todosRenameProject(id, name, key)
    set({ projects: get().projects.map((p) => (p.id === id ? renamed : p)) })
    notifySettingChanged()
    return renamed
  },

  trashProject: async (id) => {
    const trashed = await window.api.todosTrashProject(id)
    const { [id]: _removed, ...todosByProject } = get().todosByProject
    set({
      projects: get().projects.filter((p) => p.id !== id),
      trashedProjects: [...get().trashedProjects, trashed],
      todosByProject,
      lastOpenedProjectId: get().lastOpenedProjectId === id ? null : get().lastOpenedProjectId,
    })
    useEditorStore.getState().closeTabsForProject(id)
    notifySettingChanged()
  },

  restoreProject: async (id) => {
    const restored = await window.api.todosRestoreProject(id)
    set({
      projects: [...get().projects, restored],
      trashedProjects: get().trashedProjects.filter((p) => p.id !== id),
    })
    notifySettingChanged()
  },

  loadTodos: async (projectId) => {
    const todos = await window.api.todosListTodos(projectId)
    set({ todosByProject: { ...get().todosByProject, [projectId]: todos } })
  },

  createTodo: async (projectId, title) => {
    const todo = await window.api.todosCreateTodo(projectId, title)
    const bucket = get().todosByProject[projectId] ?? []
    set({ todosByProject: { ...get().todosByProject, [projectId]: [...bucket, todo] } })
    notifySettingChanged()
    return todo
  },

  updateTodo: async (id, patch) => {
    const updated = await window.api.todosUpdateTodo(id, patch)
    set({ todosByProject: replaceInBucket(get().todosByProject, updated) })
    notifySettingChanged()
    return updated
  },

  reorderTodo: async (projectId, id, status, beforeId) => {
    const bucket = get().todosByProject[projectId] ?? []
    const todo = bucket.find((t) => t.id === id)
    if (todo) {
      const rest = bucket.filter((t) => t.id !== id)
      const moved = { ...todo, status }
      const insertAt = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1
      const reordered =
        insertAt === -1 ? [...rest, moved] : [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)]
      set({ todosByProject: { ...get().todosByProject, [projectId]: reordered } })
    }
    await window.api.todosReorderTodo(id, status, beforeId)
    notifySettingChanged()
  },

  archiveTodo: async (id, archived) => {
    const updated = await window.api.todosArchiveTodo(id, archived)
    set({ todosByProject: replaceInBucket(get().todosByProject, updated) })
    notifySettingChanged()
    return updated
  },

  archiveTodos: async (ids, archived) => {
    const updated = await window.api.todosArchiveTodos(ids, archived)
    let todosByProject = get().todosByProject
    for (const todo of updated) todosByProject = replaceInBucket(todosByProject, todo)
    set({ todosByProject })
    notifySettingChanged()
  },

  deleteTodo: async (id) => {
    await window.api.todosDeleteTodo(id)
    const todosByProject = Object.fromEntries(
      Object.entries(get().todosByProject).map(([projectId, todos]) => [
        projectId,
        todos.filter((t) => t.id !== id),
      ])
    )
    set({ todosByProject })
    notifySettingChanged()
  },

  addComment: async (todoId, body, attachments) => {
    const updated = await window.api.todosAddComment(todoId, body, attachments)
    set({ todosByProject: replaceInBucket(get().todosByProject, updated) })
    notifySettingChanged()
    return updated
  },

  saveAttachment: async (dataUrl) => window.api.todosSaveAttachment(dataUrl),

  // Picks up changes made outside this window's own IPC calls — most
  // notably the Todo MCP server, which writes todos.json from a separate
  // process Claude Code spawns (see electron/todosWatcher.ts). Only
  // refetches boards already loaded into state, since those are the only
  // ones any open UI could be showing.
  refreshAll: async () => {
    await get().loadProjects()
    await Promise.all(Object.keys(get().todosByProject).map((projectId) => get().loadTodos(projectId)))
  },
}))
