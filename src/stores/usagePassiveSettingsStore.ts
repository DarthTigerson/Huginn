import { create } from 'zustand'

interface UsagePassiveSettingsStore {
  enabled: boolean
  initialized: boolean
  init: () => Promise<void>
  setEnabled: (value: boolean) => Promise<void>
}

// Persisted on the main-process side (not localStorage) — the passive poller
// needs to know this setting at app launch, before any renderer exists.
export const useUsagePassiveSettingsStore = create<UsagePassiveSettingsStore>((set, get) => ({
  enabled: false,
  initialized: false,

  init: async () => {
    if (get().initialized) return
    set({ initialized: true })
    const enabled = await window.api.usageGetPassiveEnabled()
    set({ enabled })
  },

  setEnabled: async (value) => {
    set({ enabled: value })
    await window.api.usageSetPassiveEnabled(value)
  },
}))
