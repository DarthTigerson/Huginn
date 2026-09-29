import { useEffect, useMemo, useState } from 'react'
import { useTodoStore } from '@/stores/todoStore'
import { useEditorStore } from '@/stores/editorStore'
import { useTodoSettingsStore } from '@/stores/todoSettingsStore'
import { getBiggestPaneId } from '@/lib/paneLayout'
import { buildTodoBoardPath } from '@/components/Settings/paths'
import { NewTodoProjectModal } from './NewTodoProjectModal'
import { RenameTodoProjectModal } from './RenameTodoProjectModal'
import { DeleteTodoProjectModal } from './DeleteTodoProjectModal'
import { TodoProjectMenu } from './TodoContextMenu'
import { sortTodoProjects } from '@/lib/todoProjectSort'
import type { TodoProject } from '@/types/api'

export function TodoPanel() {
  const projects = useTodoStore((s) => s.projects)
  const todosByProject = useTodoStore((s) => s.todosByProject)
  const loadTodos = useTodoStore((s) => s.loadTodos)
  const projectSort = useTodoSettingsStore((s) => s.projectSort)
  const setProjectSort = useTodoSettingsStore((s) => s.setProjectSort)
  const sortedProjects = useMemo(
    () => sortTodoProjects(projects, projectSort, todosByProject),
    [projects, projectSort, todosByProject],
  )
  // Keys are monospace, so sizing the key column to the longest key in `ch`
  // lines every project name up at the same x.
  const keyColumnWidth = `${Math.max(0, ...projects.map((p) => p.key.length))}ch`
  const loadProjects = useTodoStore((s) => s.loadProjects)
  const lastOpenedProjectId = useTodoStore((s) => s.lastOpenedProjectId)
  const setLastOpenedProject = useTodoStore((s) => s.setLastOpenedProject)
  const openTab = useEditorStore((s) => s.openTab)
  const openTabInPane = useEditorStore((s) => s.openTabInPane)
  const [modalOpen, setModalOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; project: TodoProject | null } | null>(null)
  const [renameTarget, setRenameTarget] = useState<TodoProject | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TodoProject | null>(null)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // The count sorts need every project's todos, not just boards opened so
  // far — load the missing ones (once each; refreshAll keeps them fresh).
  useEffect(() => {
    if (projectSort !== 'count' && projectSort !== 'backlog') return
    for (const project of projects) {
      if (!useTodoStore.getState().todosByProject[project.id]) loadTodos(project.id)
    }
  }, [projectSort, projects, loadTodos])

  // Re-focus whatever project's board tab was last active — TodoPanel is
  // unmounted whenever the sidebar switches to a different activity-bar
  // section, so without this, returning to the Todo panel loses your place.
  useEffect(() => {
    if (lastOpenedProjectId) {
      openTab({ path: buildTodoBoardPath(lastOpenedProjectId), content: '', dirty: false })
    }
    // Only on mount — subsequent project switches happen via openProject.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openProjectMenu(e: React.MouseEvent, project: TodoProject | null) {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, project })
  }

  function openProject(project: TodoProject) {
    setLastOpenedProject(project.id)
    const tab = { path: buildTodoBoardPath(project.id), content: '', dirty: false }
    if (useTodoSettingsStore.getState().openInBiggestPane) {
      const biggestPaneId = getBiggestPaneId()
      if (biggestPaneId) {
        openTabInPane(tab, biggestPaneId)
        return
      }
    }
    openTab(tab)
  }

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      <div className="h-9 px-3 border-b border-border shrink-0 flex items-center justify-between">
        <span className="text-xs font-semibold text-fg-muted uppercase tracking-wider">To Do</span>
        <button
          type="button"
          aria-label="New Project"
          onClick={() => setModalOpen(true)}
          className="w-5 h-5 rounded flex items-center justify-center text-fg-muted hover:text-fg hover:bg-white/10"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" onContextMenu={(e) => openProjectMenu(e, null)}>
        {projects.length === 0 ? (
          <p className="p-3 text-sm text-fg-subtle">No projects yet.</p>
        ) : (
          sortedProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              aria-pressed={project.id === lastOpenedProjectId}
              onClick={() => openProject(project)}
              onContextMenu={(e) => openProjectMenu(e, project)}
              className={[
                'w-full text-left px-3 py-2 flex items-center gap-2 border-l-2',
                project.id === lastOpenedProjectId
                  ? 'bg-white/5 border-accent'
                  : 'border-transparent hover:bg-white/5',
              ].join(' ')}
            >
              <span className="text-xs font-mono text-fg-subtle shrink-0" style={{ width: keyColumnWidth }}>
                {project.key}
              </span>
              <span className="text-sm text-fg truncate">{project.name}</span>
            </button>
          ))
        )}
      </div>

      {modalOpen && <NewTodoProjectModal onClose={() => setModalOpen(false)} />}

      {menu && (
        <TodoProjectMenu
          x={menu.x}
          y={menu.y}
          projectSort={projectSort}
          onClose={() => setMenu(null)}
          onSortProjects={setProjectSort}
          onRename={menu.project ? () => setRenameTarget(menu.project) : undefined}
          onDelete={menu.project ? () => setDeleteTarget(menu.project) : undefined}
        />
      )}

      {renameTarget && (
        <RenameTodoProjectModal project={renameTarget} onClose={() => setRenameTarget(null)} />
      )}

      {deleteTarget && (
        <DeleteTodoProjectModal project={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  )
}
