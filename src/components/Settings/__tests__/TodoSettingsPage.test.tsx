/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TodoSettingsPage } from '../TodoSettingsPage'
import { useTodoSettingsStore } from '@/stores/todoSettingsStore'

afterEach(() => {
  cleanup()
  useTodoSettingsStore.setState({ externalUrl: '', closeSidePanelOnOpen: false, enabled: false })
})

describe('TodoSettingsPage', () => {
  it('renders the Enable To Do toggle as disabled and off (feature parked, not yet built)', () => {
    render(<TodoSettingsPage />)
    const toggle = screen.getByRole('switch', { name: 'Enable To Do' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('does not change store state when the disabled toggle is clicked', () => {
    render(<TodoSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Enable To Do' }))
    expect(useTodoSettingsStore.getState().enabled).toBe(false)
  })

  it('no longer renders the External Todos URL field', () => {
    render(<TodoSettingsPage />)
    expect(screen.queryByLabelText('URL')).not.toBeInTheDocument()
  })
})
