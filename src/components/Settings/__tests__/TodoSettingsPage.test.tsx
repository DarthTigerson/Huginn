/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TodoSettingsPage } from '../TodoSettingsPage'
import { useTodoSettingsStore } from '@/stores/todoSettingsStore'

afterEach(() => {
  cleanup()
  useTodoSettingsStore.setState({ externalUrl: '' })
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
})
