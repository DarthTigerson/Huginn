import { create } from 'zustand'
import type { AssistantKind } from '@/types/api'

interface ClaudeState {
  assistant: AssistantKind
  restartToken: number
  setAssistant: (assistant: AssistantKind) => void
  newSession: (cwd: string) => void
  previousSession: (cwd: string) => void
  compact: () => void
  clearContext: () => void
  usage: () => void
}

export const useClaudeStore = create<ClaudeState>((set) => ({
  assistant: 'claude',
  restartToken: 0,

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
    if (useClaudeStore.getState().assistant === 'claude') window.api.assistantWrite('claude', '/usage\r')
  },
}))
