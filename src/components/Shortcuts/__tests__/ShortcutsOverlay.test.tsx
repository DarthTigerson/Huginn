import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ShortcutsOverlay } from '../ShortcutsOverlay'

afterEach(() => cleanup())

describe('ShortcutsOverlay', () => {
  it('renders every category and shortcut label', () => {
    render(<ShortcutsOverlay />)

    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument()
    expect(screen.getByText('Split Pane Vertical')).toBeInTheDocument()
    expect(screen.getByText('Open Project')).toBeInTheDocument()
  })

  it('renders one key cap per shortcut key, including shift symbols', () => {
    render(<ShortcutsOverlay />)

    expect(screen.getAllByText('⌘')).toHaveLength(10)
    expect(screen.getAllByText('⇧').length).toBeGreaterThan(0)
  })
})
