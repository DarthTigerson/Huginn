/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { TodoTrashPage } from '../TodoTrashPage'
import { useTodoStore } from '@/stores/todoStore'
import type { TodoProject } from '@/types/api'

const live: TodoProject = { id: 'p1', name: 'vIDE', key: 'VIDE', nextNumber: 1, createdAt: 1 }
const older: TodoProject = { id: 'p2', name: 'Old Site', key: 'OLD', nextNumber: 1, createdAt: 2, trashedAt: 100 }
const newer: TodoProject = { id: 'p3', name: 'Test', key: 'T', nextNumber: 1, createdAt: 3, trashedAt: 200 }

function mockApi(projects: TodoProject[]) {
  ;(global as any).window.api = {
    todosListProjects: vi.fn().mockResolvedValue(projects),
    todosListTodos: vi.fn((id: string) =>
      Promise.resolve(
        id === 'p3'
          ? [
              { id: 'T-1', status: 'backlog', archived: false },
              { id: 'T-2', status: 'backlog', archived: false },
              { id: 'T-3', status: 'in_progress', archived: false },
              { id: 'T-4', status: 'done', archived: true },
            ]
          : []
      )
    ),
    todosRestoreProject: vi.fn((id: string) =>
      Promise.resolve({ ...projects.find((p) => p.id === id)!, trashedAt: null })
    ),
  }
}

beforeEach(() => {
  useTodoStore.setState({ projects: [], trashedProjects: [], todosByProject: {} })
})

afterEach(() => {
  cleanup()
})

describe('TodoTrashPage', () => {
  it('shows an empty state when nothing is trashed', async () => {
    mockApi([live])
    render(<TodoTrashPage />)
    expect(await screen.findByText('The Trash is empty.')).toBeInTheDocument()
  })

  it('lists only trashed projects, most recently trashed first', async () => {
    mockApi([live, older, newer])
    render(<TodoTrashPage />)

    await screen.findByText('Old Site')
    const names = [screen.getByText('Test'), screen.getByText('Old Site')]
    expect(names[0].compareDocumentPosition(names[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Restore/ })).not.toBeInTheDocument()
    expect(screen.queryByText('vIDE')).not.toBeInTheDocument()
  })

  it('shows backlog | todo | in progress | done | archived counts, each named on hover', async () => {
    mockApi([newer])
    render(<TodoTrashPage />)

    const backlog = await screen.findByTitle('Backlog')
    expect(backlog).toHaveTextContent('2')
    expect(screen.getByTitle('Todo')).toHaveTextContent('0')
    expect(screen.getByTitle('In Progress')).toHaveTextContent('1')
    expect(screen.getByTitle('Done')).toHaveTextContent('0')
    expect(screen.getByTitle('Archived')).toHaveTextContent('1')
    expect(screen.queryByText(/todos?$/)).not.toBeInTheDocument()
  })

  it('right-click > Restore moves the project back to the live list', async () => {
    mockApi([live, newer])
    render(<TodoTrashPage />)
    fireEvent.contextMenu(await screen.findByText('Test'))
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    await waitFor(() => expect(screen.getByText('The Trash is empty.')).toBeInTheDocument())
    expect(window.api.todosRestoreProject).toHaveBeenCalledWith('p3')
    expect(useTodoStore.getState().projects.map((p) => p.id)).toContain('p3')
  })
})
