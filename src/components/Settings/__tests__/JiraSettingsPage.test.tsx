/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { JiraSettingsPage } from '../JiraSettingsPage'
import { useJiraSettingsStore } from '@/stores/jiraSettingsStore'

afterEach(() => {
  cleanup()
  useJiraSettingsStore.setState({ externalUrl: '', closeSidePanelOnOpen: false, enabled: true })
})

describe('JiraSettingsPage', () => {
  it('reflects the currently configured URL', () => {
    useJiraSettingsStore.setState({ externalUrl: 'https://team.atlassian.net/jira/board' })
    render(<JiraSettingsPage />)
    expect(screen.getByLabelText('URL')).toHaveValue('https://team.atlassian.net/jira/board')
  })

  it('updates the store as the user types', () => {
    render(<JiraSettingsPage />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://linear.app/team/board' } })
    expect(useJiraSettingsStore.getState().externalUrl).toBe('https://linear.app/team/board')
  })

  it('reflects the current closeSidePanelOnOpen state', () => {
    useJiraSettingsStore.setState({ closeSidePanelOnOpen: true })
    render(<JiraSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Close side panel when opening' })).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles closeSidePanelOnOpen on click', () => {
    render(<JiraSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Close side panel when opening' }))
    expect(useJiraSettingsStore.getState().closeSidePanelOnOpen).toBe(true)
  })

  it('reflects the current enabled state', () => {
    useJiraSettingsStore.setState({ enabled: false })
    render(<JiraSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Enable Jira' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles enabled on click', () => {
    render(<JiraSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Jira' }))
    expect(useJiraSettingsStore.getState().enabled).toBe(false)
  })
})
