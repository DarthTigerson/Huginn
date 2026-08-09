import { create } from 'zustand'
import type { GraphifyGraph } from '@/types/graphify'

interface GraphifyStore {
  available: boolean | null
  checking: boolean
  running: boolean
  progress: string
  error: string | null
  graph: GraphifyGraph | null
  loadingGraph: boolean
  checkAvailable: () => Promise<void>
  run: (cwd: string) => Promise<void>
  loadGraph: (cwd: string) => Promise<void>
}

export const useGraphifyStore = create<GraphifyStore>((set, get) => ({
  available: null,
  checking: false,
  running: false,
  progress: '',
  error: null,
  graph: null,
  loadingGraph: false,

  checkAvailable: async () => {
    set({ checking: true })
    const available = await window.api.graphifyIsAvailable()
    set({ available, checking: false })
  },

  run: async (cwd) => {
    if (get().running) return
    const id = crypto.randomUUID()
    set({ running: true, progress: '', error: null })

    const cleanupData = window.api.onGraphifyData((evtId, data) => {
      if (evtId !== id) return
      set((s) => ({ progress: s.progress + data }))
    })
    const cleanupExit = window.api.onGraphifyExit((evtId, code) => {
      if (evtId !== id) return
      cleanupData()
      cleanupExit()
      set({ running: false })
      if (code === 0) {
        get().loadGraph(cwd)
      } else {
        set({ error: `graphify exited with code ${code}` })
      }
    })

    await window.api.graphifyRun(id, cwd)
  },

  loadGraph: async (cwd) => {
    set({ loadingGraph: true })
    try {
      const graph = await window.api.graphifyReadGraph(cwd)
      set({ graph, loadingGraph: false })
    } catch {
      set({ graph: null, loadingGraph: false })
    }
  },
}))
