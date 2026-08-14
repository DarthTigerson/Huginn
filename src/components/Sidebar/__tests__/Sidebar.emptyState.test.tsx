/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { Sidebar } from '../Sidebar'
import { useFileStore } from '@/stores/fileStore'

afterEach(() => {
  cleanup()
})

function mockApi(overrides: Partial<typeof window.api> = {}) {
  ;(global as any).window.api = {
    recentProjectsList: vi.fn().mockResolvedValue([]),
    focusProjectIfOpen: vi.fn().mockResolvedValue(false),
    ...overrides,
  }
}

describe('Sidebar — empty state (no folder open)', () => {
  it('shows the Open Folder button', () => {
    mockApi()
    useFileStore.setState({ projectRoot: null, tree: [] })
    render(<Sidebar />)
    expect(screen.getByText('Select a project')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Folder' })).toBeInTheDocument()
  })

  it('lists recent projects inline, most recent first, with no separate button to open a palette', () => {
    mockApi({
      recentProjectsList: vi.fn().mockResolvedValue([
        { path: '/Users/thomas/repo-a', lastOpened: 2 },
        { path: '/Users/thomas/repo-b', lastOpened: 1 },
      ]),
    })
    useFileStore.setState({ projectRoot: null, tree: [] })
    render(<Sidebar />)
    expect(screen.queryByRole('button', { name: 'Recent Projects' })).not.toBeInTheDocument()
    return waitFor(() => {
      expect(screen.getByText('repo-a')).toBeInTheDocument()
      expect(screen.getByText('repo-b')).toBeInTheDocument()
    })
  })

  it('shows nothing extra when there are no recent projects', async () => {
    mockApi()
    useFileStore.setState({ projectRoot: null, tree: [] })
    render(<Sidebar />)
    await waitFor(() => expect(window.api.recentProjectsList).toHaveBeenCalled())
    expect(screen.queryByText('Recent Projects')).not.toBeInTheDocument()
  })

  it('clicking a recent project opens it in the current window', async () => {
    mockApi({
      recentProjectsList: vi.fn().mockResolvedValue([{ path: '/Users/thomas/repo-a', lastOpened: 1 }]),
    })
    useFileStore.setState({ projectRoot: null, tree: [] })
    const openRecentProject = vi.fn()
    useFileStore.setState({ openRecentProject } as any)
    render(<Sidebar />)

    const item = await screen.findByText('repo-a')
    fireEvent.click(item)

    await waitFor(() => expect(openRecentProject).toHaveBeenCalledWith('/Users/thomas/repo-a'))
  })

  it('focuses the existing window instead of reopening when the project is already open elsewhere', async () => {
    mockApi({
      recentProjectsList: vi.fn().mockResolvedValue([{ path: '/Users/thomas/repo-a', lastOpened: 1 }]),
      focusProjectIfOpen: vi.fn().mockResolvedValue(true),
    })
    useFileStore.setState({ projectRoot: null, tree: [] })
    const openRecentProject = vi.fn()
    useFileStore.setState({ openRecentProject } as any)
    render(<Sidebar />)

    const item = await screen.findByText('repo-a')
    fireEvent.click(item)

    await waitFor(() => expect(window.api.focusProjectIfOpen).toHaveBeenCalledWith('/Users/thomas/repo-a'))
    expect(openRecentProject).not.toHaveBeenCalled()
  })
})
