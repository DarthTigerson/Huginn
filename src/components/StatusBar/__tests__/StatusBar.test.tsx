import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { StatusBar } from '../StatusBar'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useAutocompleteSessionStore } from '@/stores/autocompleteSessionStore'
import { useAutocompleteStatusStore } from '@/stores/autocompleteStatusStore'

beforeEach(() => {
  ;(global as any).window.api = {
    gitBranch: async () => null,
    gitAheadBehind: async () => null,
  }
})

afterEach(() => {
  cleanup()
  useAutocompleteSettingsStore.setState({ enabled: true, model: 'claude-haiku-4-5-20251001' })
  useAutocompleteSessionStore.setState({ paused: false })
  useAutocompleteStatusStore.setState({ busy: false })
})

describe('StatusBar autocomplete icon', () => {
  it('shows the crossed-out icon when disabled in settings', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<StatusBar />)
    expect(screen.getByRole('button', { name: 'Autocomplete off' })).toBeTruthy()
  })

  it('shows the active icon when enabled and not paused', () => {
    render(<StatusBar />)
    expect(screen.getByRole('button', { name: 'Autocomplete on' })).toBeTruthy()
  })

  it('opens a pause popup on click when enabled', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete on' }))
    expect(screen.getByText('Pause for this session')).toBeTruthy()
  })

  it('pausing flips the session store and updates the popup label', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete on' }))
    fireEvent.click(screen.getByText('Pause for this session'))

    expect(useAutocompleteSessionStore.getState().paused).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete off' }))
    expect(screen.getByText('Resume')).toBeTruthy()
  })

  it('shows an informational message instead of a toggle when disabled in settings', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<StatusBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Autocomplete off' }))

    expect(screen.getByText('Autocomplete is off in Settings')).toBeTruthy()
    expect(screen.queryByText('Pause for this session')).toBeNull()
    expect(screen.queryByText('Resume')).toBeNull()
  })

  it('opens the same popup on right-click', () => {
    render(<StatusBar />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Autocomplete on' }))
    expect(screen.getByText('Pause for this session')).toBeTruthy()
  })
})
