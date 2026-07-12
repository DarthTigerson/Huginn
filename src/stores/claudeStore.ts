import { create } from 'zustand'
import type { AssistantKind } from '@/types/api'

interface ClaudeState {
  assistant: AssistantKind
  restartToken: number
  usageOpen: boolean
  setAssistant: (assistant: AssistantKind) => void
  newSession: (cwd: string) => void
  previousSession: (cwd: string) => void
  compact: () => void
  clearContext: () => void
  usage: () => void
  model: () => void
  fast: () => void
}

export const useClaudeStore = create<ClaudeState>((set, get) => ({
  assistant: 'claude',
  restartToken: 0,
  usageOpen: false,

  setAssistant: (assistant: AssistantKind) => set({ assistant }),

  newSession: (cwd: string) => {
    set((s) => ({ restartToken: s.restartToken + 1 }))
    window.api.assistantSpawn(cwd, useClaudeStore.getState().assistant, 'new')
  },

  previousSession: (cwd: string) => {
    set((s) => ({ restartToken: s.restartToken + 1 }))
    window.api.assistantSpawn(cwd, useClaudeStore.getState().assistant, 'continue')
  },

  compact: () => {
    if (useClaudeStore.getState().assistant === 'claude') window.api.assistantWrite('claude', '/compact\r')
  },
  clearContext: () => {
    if (useClaudeStore.getState().assistant === 'claude') window.api.assistantWrite('claude', '/clear\r')
  },
  usage: () => {
    if (get().assistant !== 'claude') return
    if (get().usageOpen) {
      window.api.assistantWrite('claude', '\x1b')
      set({ usageOpen: false })
    } else {
      window.api.assistantWrite('claude', '/usage\r')
      set({ usageOpen: true })
    }
  },
  model: () => window.api.assistantWrite('codex', '/model\r'),
  fast: () => window.api.assistantWrite('codex', '/fast\r'),
}))
