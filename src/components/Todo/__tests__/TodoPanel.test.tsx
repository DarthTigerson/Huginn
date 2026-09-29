/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { TodoPanel } from '../TodoPanel'
import { useTodoStore } from '@/stores/todoStore'
import { useEditorStore } from '@/stores/editorStore'
import { useTodoSettingsStore } from '@/stores/todoSettingsStore'
import { buildTodoBoardPath, TODO_TRASH_TAB_PATH } from '@/components/Settings/paths'

const openTabMock = vi.fn()

beforeEach(() => {
  openTabMock.mockClear()
  useTodoStore.setState({ projects: [], trashedProjects: [], todosByProject: {}, lastOpenedProjectId: null })
  useEditorStore.setState({ openTab: openTabMock })
  useTodoSettingsStore.setState({
    projectSort: 'alphabetical',
    shownCounts: ['backlog', 'todo', 'in_progress', 'done'],
  })
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

function mockApi(overrides: Partial<typeof window.api> = {}) {
  ;(global as any).window.api = {
    todosListProjects: vi.fn().mockResolvedValue([]),
    todosListTodos: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

describe('TodoPanel', () => {
  it('shows an empty state when there are no projects', async () => {
    mockApi()
    render(<TodoPanel />)
    await waitFor(() => {
      expect(screen.getByText('No projects yet.')).toBeInTheDocument()
    })
  })

  it('lists loaded projects by name and key', async () => {
    mockApi({
      todosListProjects: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'vIDE', key: 'H', nextNumber: 1, createdAt: 1 },
      ]),
    })
    render(<TodoPanel />)
    await waitFor(() => {
      expect(screen.getByText('vIDE')).toBeInTheDocument()
      expect(screen.getByText('H')).toBeInTheDocument()
    })
  })

  it('lists projects alphabetically by name, case-insensitively', async () => {
    mockApi({
      todosListProjects: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'Snajja Maltin', key: 'SM', nextNumber: 1, createdAt: 1 },
        { id: 'p2', name: 'vIDE', key: 'VIDE', nextNumber: 1, createdAt: 2 },
        { id: 'p3', name: 'Bonnici Portfolio', key: 'BP', nextNumber: 1, createdAt: 3 },
        { id: 'p4', name: 'vIDE Sync', key: 'SYNC', nextNumber: 1, createdAt: 4 },
        { id: 'p5', name: 'Link Platform', key: 'LP', nextNumber: 1, createdAt: 5 },
      ]),
    })
    render(<TodoPanel />)
    await waitFor(() => screen.getByText('Snajja Maltin'))

    const names = screen.getAllByRole('button', { pressed: false }).map((b) => b.children[1]?.textContent)
    expect(names).toEqual(['Bonnici Portfolio', 'Link Platform', 'Snajja Maltin', 'vIDE', 'vIDE Sync'])
  })

  it('sizes every key to the longest key so project names line up', async () => {
    mockApi({
      todosListProjects: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'Test', key: 'T', nextNumber: 1, createdAt: 1 },
        { id: 'p2', name: 'vIDE Site', key: 'VSITE', nextNumber: 1, createdAt: 2 },
      ]),
    })
    render(<TodoPanel />)
    await waitFor(() => screen.getByText('VSITE'))

    expect(screen.getByText('T')).toHaveStyle({ width: '5ch' })
    expect(screen.getByText('VSITE')).toHaveStyle({ width: '5ch' })
  })

  const threeProjects = [
    { id: 'p1', name: 'Snajja Maltin', key: 'SM', nextNumber: 1, createdAt: 1 },
    { id: 'p2', name: 'vIDE', key: 'VIDE', nextNumber: 1, createdAt: 2 },
    { id: 'p3', name: 'Bonnici Portfolio', key: 'BP', nextNumber: 1, createdAt: 3 },
  ]

  function listedNames() {
    return screen.getAllByRole('button', { pressed: false }).map((b) => b.children[1]?.textContent)
  }

  it('right-clicking empty space offers Sort by, and Created reorders by creation date', async () => {
    mockApi({ todosListProjects: vi.fn().mockResolvedValue(threeProjects) })
    const { container } = render(<TodoPanel />)
    await waitFor(() => screen.getByText('vIDE'))

    fireEvent.contextMenu(container.querySelector('.overflow-y-auto')!)
    expect(screen.queryByText('Rename')).not.toBeInTheDocument()
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Sort by' }).parentElement!)
    fireEvent.click(screen.getByText('Created'))

    expect(listedNames()).toEqual(['Snajja Maltin', 'vIDE', 'Bonnici Portfolio'])
    expect(localStorage.getItem('vide:todo:projectSort')).toBe('created')
  })

  it('right-clicking a project shows Sort by alongside Rename and Move to Trash', async () => {
    mockApi({ todosListProjects: vi.fn().mockResolvedValue(threeProjects) })
    render(<TodoPanel />)
    await waitFor(() => screen.getByText('vIDE'))

    fireEvent.contextMenu(screen.getByText('vIDE'))
    expect(screen.getByRole('button', { name: 'Sort by' })).toBeInTheDocument()
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Move to Trash')).toBeInTheDocument()
  })

  it('Count sort loads every project\'s todos and puts the most not-done first', async () => {
    const todos: Record<string, { status: string; archived: boolean }[]> = {
      p1: [{ status: 'todo', archived: false }],
      p2: [
        { status: 'todo', archived: false },
        { status: 'in_progress', archived: false },
        { status: 'done', archived: false },
      ],
      p3: [{ status: 'done', archived: false }],
    }
    const todosListTodos = vi.fn((id: string) => Promise.resolve(todos[id]))
    mockApi({ todosListProjects: vi.fn().mockResolvedValue(threeProjects), todosListTodos } as any)
    useTodoSettingsStore.setState({ projectSort: 'count' })
    render(<TodoPanel />)

    await waitFor(() => expect(listedNames()).toEqual(['vIDE', 'Snajja Maltin', 'Bonnici Portfolio']))
    expect(todosListTodos).toHaveBeenCalledTimes(3)
  })

  it('shows backlog | todo | in progress | done counts for each project, ignoring archived', async () => {
    const todos: Record<string, { status: string; archived: boolean }[]> = {
      p1: [
        { status: 'backlog', archived: false },
        { status: 'backlog', archived: false },
        { status: 'todo', archived: false },
        { status: 'done', archived: false },
        { status: 'done', archived: true },
      ],
    }
    mockApi({
      todosListProjects: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'vIDE', key: 'VIDE', nextNumber: 1, createdAt: 1 },
      ]),
      todosListTodos: vi.fn((id: string) => Promise.resolve(todos[id] ?? [])),
    } as any)
    render(<TodoPanel />)

    const counts = await screen.findByLabelText('Backlog 2, Todo 1, In Progress 0, Done 1')
    expect(counts).toHaveTextContent('2|1|0|1')
  })

  it('Display toggles hide/show count columns without closing the menu', async () => {
    mockApi({
      todosListProjects: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'vIDE', key: 'VIDE', nextNumber: 1, createdAt: 1 },
      ]),
      todosListTodos: vi.fn().mockResolvedValue([
        { status: 'backlog', archived: false },
        { status: 'done', archived: false },
      ]),
    } as any)
    render(<TodoPanel />)
    await screen.findByLabelText('Backlog 1, Todo 0, In Progress 0, Done 1')

    fireEvent.contextMenu(screen.getByText('vIDE'))
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Display' }).parentElement!)
    fireEvent.click(screen.getByText('Todo'))
    fireEvent.click(screen.getByText('In Progress'))

    // Menu stayed open through both clicks.
    expect(screen.getByRole('button', { name: 'Display' })).toBeInTheDocument()
    expect(screen.getByLabelText('Backlog 1, Done 1')).toHaveTextContent('1|1')
    expect(JSON.parse(localStorage.getItem('vide:todo:shownCounts')!)).toEqual(['backlog', 'done'])

    fireEvent.click(screen.getByText('Todo'))
    expect(screen.getByLabelText('Backlog 1, Todo 0, Done 1')).toBeInTheDocument()
  })

  it('hides the counts entirely when every status is toggled off', async () => {
    useTodoSettingsStore.setState({ shownCounts: [] })
    mockApi({
      todosListProjects: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'vIDE', key: 'VIDE', nextNumber: 1, createdAt: 1 },
      ]),
    })
    render(<TodoPanel />)
    await screen.findByText('vIDE')
    expect(screen.queryByText('|')).not.toBeInTheDocument()
    expect(screen.getByText('vIDE').parentElement!.children).toHaveLength(2)
  })

  it('hides trashed projects and shows how many are in the Trash button, which opens the Trash tab', async () => {
    mockApi({
      todosListProjects: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'vIDE', key: 'VIDE', nextNumber: 1, createdAt: 1 },
        { id: 'p2', name: 'Old Site', key: 'OLD', nextNumber: 1, createdAt: 2, trashedAt: 5 },
      ]),
    })
    render(<TodoPanel />)
    await screen.findByText('vIDE')
    expect(screen.queryByText('Old Site')).not.toBeInTheDocument()

    const trash = screen.getByRole('button', { name: /Trash/ })
    expect(trash).toHaveTextContent('1')
    fireEvent.click(trash)
    expect(openTabMock).toHaveBeenCalledWith({ path: TODO_TRASH_TAB_PATH, content: '', dirty: false })
  })

  it('clicking a project opens its Kanban board tab', async () => {
    mockApi({
      todosListProjects: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'vIDE', key: 'H', nextNumber: 1, createdAt: 1 },
      ]),
    })
    render(<TodoPanel />)
    await waitFor(() => screen.getByText('vIDE'))
    fireEvent.click(screen.getByText('vIDE'))

    expect(openTabMock).toHaveBeenCalledWith({ path: buildTodoBoardPath('p1'), content: '', dirty: false })
    expect(useTodoStore.getState().lastOpenedProjectId).toBe('p1')
  })

  it('re-opens the last opened project on mount (e.g. returning from another sidebar panel)', async () => {
    mockApi({
      todosListProjects: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'vIDE', key: 'H', nextNumber: 1, createdAt: 1 },
      ]),
    })
    useTodoStore.setState({ lastOpenedProjectId: 'p1' })

    render(<TodoPanel />)

    await waitFor(() => {
      expect(openTabMock).toHaveBeenCalledWith({ path: buildTodoBoardPath('p1'), content: '', dirty: false })
    })
  })

  it('does not open anything on mount when no project has been opened yet', async () => {
    mockApi()
    render(<TodoPanel />)
    await waitFor(() => screen.getByText('No projects yet.'))
    expect(openTabMock).not.toHaveBeenCalled()
  })

  it('clicking New Project opens the create-project modal', async () => {
    mockApi()
    render(<TodoPanel />)
    await waitFor(() => screen.getByText('No projects yet.'))
    fireEvent.click(screen.getByRole('button', { name: 'New Project' }))

    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  describe('project context menu', () => {
    async function renderWithProject() {
      mockApi({
        todosListProjects: vi.fn().mockResolvedValue([
          { id: 'p1', name: 'vIDE', key: 'H', nextNumber: 1, createdAt: 1 },
        ]),
      })
      render(<TodoPanel />)
      await waitFor(() => screen.getByText('vIDE'))
    }

    it('right-clicking a project shows Rename and Move to Trash', async () => {
      await renderWithProject()
      fireEvent.contextMenu(screen.getByText('vIDE'))

      expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Move to Trash' })).toBeInTheDocument()
    })

    it('choosing Rename opens the rename modal prefilled with the project', async () => {
      await renderWithProject()
      fireEvent.contextMenu(screen.getByText('vIDE'))
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

      expect(screen.getByLabelText('Name')).toHaveValue('vIDE')
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    })

    it('choosing Move to Trash opens the trash confirmation modal for the project', async () => {
      await renderWithProject()
      fireEvent.contextMenu(screen.getByText('vIDE'))
      fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }))

      expect(screen.getByText(/restore it any time from Trash/)).toBeInTheDocument()
    })
  })
})
