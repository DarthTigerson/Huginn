/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { EditorSettingsPage } from '../EditorSettingsPage'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'

afterEach(() => {
  cleanup()
  useAutocompleteSettingsStore.setState({ enabled: true, model: 'claude-haiku-4-5-20251001' })
  useEditorSettingsStore.setState({ autoSaveEnabled: false })
})

describe('EditorSettingsPage autocomplete section', () => {
  it('reflects the current enabled state', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<EditorSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Inline Autocomplete' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles autocomplete on click', () => {
    render(<EditorSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Inline Autocomplete' }))
    expect(useAutocompleteSettingsStore.getState().enabled).toBe(false)
  })

  it('reflects the current model selection', () => {
    useAutocompleteSettingsStore.setState({ model: 'claude-opus-5' })
    render(<EditorSettingsPage />)
    expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5')
  })

  it('updates the model when changed', () => {
    render(<EditorSettingsPage />)
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'claude-sonnet-5' } })
    expect(useAutocompleteSettingsStore.getState().model).toBe('claude-sonnet-5')
  })
})
