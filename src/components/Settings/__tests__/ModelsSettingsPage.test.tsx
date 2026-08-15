/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ModelsSettingsPage } from '../ModelsSettingsPage'
import { useAutocompleteSettingsStore } from '@/stores/autocompleteSettingsStore'
import { useModelSettingsStore } from '@/stores/modelSettingsStore'
import { useCosmosSettingsStore } from '@/stores/cosmosSettingsStore'
import { useInlineEditSettingsStore } from '@/stores/inlineEditSettingsStore'
import { useUsagePassiveSettingsStore } from '@/stores/usagePassiveSettingsStore'
import { useEditorStore } from '@/stores/editorStore'
import { USAGE_GRAPH_TAB_PATH } from '@/components/Settings/paths'

function baseWindowApi() {
  return {
    usageGetPassiveEnabled: vi.fn().mockResolvedValue(false),
    usageSetPassiveEnabled: vi.fn().mockResolvedValue(undefined),
  }
}

beforeEach(() => {
  ;(global as any).window.api = baseWindowApi()
})

afterEach(() => {
  cleanup()
  useAutocompleteSettingsStore.setState({ enabled: true, model: 'claude-haiku-4-5-20251001' })
  useModelSettingsStore.setState({ enabled: { claude: true, codex: true, cosmos: true } })
  useCosmosSettingsStore.setState({ endpoint: '', apiKey: '', modelId: '' })
  useInlineEditSettingsStore.setState({ enabled: true, model: 'claude-sonnet-5' })
  useUsagePassiveSettingsStore.setState({ enabled: false, initialized: false })
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
    ;(global as any).window.api = { ...baseWindowApi(), cosmosTestConnection: vi.fn().mockResolvedValue({ ok: true }) }
    render(<ModelsSettingsPage />)

    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => expect(screen.getByText('Connected')).toBeTruthy())
  })

  it('shows an error message when the test connection fails', async () => {
    ;(global as any).window.api = { ...baseWindowApi(), cosmosTestConnection: vi.fn().mockResolvedValue({ ok: false, error: 'HTTP 401' }) }
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

describe('ModelsSettingsPage inline edit section', () => {
  it('reflects the current enabled state', () => {
    useInlineEditSettingsStore.setState({ enabled: false })
    render(<ModelsSettingsPage />)
    expect(screen.getByRole('switch', { name: 'Inline Edit (Cmd+K)' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles inline edit on click', () => {
    render(<ModelsSettingsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Inline Edit (Cmd+K)' }))
    expect(useInlineEditSettingsStore.getState().enabled).toBe(false)
  })

  it('reflects the current model selection', () => {
    useInlineEditSettingsStore.setState({ model: 'claude-opus-5' })
    render(<ModelsSettingsPage />)
    expect((screen.getByLabelText('Inline Edit Model') as HTMLSelectElement).value).toBe('claude-opus-5')
  })

  it('updates the model when changed', () => {
    render(<ModelsSettingsPage />)
    fireEvent.change(screen.getByLabelText('Inline Edit Model'), { target: { value: 'claude-haiku-4-5-20251001' } })
    expect(useInlineEditSettingsStore.getState().model).toBe('claude-haiku-4-5-20251001')
  })
})

describe('ModelsSettingsPage usage monitoring section', () => {
  it('reflects the persisted passive-monitoring setting on load', async () => {
    ;(global as any).window.api = { ...baseWindowApi(), usageGetPassiveEnabled: vi.fn().mockResolvedValue(true) }
    render(<ModelsSettingsPage />)
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Passive usage monitoring' })).toHaveAttribute('aria-checked', 'true')
    )
  })

  it('toggles passive monitoring on click and persists it via IPC', async () => {
    render(<ModelsSettingsPage />)
    await waitFor(() => expect(window.api.usageGetPassiveEnabled).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('switch', { name: 'Passive usage monitoring' }))

    expect(useUsagePassiveSettingsStore.getState().enabled).toBe(true)
    expect(window.api.usageSetPassiveEnabled).toHaveBeenCalledWith(true)
  })

  it('opens the Usage Graph tab when "Open Usage Graph" is clicked', async () => {
    render(<ModelsSettingsPage />)
    await waitFor(() => expect(window.api.usageGetPassiveEnabled).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Open Usage Graph' }))

    expect(useEditorStore.getState().tabs.some((t) => t.path === USAGE_GRAPH_TAB_PATH)).toBe(true)
  })
})
