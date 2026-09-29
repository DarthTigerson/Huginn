/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { TrashTodoProjectModal } from '../TrashTodoProjectModal'
import { useTodoStore } from '@/stores/todoStore'
import type { TodoProject } from '@/types/api'

const trashProjectMock = vi.fn()
const project: TodoProject = { id: 'p1', name: 'vIDE', key: 'H', nextNumber: 3, createdAt: 1 }

beforeEach(() => {
  trashProjectMock.mockReset()
  useTodoStore.setState({ trashProject: trashProjectMock })
})

afterEach(() => {
  cleanup()
})

describe('TrashTodoProjectModal', () => {
  it('says the project can be restored from the Trash', () => {
    render(<TrashTodoProjectModal project={project} onClose={vi.fn()} />)
    expect(screen.getByText(/restore it any time from Trash/)).toBeInTheDocument()
  })

  it('moves the project to the Trash and closes', async () => {
    trashProjectMock.mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<TrashTodoProjectModal project={project} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }))

    await waitFor(() => {
      expect(trashProjectMock).toHaveBeenCalledWith('p1')
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows an error and does not close when it fails', async () => {
    trashProjectMock.mockRejectedValue(new Error('Disk full'))
    const onClose = vi.fn()
    render(<TrashTodoProjectModal project={project} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }))

    await waitFor(() => {
      expect(screen.getByText('Disk full')).toBeInTheDocument()
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
