import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => {
  const store: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  }
  return { store }
})

import { useCosmosSettingsStore } from '../cosmosSettingsStore'

describe('cosmosSettingsStore', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k])
    useCosmosSettingsStore.setState({ endpoint: '', apiKey: '', modelId: '' })
  })

  it('has empty defaults', () => {
    const s = useCosmosSettingsStore.getState()
    expect(s.endpoint).toBe('')
    expect(s.apiKey).toBe('')
    expect(s.modelId).toBe('')
  })

  it('setEndpoint persists to localStorage', () => {
    useCosmosSettingsStore.getState().setEndpoint('http://169.254.238.138:8002/v1')
    expect(useCosmosSettingsStore.getState().endpoint).toBe('http://169.254.238.138:8002/v1')
    expect(store['huginn:cosmos:endpoint']).toBe('http://169.254.238.138:8002/v1')
  })

  it('setApiKey persists to localStorage', () => {
    useCosmosSettingsStore.getState().setApiKey('local')
    expect(store['huginn:cosmos:apiKey']).toBe('local')
  })

  it('setModelId persists to localStorage', () => {
    useCosmosSettingsStore.getState().setModelId('mlx-community/Qwen2.5-Coder-32B')
    expect(store['huginn:cosmos:modelId']).toBe('mlx-community/Qwen2.5-Coder-32B')
  })
})
