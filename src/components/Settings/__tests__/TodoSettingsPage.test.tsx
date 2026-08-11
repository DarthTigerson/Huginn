/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TodoSettingsPage } from '../TodoSettingsPage'
import { useTodoSettingsStore } from '@/stores/todoSettingsStore'

afterEach(() => {
  cleanup()
  useTodoSettingsStore.setState({ externalUrl: '', closeSidePanelOnOpen: false, enabled: true })
})

describe('TodoSettingsPage', () => {
  it('reflects the currently configured URL', () => {
    useTodoSettingsStore.setState({ externalUrl: 'https://team.atlassian.net/jira/board' })
    render(<TodoSettingsPage />)
    expect(screen.getByLabelText('URL')).toHaveValue('https://team.atlassian.net/jira/board')
  })

  it('updates the store as the user types', () => {
    render(<TodoSettingsPage />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://linear.app/team/board' } })
    expect(useTodoSettingsStore.getState().externalUrl).toBe('https://linear.app/team/board')
  })

  it('reflects the current closeSidePanelOnOpen state', () => {
    useTodoSettingsStore.setState({ closeSidePanelOnOpen: true })
    render(<TodoSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Close side panel when opening' })).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles closeSidePanelOnOpen on click', () => {
    render(<TodoSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Close side panel when opening' }))
    expect(useTodoSettingsStore.getState().closeSidePanelOnOpen).toBe(true)
  })

  it('reflects the current enabled state', () => {
    useTodoSettingsStore.setState({ enabled: false })
    render(<TodoSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Enable To Do' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles enabled on click', () => {
    render(<TodoSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Enable To Do' }))
    expect(useTodoSettingsStore.getState().enabled).toBe(false)
  })
})
