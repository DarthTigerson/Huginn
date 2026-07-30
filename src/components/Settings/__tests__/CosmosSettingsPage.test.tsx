import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CosmosSettingsPage } from '../CosmosSettingsPage'
import { useCosmosSettingsStore } from '@/stores/cosmosSettingsStore'

afterEach(() => {
  cleanup()
  useCosmosSettingsStore.setState({ endpoint: '', apiKey: '', modelId: '' })
})

describe('CosmosSettingsPage', () => {
  it('renders current settings values', () => {
    useCosmosSettingsStore.setState({ endpoint: 'http://host:8002/v1', apiKey: 'local', modelId: 'test-model' })
    render(<CosmosSettingsPage />)

    expect((screen.getByLabelText('Endpoint') as HTMLInputElement).value).toBe('http://host:8002/v1')
    expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe('local')
    expect((screen.getByLabelText('Model ID') as HTMLInputElement).value).toBe('test-model')
  })

  it('updates the store when a field changes', () => {
    render(<CosmosSettingsPage />)
    fireEvent.change(screen.getByLabelText('Endpoint'), { target: { value: 'http://new:8002/v1' } })
    expect(useCosmosSettingsStore.getState().endpoint).toBe('http://new:8002/v1')
  })

  it('shows a success message when the test connection succeeds', async () => {
    ;(global as any).window.api = { cosmosTestConnection: vi.fn().mockResolvedValue({ ok: true }) }
    render(<CosmosSettingsPage />)

    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => expect(screen.getByText('Connected')).toBeTruthy())
  })

  it('shows an error message when the test connection fails', async () => {
    ;(global as any).window.api = { cosmosTestConnection: vi.fn().mockResolvedValue({ ok: false, error: 'HTTP 401' }) }
    render(<CosmosSettingsPage />)

    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => expect(screen.getByText('HTTP 401')).toBeTruthy())
  })
})
