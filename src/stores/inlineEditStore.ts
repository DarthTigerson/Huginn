import { create } from 'zustand'

export type InlineEditStatus = 'idle' | 'prompting' | 'generating' | 'reviewing' | 'error'

export interface InlineEditTarget {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

interface InlineEditStore {
  status: InlineEditStatus
  owner: unknown
  requestId: string | null
  target: InlineEditTarget | null
  accumulatedText: string
  errorMessage: string | null

  openPrompt: (owner: unknown, target: InlineEditTarget) => void
  closePrompt: () => void
  startGenerating: (requestId: string) => void
  appendDelta: (requestId: string, text: string) => void
  finishGenerating: (requestId: string) => void
  fail: (requestId: string, message: string) => void
  reset: () => void
}

export const useInlineEditStore = create<InlineEditStore>((set, get) => ({
  status: 'idle',
  owner: null,
  requestId: null,
  target: null,
  accumulatedText: '',
  errorMessage: null,

  openPrompt: (owner, target) => set({
    status: 'prompting', owner, target, requestId: null, accumulatedText: '', errorMessage: null,
  }),

  closePrompt: () => set({
    status: 'idle', owner: null, requestId: null, target: null, accumulatedText: '', errorMessage: null,
  }),

  startGenerating: (requestId) => set({ status: 'generating', requestId, accumulatedText: '', errorMessage: null }),

  appendDelta: (requestId, text) => {
    if (get().requestId !== requestId) return
    set((s) => ({ accumulatedText: s.accumulatedText + text }))
  },

  finishGenerating: (requestId) => {
    if (get().requestId !== requestId) return
    set({ status: 'reviewing' })
  },

  fail: (requestId, message) => {
    if (get().requestId !== requestId) return
    set({ status: 'error', errorMessage: message })
  },

  reset: () => set({
    status: 'idle', owner: null, requestId: null, target: null, accumulatedText: '', errorMessage: null,
  }),
}))
