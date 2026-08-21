/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { JiraSettingsPage } from '../JiraSettingsPage'
import { useJiraSettingsStore } from '@/stores/jiraSettingsStore'
import { useFileStore } from '@/stores/fileStore'

beforeEach(() => {
  useFileStore.setState({ projectRoot: null })
})

afterEach(() => {
  cleanup()
  useJiraSettingsStore.setState({ externalUrl: '', projectUrls: {}, closeSidePanelOnOpen: false, enabled: true })
})

describe('JiraSettingsPage', () => {
  it('reflects the currently configured URL', () => {
    useJiraSettingsStore.setState({ externalUrl: 'https://team.atlassian.net/jira/board' })
    render(<JiraSettingsPage />)
    expect(screen.getByLabelText('Default URL')).toHaveValue('https://team.atlassian.net/jira/board')
  })

  it('updates the store as the user types', () => {
    render(<JiraSettingsPage />)
    fireEvent.change(screen.getByLabelText('Default URL'), { target: { value: 'https://linear.app/team/board' } })
    expect(useJiraSettingsStore.getState().externalUrl).toBe('https://linear.app/team/board')
  })

  it('does not show a per-project URL field when no project is open', () => {
    render(<JiraSettingsPage />)
    expect(screen.queryByLabelText("This project's URL")).not.toBeInTheDocument()
  })

  it('shows and updates a per-project URL override when a project is open', () => {
    useFileStore.setState({ projectRoot: '/repo/a' })
    render(<JiraSettingsPage />)
    const field = screen.getByLabelText("This project's URL")
    expect(field).toHaveValue('')
    fireEvent.change(field, { target: { value: 'https://other-team.atlassian.net/jira/board' } })
    expect(useJiraSettingsStore.getState().projectUrls['/repo/a']).toBe('https://other-team.atlassian.net/jira/board')
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
