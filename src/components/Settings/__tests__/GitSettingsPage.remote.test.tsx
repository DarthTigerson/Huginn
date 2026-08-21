/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { GitSettingsPage } from '../GitSettingsPage'
import { useGitRemoteSettingsStore } from '@/stores/gitRemoteSettingsStore'
import { useFileStore } from '@/stores/fileStore'

beforeEach(() => {
  ;(global as any).window.api = {
    ...(global as any).window.api,
    gitBranches: vi.fn().mockResolvedValue([]),
  }
  useFileStore.setState({ projectRoot: null })
})

afterEach(() => {
  cleanup()
  useGitRemoteSettingsStore.setState({ externalUrl: '', projectUrls: {}, closeSidePanelOnOpen: false })
})

describe('GitSettingsPage — Git Remote section', () => {
  it('reflects the currently configured URL', () => {
    useGitRemoteSettingsStore.setState({ externalUrl: 'https://github.com/acme/widgets' })
    render(<GitSettingsPage />)
    expect(screen.getByLabelText('Default URL')).toHaveValue('https://github.com/acme/widgets')
  })

  it('updates the store as the user types', () => {
    render(<GitSettingsPage />)
    fireEvent.change(screen.getByLabelText('Default URL'), { target: { value: 'https://gitlab.com/acme/widgets' } })
    expect(useGitRemoteSettingsStore.getState().externalUrl).toBe('https://gitlab.com/acme/widgets')
  })

  it('does not show a per-project URL field when no project is open', () => {
    render(<GitSettingsPage />)
    expect(screen.queryByLabelText("This project's URL")).not.toBeInTheDocument()
  })

  it('shows and updates a per-project URL override when a project is open', async () => {
    useFileStore.setState({ projectRoot: '/repo/a' })
    render(<GitSettingsPage />)
    // Settle the branches-fetch effect this projectRoot also triggers, so its
    // resulting state update doesn't land outside this test's act() scope.
    const field = await screen.findByLabelText("This project's URL")
    expect(field).toHaveValue('')
    fireEvent.change(field, { target: { value: 'https://gitlab.com/acme/widgets-fork' } })
    expect(useGitRemoteSettingsStore.getState().projectUrls['/repo/a']).toBe('https://gitlab.com/acme/widgets-fork')
  })

  it('reflects the current closeSidePanelOnOpen state', () => {
    useGitRemoteSettingsStore.setState({ closeSidePanelOnOpen: true })
    render(<GitSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Close side panel when opening' })).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles closeSidePanelOnOpen on click', () => {
    render(<GitSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Close side panel when opening' }))
    expect(useGitRemoteSettingsStore.getState().closeSidePanelOnOpen).toBe(true)
  })
})
