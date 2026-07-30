import { create } from 'zustand'

const KEYS = {
  endpoint: 'huginn:cosmos:endpoint',
  apiKey:   'huginn:cosmos:apiKey',
  modelId:  'huginn:cosmos:modelId',
}

function getString(key: string, def: string): string {
  const v = localStorage.getItem(key)
  return v === null ? def : v
}

interface CosmosSettingsStore {
  endpoint: string
  apiKey: string
  modelId: string
  setEndpoint: (v: string) => void
  setApiKey: (v: string) => void
  setModelId: (v: string) => void
}

export const useCosmosSettingsStore = create<CosmosSettingsStore>((set) => ({
  endpoint: getString(KEYS.endpoint, ''),
  apiKey:   getString(KEYS.apiKey, ''),
  modelId:  getString(KEYS.modelId, ''),

  setEndpoint: (v) => {
    localStorage.setItem(KEYS.endpoint, v)
    set({ endpoint: v })
  },
  setApiKey: (v) => {
    localStorage.setItem(KEYS.apiKey, v)
    set({ apiKey: v })
  },
  setModelId: (v) => {
    localStorage.setItem(KEYS.modelId, v)
    set({ modelId: v })
  },
}))
