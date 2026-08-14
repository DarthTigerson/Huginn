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
  useGitRemoteSettingsStore.setState({ externalUrl: '', closeSidePanelOnOpen: false })
})

describe('GitSettingsPage — Git Remote section', () => {
  it('reflects the currently configured URL', () => {
    useGitRemoteSettingsStore.setState({ externalUrl: 'https://github.com/acme/widgets' })
    render(<GitSettingsPage />)
    expect(screen.getByLabelText('URL')).toHaveValue('https://github.com/acme/widgets')
  })

  it('updates the store as the user types', () => {
    render(<GitSettingsPage />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://gitlab.com/acme/widgets' } })
    expect(useGitRemoteSettingsStore.getState().externalUrl).toBe('https://gitlab.com/acme/widgets')
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
