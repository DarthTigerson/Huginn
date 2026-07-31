import { create } from 'zustand'
import type { AssistantKind } from '@/types/api'

const ASSISTANT_KEY = 'huginn-last-assistant'
const VALID: AssistantKind[] = ['claude', 'codex', 'cosmos']

function readStoredAssistant(): AssistantKind {
  const v = localStorage.getItem(ASSISTANT_KEY)
  return VALID.includes(v as AssistantKind) ? (v as AssistantKind) : 'claude'
}

interface ClaudeState {
  assistant: AssistantKind
  restartToken: number
  usageOpen: boolean
  chatVisible: boolean
  setAssistant: (assistant: AssistantKind) => void
  newSession: (cwd: string) => void
  previousSession: (cwd: string) => void
  compact: () => void
  clearContext: () => void
  usage: () => void
  model: () => void
  fast: () => void
  toggleChatVisible: () => void
}

export const useClaudeStore = create<ClaudeState>((set, get) => ({
  assistant: readStoredAssistant(),
  restartToken: 0,
  usageOpen: false,
  chatVisible: true,

  setAssistant: (assistant: AssistantKind) => {
    localStorage.setItem(ASSISTANT_KEY, assistant)
    set({ assistant })
  },

  toggleChatVisible: () => set((s) => ({ chatVisible: !s.chatVisible })),

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
