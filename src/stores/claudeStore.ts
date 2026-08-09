import { create } from 'zustand'
import type { AssistantKind } from '@/types/api'

const ASSISTANT_KEY = 'huginn-last-assistant'
const VALID: AssistantKind[] = ['claude', 'codex', 'cosmos']

function readStoredAssistant(): AssistantKind {
  try {
    const v = localStorage.getItem(ASSISTANT_KEY)
    return VALID.includes(v as AssistantKind) ? (v as AssistantKind) : 'claude'
  } catch {
    return 'claude'
  }
}

interface ClaudeState {
  assistant: AssistantKind
  restartToken: number
  usageOpen: boolean
  chatVisible: boolean
  pendingInjection: string | null
  focusToken: number
  setAssistant: (assistant: AssistantKind) => void
  newSession: (cwd: string) => void
  previousSession: (cwd: string) => void
  compact: () => void
  clearContext: () => void
  usage: () => void
  model: () => void
  fast: () => void
  toggleChatVisible: () => void
  sendSelection: (text: string) => void
  focusChat: () => void
  consumeInjection: () => void
}

export const useClaudeStore = create<ClaudeState>((set, get) => ({
  assistant: readStoredAssistant(),
  restartToken: 0,
  usageOpen: false,
  chatVisible: true,
  pendingInjection: null,
  focusToken: 0,

  setAssistant: (assistant: AssistantKind) => {
    try { localStorage.setItem(ASSISTANT_KEY, assistant) } catch {}
    set({ assistant })
  },

  toggleChatVisible: () => set((s) => ({ chatVisible: !s.chatVisible })),

  sendSelection: (text) => {
    set((s) => ({ chatVisible: true, pendingInjection: text, focusToken: s.focusToken + 1 }))
  },

  focusChat: () => {
    set((s) => ({ chatVisible: true, focusToken: s.focusToken + 1 }))
  },

  consumeInjection: () => set({ pendingInjection: null }),

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
    set((s) => ({ usageOpen: !s.usageOpen }))
  },
  model: () => window.api.assistantWrite('codex', '/model\r'),
  fast: () => window.api.assistantWrite('codex', '/fast\r'),
}))
