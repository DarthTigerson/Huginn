import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUsagePassiveSettingsStore } from '../usagePassiveSettingsStore'

vi.stubGlobal('window', {
  api: {
    usageGetPassiveEnabled: vi.fn().mockResolvedValue(true),
    usageSetPassiveEnabled: vi.fn().mockResolvedValue(undefined),
  },
})

describe('usagePassiveSettingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUsagePassiveSettingsStore.setState({ enabled: false, initialized: false })
  })

  it('fetches the persisted value on init', async () => {
    await useUsagePassiveSettingsStore.getState().init()
    expect(window.api.usageGetPassiveEnabled).toHaveBeenCalled()
    expect(useUsagePassiveSettingsStore.getState().enabled).toBe(true)
  })

  it('does not re-fetch on repeated init calls', async () => {
    await useUsagePassiveSettingsStore.getState().init()
    await useUsagePassiveSettingsStore.getState().init()
    expect(window.api.usageGetPassiveEnabled).toHaveBeenCalledTimes(1)
  })

  it('setEnabled updates local state and persists via IPC', async () => {
    await useUsagePassiveSettingsStore.getState().setEnabled(true)
    expect(useUsagePassiveSettingsStore.getState().enabled).toBe(true)
    expect(window.api.usageSetPassiveEnabled).toHaveBeenCalledWith(true)
  })
})
