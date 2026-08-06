import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useModelSettingsStore } from '../modelSettingsStore'

const { localStorageStore } = vi.hoisted(() => {
  const localStorageStore: Record<string, string> = {}
  ;(global as any).localStorage = {
    getItem: (k: string) => localStorageStore[k] ?? null,
    setItem: (k: string, v: string) => { localStorageStore[k] = v },
    removeItem: (k: string) => { delete localStorageStore[k] },
    clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]) },
  }
  return { localStorageStore }
})

describe('modelSettingsStore', () => {
  beforeEach(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])
    useModelSettingsStore.setState({ enabled: { claude: true, codex: true, cosmos: true } })
  })

  it('defaults to every model enabled', () => {
    expect(useModelSettingsStore.getState().enabled).toEqual({ claude: true, codex: true, cosmos: true })
  })

  it('disables a model', () => {
    useModelSettingsStore.getState().setEnabled('codex', false)
    expect(useModelSettingsStore.getState().enabled.codex).toBe(false)
  })

  it('re-enables a model', () => {
    useModelSettingsStore.getState().setEnabled('codex', false)
    useModelSettingsStore.getState().setEnabled('codex', true)
    expect(useModelSettingsStore.getState().enabled.codex).toBe(true)
  })

  it('refuses to disable the last remaining enabled model', () => {
    useModelSettingsStore.getState().setEnabled('codex', false)
    useModelSettingsStore.getState().setEnabled('cosmos', false)
    // Only 'claude' left enabled — disabling it would leave nothing selectable.
    useModelSettingsStore.getState().setEnabled('claude', false)
    expect(useModelSettingsStore.getState().enabled.claude).toBe(true)
  })

  it('persists changes to localStorage', () => {
    useModelSettingsStore.getState().setEnabled('cosmos', false)
    expect(JSON.parse(localStorage.getItem('huginn:enabledModels')!)).toMatchObject({ cosmos: false })
  })
})
