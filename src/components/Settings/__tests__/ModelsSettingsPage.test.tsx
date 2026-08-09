/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ModelsSettingsPage } from '../ModelsSettingsPage'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useModelSettingsStore } from '@/stores/modelSettingsStore'
import { useCosmosSettingsStore } from '@/stores/cosmosSettingsStore'

afterEach(() => {
  cleanup()
  useAutocompleteSettingsStore.setState({ enabled: true, model: 'claude-haiku-4-5-20251001' })
  useModelSettingsStore.setState({ enabled: { claude: true, codex: true, cosmos: true } })
  useCosmosSettingsStore.setState({ endpoint: '', apiKey: '', modelId: '' })
})

describe('ModelsSettingsPage assistants section', () => {
  it('reflects the current enabled state for each assistant', () => {
    useModelSettingsStore.setState({ enabled: { claude: true, codex: false, cosmos: true } })
    render(<ModelsSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Codex' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles an assistant on click', () => {
    render(<ModelsSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Codex' }))
    expect(useModelSettingsStore.getState().enabled.codex).toBe(false)
  })
})

describe('ModelsSettingsPage cosmos section', () => {
  it('is visible when cosmos is enabled', () => {
    useModelSettingsStore.setState({ enabled: { claude: true, codex: true, cosmos: true } })
    render(<ModelsSettingsPage />)
    expect(screen.getByLabelText('Endpoint')).toBeTruthy()
  })

  it('is hidden when cosmos is disabled', () => {
    useModelSettingsStore.setState({ enabled: { claude: true, codex: true, cosmos: false } })
    render(<ModelsSettingsPage />)
    expect(screen.queryByLabelText('Endpoint')).toBeNull()
  })

  it('renders current settings values', () => {
    useCosmosSettingsStore.setState({ endpoint: 'http://host:8002/v1', apiKey: 'local', modelId: 'test-model' })
    render(<ModelsSettingsPage />)

    expect((screen.getByLabelText('Endpoint') as HTMLInputElement).value).toBe('http://host:8002/v1')
    expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe('local')
    expect((screen.getByLabelText('Model ID') as HTMLInputElement).value).toBe('test-model')
  })

  it('updates the store when a field changes', () => {
    render(<ModelsSettingsPage />)
    fireEvent.change(screen.getByLabelText('Endpoint'), { target: { value: 'http://new:8002/v1' } })
    expect(useCosmosSettingsStore.getState().endpoint).toBe('http://new:8002/v1')
  })

  it('shows a success message when the test connection succeeds', async () => {
    ;(global as any).window.api = { cosmosTestConnection: vi.fn().mockResolvedValue({ ok: true }) }
    render(<ModelsSettingsPage />)

    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => expect(screen.getByText('Connected')).toBeTruthy())
  })

  it('shows an error message when the test connection fails', async () => {
    ;(global as any).window.api = { cosmosTestConnection: vi.fn().mockResolvedValue({ ok: false, error: 'HTTP 401' }) }
    render(<ModelsSettingsPage />)

    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => expect(screen.getByText('HTTP 401')).toBeTruthy())
  })
})

describe('ModelsSettingsPage autocomplete section', () => {
  it('reflects the current enabled state', () => {
    useAutocompleteSettingsStore.setState({ enabled: false })
    render(<ModelsSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Inline Autocomplete' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles autocomplete on click', () => {
    render(<ModelsSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Inline Autocomplete' }))
    expect(useAutocompleteSettingsStore.getState().enabled).toBe(false)
  })

  it('reflects the current model selection', () => {
    useAutocompleteSettingsStore.setState({ model: 'claude-opus-5' })
    render(<ModelsSettingsPage />)
    expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('claude-opus-5')
  })

  it('updates the model when changed', () => {
    render(<ModelsSettingsPage />)
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'claude-sonnet-5' } })
    expect(useAutocompleteSettingsStore.getState().model).toBe('claude-sonnet-5')
  })
})
