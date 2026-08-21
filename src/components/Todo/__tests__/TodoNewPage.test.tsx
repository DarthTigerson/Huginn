/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { TodoNewPage } from '../TodoNewPage'
import { useTodoStore } from '@/stores/todoStore'
import { useEditorStore } from '@/stores/editorStore'
import { buildTodoBoardPath, buildTodoNewPath } from '@/components/Settings/paths'
import type { Todo, TodoProject } from '@/types/api'

afterEach(() => {
  cleanup()
})

const project: TodoProject = { id: 'p1', name: 'Huginn', key: 'H', nextNumber: 1, createdAt: 1 }

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'H-1',
    projectId: 'p1',
    title: 'First',
    description: '',
    attachments: [],
    status: 'backlog',
    archived: false,
    label: null,
    tags: [],
    prUrl: null,
    comments: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

const createTodoMock = vi.fn()
const updateTodoMock = vi.fn()
const closeTabMock = vi.fn()
const openTabMock = vi.fn()

beforeEach(() => {
  createTodoMock.mockReset().mockResolvedValue(makeTodo())
  updateTodoMock.mockReset().mockResolvedValue(makeTodo())
  closeTabMock.mockReset()
  openTabMock.mockReset()
  useTodoStore.setState({
    projects: [project],
    todosByProject: {},
    createTodo: createTodoMock,
    updateTodo: updateTodoMock,
  })
  useEditorStore.setState({ closeTab: closeTabMock, openTab: openTabMock })
  ;(global as any).window.api = {
    todosReadAttachmentDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,AAA'),
  }
})

describe('TodoNewPage', () => {
  it('shows the project name in the header', () => {
    render(<TodoNewPage projectId="p1" />)
    expect(screen.getByText(/Huginn/)).toBeInTheDocument()
  })

  it('defaults status to Backlog, with the other columns selectable', () => {
    render(<TodoNewPage projectId="p1" />)
    expect(screen.getByLabelText('Status')).toHaveValue('backlog')
  })

  it('disables Create until a title is entered', () => {
    render(<TodoNewPage projectId="p1" />)
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fix bug' } })
    expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled()
  })

  it('creates the todo with just a title, then closes this tab and opens the board', async () => {
    render(<TodoNewPage projectId="p1" />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fix bug' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createTodoMock).toHaveBeenCalledWith('p1', 'Fix bug')
      expect(updateTodoMock).not.toHaveBeenCalled()
      expect(closeTabMock).toHaveBeenCalledWith(buildTodoNewPath('p1'))
      expect(openTabMock).toHaveBeenCalledWith({ path: buildTodoBoardPath('p1'), content: '', dirty: false })
    })
  })

  it('carries description, label, status, and PR URL into a follow-up updateTodo call', async () => {
    createTodoMock.mockResolvedValue(makeTodo({ id: 'H-2' }))
    render(<TodoNewPage projectId="p1" />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fix bug' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Steps to repro' } })
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'bug' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_progress' } })
    fireEvent.change(screen.getByLabelText('PR/MR URL'), { target: { value: 'https://github.com/org/repo/pull/1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(updateTodoMock).toHaveBeenCalledWith('H-2', {
        description: 'Steps to repro',
        label: 'bug',
        status: 'in_progress',
        prUrl: 'https://github.com/org/repo/pull/1',
      })
    })
  })

  it('carries tags into the follow-up updateTodo call', async () => {
    createTodoMock.mockResolvedValue(makeTodo({ id: 'H-2' }))
    render(<TodoNewPage projectId="p1" />)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Fix bug' } })
    const tagsInput = screen.getByLabelText('Tags')
    fireEvent.change(tagsInput, { target: { value: 'frontend' } })
    fireEvent.keyDown(tagsInput, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(updateTodoMock).toHaveBeenCalledWith('H-2', { tags: ['frontend'] })
    })
  })

  it('Cancel closes the tab without creating anything', () => {
    render(<TodoNewPage projectId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(createTodoMock).not.toHaveBeenCalled()
    expect(closeTabMock).toHaveBeenCalledWith(buildTodoNewPath('p1'))
  })
})
