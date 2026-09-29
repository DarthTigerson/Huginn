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
    todosListTodos: vi.fn((id: string) => Promise.resolve(id === 'p3' ? [{ id: 'T-1' }, { id: 'T-2' }] : [])),
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

  it('lists only trashed projects, most recently trashed first, with their todo counts', async () => {
    mockApi([live, older, newer])
    render(<TodoTrashPage />)

    await screen.findByText('Old Site')
    const restoreButtons = screen.getAllByRole('button', { name: /^Restore / })
    expect(restoreButtons.map((b) => b.getAttribute('aria-label'))).toEqual(['Restore Test', 'Restore Old Site'])
    expect(screen.queryByText('vIDE')).not.toBeInTheDocument()
    expect(await screen.findByText('2 todos')).toBeInTheDocument()
  })

  it('Restore moves the project back to the live list', async () => {
    mockApi([live, newer])
    render(<TodoTrashPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Restore Test' }))

    await waitFor(() => expect(screen.getByText('The Trash is empty.')).toBeInTheDocument())
    expect(window.api.todosRestoreProject).toHaveBeenCalledWith('p3')
    expect(useTodoStore.getState().projects.map((p) => p.id)).toContain('p3')
  })
})
