import { create } from 'zustand'
import type { LspServerId } from './lspSettingsStore'

export interface LspServerStatus {
  found: boolean
  version?: string
  label: string
  ramEstimate: string
}

interface LspStatusStore {
  status: Partial<Record<LspServerId, LspServerStatus>>
  installing: Partial<Record<LspServerId, boolean>>
  installOutput: Partial<Record<LspServerId, string>>
  loaded: boolean
  refresh: () => Promise<void>
  install: (id: LspServerId) => void
}

export const useLspStatusStore = create<LspStatusStore>((set, get) => ({
  status: {},
  installing: {},
  installOutput: {},
  loaded: false,

  refresh: async () => {
    const status = await window.api.lspDetectAll()
    set({ status: status as Partial<Record<LspServerId, LspServerStatus>>, loaded: true })
  },

  install: (id) => {
    set((s) => ({
      installing: { ...s.installing, [id]: true },
      installOutput: { ...s.installOutput, [id]: '' },
    }))
    window.api.lspInstall(id).catch(() => {})
  },
}))

let subscribed = false

// Wires up the streamed install output/exit events once per app session —
// mirrors registerAutocompleteProvider's `registered` guard in
// src/lib/monacoAutocomplete.ts.
export function subscribeLspInstallEvents(): void {
  if (subscribed) return
  subscribed = true

  window.api.onLspInstallData((id, chunk) => {
    useLspStatusStore.setState((s) => ({
      installOutput: { ...s.installOutput, [id as LspServerId]: (s.installOutput[id as LspServerId] ?? '') + chunk },
    }))
  })

  window.api.onLspInstallExit((id) => {
    useLspStatusStore.setState((s) => ({ installing: { ...s.installing, [id as LspServerId]: false } }))
    useLspStatusStore.getState().refresh()
  })
}
