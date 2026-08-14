/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Sidebar } from '../Sidebar'
import { useFileStore } from '@/stores/fileStore'
import { useSearchStore } from '@/stores/searchStore'

afterEach(() => {
  cleanup()
  useSearchStore.setState({ recentProjectsPaletteOpen: false })
})

describe('Sidebar — empty state (no folder open)', () => {
  it('shows Open Folder and Recent Projects buttons', () => {
    useFileStore.setState({ projectRoot: null, tree: [] })
    render(<Sidebar />)
    expect(screen.getByText('Select a project')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Folder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recent Projects' })).toBeInTheDocument()
  })

  it('clicking Recent Projects opens the same palette Ctrl+R does', () => {
    useFileStore.setState({ projectRoot: null, tree: [] })
    render(<Sidebar />)
    fireEvent.click(screen.getByRole('button', { name: 'Recent Projects' }))
    expect(useSearchStore.getState().recentProjectsPaletteOpen).toBe(true)
  })
})
