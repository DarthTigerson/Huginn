import { create } from 'zustand'
import type { GraphifyGraph } from '@/types/graphify'

// How much of the accumulated stderr/stdout progress text to fold into the
// error message on a non-zero exit, so the panel's error banner shows the
// actual failure output (install instructions, tracebacks, ...) rather than
// just an exit code. Measured in characters, taken from the tail (most
// recent output) of the accumulated progress.
const ERROR_TAIL_CHARS = 2000

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
    try {
      const available = await window.api.graphifyIsAvailable()
      set({ available, checking: false })
    } catch {
      // Must land on a non-null `available` here — GraphifyPanel's mount
      // effect re-fires whenever `checking` flips back to false while
      // `available` is still null, so leaving it null on failure causes an
      // infinite checkAvailable() retry loop.
      set({ available: false, checking: false })
    }
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
      const finalProgress = get().progress
      set({ running: false })
      if (code === 0) {
        get().loadGraph(cwd)
      } else {
        const tail = finalProgress.slice(-ERROR_TAIL_CHARS)
        set({
          error: tail
            ? `graphify exited with code ${code}:\n${tail}`
            : `graphify exited with code ${code}`,
        })
      }
    })

    try {
      await window.api.graphifyRun(id, cwd)
    } catch (err) {
      cleanupData()
      cleanupExit()
      set({ running: false, error: err instanceof Error ? err.message : String(err) })
    }
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
