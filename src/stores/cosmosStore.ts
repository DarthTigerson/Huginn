import { create } from 'zustand'
import { useCosmosSettingsStore } from './cosmosSettingsStore'
import type { CosmosEvent, CosmosMessage } from '@/types/api'

const AGENT_MODE_KEY = 'huginn:cosmos:agentMode'

export interface CosmosToolCallBlock {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'pending-approval' | 'running' | 'done' | 'error'
  result?: string
}

export interface CosmosChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: CosmosToolCallBlock[]
}

function getAgentMode(): boolean {
  return localStorage.getItem(AGENT_MODE_KEY) === 'true'
}

function toWireMessages(messages: CosmosChatMessage[]): CosmosMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }))
}

interface CosmosStore {
  messages: CosmosChatMessage[]
  previousMessages: CosmosChatMessage[]
  agentMode: boolean
  streaming: boolean
  sendMessage: (cwd: string, text: string) => void
  regenerate: (cwd: string, messageIndex: number) => void
  newSession: () => void
  previousSession: () => void
  toggleAgentMode: () => void
  approveToolCall: (id: string) => void
  rejectToolCall: (id: string) => void
  cancel: () => void
  initEventListener: () => () => void
}

export const useCosmosStore = create<CosmosStore>((set, get) => ({
  messages: [],
  previousMessages: [],
  agentMode: getAgentMode(),
  streaming: false,

  sendMessage: (cwd, text) => {
    const userMessage: CosmosChatMessage = { role: 'user', content: text }
    const messages = [...get().messages, userMessage]
    set({ messages, streaming: true })

    const settings = useCosmosSettingsStore.getState()
    window.api.cosmosSend(cwd, toWireMessages(messages), get().agentMode, {
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
    })
  },

  regenerate: (cwd, messageIndex) => {
    const all = get().messages
    const target = all[messageIndex]
    if (!target || target.role !== 'user') return
    const history = all.slice(0, messageIndex)
    const messages = [...history, { role: 'user' as const, content: target.content }]
    set({ messages, streaming: true })

    const settings = useCosmosSettingsStore.getState()
    window.api.cosmosSend(cwd, toWireMessages(messages), get().agentMode, {
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      modelId: settings.modelId,
    })
  },

  newSession: () => {
    set((s) => ({ previousMessages: s.messages, messages: [] }))
  },

  previousSession: () => {
    set((s) => ({ messages: s.previousMessages }))
  },

  toggleAgentMode: () => {
    const next = !get().agentMode
    localStorage.setItem(AGENT_MODE_KEY, String(next))
    set({ agentMode: next })
  },

  approveToolCall: (id) => window.api.cosmosApprove(id),
  rejectToolCall: (id) => window.api.cosmosReject(id),
  cancel: () => {
    window.api.cosmosCancel()
    set({ streaming: false })
  },

  initEventListener: () => {
    return window.api.onCosmosEvent((event: CosmosEvent) => {
      handleEvent(event, set, get)
    })
  },
}))

function ensureAssistantMessage(messages: CosmosChatMessage[]): CosmosChatMessage[] {
  const last = messages[messages.length - 1]
  if (last && last.role === 'assistant') return messages
  return [...messages, { role: 'assistant', content: '' }]
}

function handleEvent(
  event: CosmosEvent,
  set: (partial: Partial<CosmosStore>) => void,
  get: () => CosmosStore
): void {
  const messages = ensureAssistantMessage(get().messages)
  const last = { ...messages[messages.length - 1] }

  switch (event.type) {
    case 'new-turn': {
      const current = get().messages
      const tail = current[current.length - 1]
      // Don't push if there's already an empty assistant placeholder
      if (tail?.role === 'assistant' && !tail.content && !tail.toolCalls?.length) return
      set({ messages: [...current, { role: 'assistant', content: '' }] })
      return
    }
    case 'text-delta': {
      last.content += event.delta
      set({ messages: [...messages.slice(0, -1), last] })
      return
    }
    case 'content-replace': {
      last.content = event.content
      set({ messages: [...messages.slice(0, -1), last] })
      return
    }
    case 'tool-call': {
      last.toolCalls = [...(last.toolCalls ?? []), { id: event.id, name: event.name, args: event.args, status: 'running' }]
      set({ messages: [...messages.slice(0, -1), last] })
      return
    }
    case 'need-approval': {
      last.toolCalls = (last.toolCalls ?? []).map((tc) =>
        tc.id === event.id ? { ...tc, status: 'pending-approval' as const } : tc
      )
      set({ messages: [...messages.slice(0, -1), last] })
      return
    }
    case 'tool-result': {
      last.toolCalls = (last.toolCalls ?? []).map((tc) =>
        tc.id === event.id ? { ...tc, status: event.isError ? ('error' as const) : ('done' as const), result: event.result } : tc
      )
      set({ messages: [...messages.slice(0, -1), last] })
      return
    }
    case 'done': {
      set({ streaming: false })
      return
    }
    case 'error': {
      last.content += `\n\n**Error:** ${event.message}`
      set({ messages: [...messages.slice(0, -1), last], streaming: false })
      return
    }
  }
}
