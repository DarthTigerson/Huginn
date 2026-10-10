import { create } from 'zustand'
import type { AssistantKind } from '@/types/api'
import { hueForInstanceIndex, nextHueForInstances } from '@/lib/claudeInstanceHues'
import { agentModeOnLaunchFor, isBridgeLike } from '@/lib/agentKinds'
import { useBridgeStore } from './bridgeStore'

// One activity-bar session. Every kind (Claude, Bridge, llama:<id>) lives in
// the same ordered list — there is no global "assistant mode" any more.
export interface AgentSession {
  id: string
  kind: AssistantKind
  hue: string
}

// Older name, kept so existing imports keep compiling.
export type ClaudeInstance = AgentSession

function createInstance(kind: AssistantKind, hue: string): AgentSession {
  return { id: crypto.randomUUID(), kind, hue }
}

function parseSaved(raw: unknown, defaultKind?: AssistantKind): AgentSession[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((inst) => {
    if (typeof inst?.id !== 'string' || typeof inst?.hue !== 'string') return []
    const kind = typeof inst.kind === 'string' ? inst.kind : defaultKind
    return kind ? [{ id: inst.id, kind, hue: inst.hue }] : []
  })
}

// Whole-file overwrite — fine today since agentSessions is the only field
// anything writes to session data, but a future feature that starts
// persisting layout/tabs here would need a read-merge-write instead, or its
// data will be silently erased on every "+"/close/reorder.
function persist(cwd: string, instances: AgentSession[]) {
  window.api.sessionSave(cwd, { agentSessions: instances } as any)
}

function openIfBridgeLike(inst: AgentSession) {
  if (isBridgeLike(inst.kind)) useBridgeStore.getState().openConversation(inst.id, agentModeOnLaunchFor(inst.kind))
}

interface ClaudeState {
  // The stacked Claude sessions. Starts empty — App.tsx populates it via
  // loadInstancesFromSession() once sessionLoad() resolves for the current
  // project, so no throwaway instance is ever created and then discarded.
  instances: AgentSession[]
  activeInstanceId: string
  restartToken: number
  usageOpen: boolean
  costOpen: boolean
  chatVisible: boolean
  pendingInjection: string | null
  focusToken: number
  // Whether that instance's CLI is actively generating (electron/claude.ts
  // infers this from PTY output timing, filtering out echoes of the user's
  // own keystrokes — see the ECHO_WINDOW_MS comment there). Keyed by
  // instance id. Bridge/llama sessions never appear here — their busy state
  // is `bridgeStore.conversations[id].streaming`.
  busyByInstance: Record<string, boolean>
  loadInstancesFromSession: (data: { agentSessions?: unknown; claudeInstances?: unknown } | null | undefined) => void
  newSession: (cwd: string, kind: AssistantKind) => void
  moveInstance: (cwd: string, dragId: string, targetId: string, placement: 'before' | 'after') => void
  previousSession: (cwd: string) => void
  resumeSession: (cwd: string) => void
  closeInstance: (cwd: string, id: string) => void
  closeAllInstances: (cwd: string) => void
  closeOtherInstances: (cwd: string, keepId: string) => void
  setActiveInstance: (id: string) => void
  compact: () => void
  clearContext: () => void
  usage: () => void
  cost: () => void
  toggleChatVisible: () => void
  setChatVisible: (visible: boolean) => void
  sendSelection: (text: string) => void
  focusChat: () => void
  consumeInjection: () => void
  setBusy: (instanceId: string, busy: boolean) => void
}

export function selectActiveSession(s: Pick<ClaudeState, 'instances' | 'activeInstanceId'>): AgentSession | undefined {
  return s.instances.find((inst) => inst.id === s.activeInstanceId)
}

// Usage/Cost render inside the chat panel against the Claude CLI, so they
// close whenever the session that ends up active isn't Claude (or there is
// none). Shared by setActiveInstance and closeInstance.
function usagePanelsFor(next: AgentSession | undefined): Partial<Pick<ClaudeState, 'usageOpen' | 'costOpen'>> {
  return next?.kind === 'claude' ? {} : { usageOpen: false, costOpen: false }
}

// Tears down one session's backing process/conversation: Claude owns a PTY,
// Bridge/llama a conversation that gets cancelled and archived to history.
function endSession(inst: AgentSession) {
  if (isBridgeLike(inst.kind)) useBridgeStore.getState().closeConversation(inst.id)
  else window.api.claudeKill(inst.id)
}

export const useClaudeStore = create<ClaudeState>((set, get) => ({
  instances: [],
  activeInstanceId: '',
  restartToken: 0,
  usageOpen: false,
  costOpen: false,
  // Starts closed — App.tsx opens it automatically once a project resolves
  // (on launch restore or a fresh Open Folder), so there's no toggle to
  // click (or flash of an empty chat panel) before there's a project for it
  // to attach to.
  chatVisible: false,
  pendingInjection: null,
  focusToken: 0,
  busyByInstance: {},

  setBusy: (instanceId, busy) =>
    set((s) => ({ busyByInstance: { ...s.busyByInstance, [instanceId]: busy } })),

  loadInstancesFromSession: (data) => {
    const fromAgent = parseSaved(data?.agentSessions)
    const saved = fromAgent.length > 0 ? fromAgent : parseSaved(data?.claudeInstances, 'claude')
    const instances = saved.length > 0 ? saved : [createInstance('claude', hueForInstanceIndex(0))]
    instances.forEach(openIfBridgeLike)
    set({ instances, activeInstanceId: instances[0].id })
  },

  toggleChatVisible: () => set((s) => ({ chatVisible: !s.chatVisible })),

  setChatVisible: (visible) => set({ chatVisible: visible }),

  sendSelection: (text) => {
    set((s) => ({ chatVisible: true, pendingInjection: text, focusToken: s.focusToken + 1 }))
  },

  focusChat: () => {
    set((s) => ({ chatVisible: true, focusToken: s.focusToken + 1 }))
  },

  consumeInjection: () => set({ pendingInjection: null }),

  newSession: (cwd, kind) => {
    const instances = get().instances
    const instance = createInstance(kind, nextHueForInstances(instances))
    openIfBridgeLike(instance)
    const nextInstances = [...instances, instance]
    set({ instances: nextInstances, activeInstanceId: instance.id, ...(kind === 'claude' ? {} : { usageOpen: false, costOpen: false }) })
    persist(cwd, nextInstances)
  },

  moveInstance: (cwd, dragId, targetId, placement) => {
    const instances = get().instances
    const dragged = instances.find((inst) => inst.id === dragId)
    if (!dragged || dragId === targetId || !instances.some((inst) => inst.id === targetId)) return
    const without = instances.filter((inst) => inst.id !== dragId)
    const targetIndex = without.findIndex((inst) => inst.id === targetId)
    const insertAt = placement === 'before' ? targetIndex : targetIndex + 1
    const nextInstances = [...without.slice(0, insertAt), dragged, ...without.slice(insertAt)]
    set({ instances: nextInstances })
    persist(cwd, nextInstances)
  },

  previousSession: (cwd) => {
    if (selectActiveSession(get())?.kind !== 'claude') return
    set((s) => ({ restartToken: s.restartToken + 1 }))
    window.api.claudeSpawn(cwd, get().activeInstanceId, 'continue')
  },

  resumeSession: (cwd) => {
    if (selectActiveSession(get())?.kind !== 'claude') return
    set((s) => ({ restartToken: s.restartToken + 1 }))
    window.api.claudeSpawn(cwd, get().activeInstanceId, 'resume')
  },

  setActiveInstance: (id) => {
    const next = get().instances.find((inst) => inst.id === id)
    set({ activeInstanceId: id, ...usagePanelsFor(next) })
  },

  // Closing the last remaining instance is allowed — there's nothing left
  // to switch to, so the "+" in the activity bar becomes the only way back
  // in, same as before any session ever existed.
  closeInstance: (cwd: string, id: string) => {
    const { instances, activeInstanceId } = get()
    const closedIndex = instances.findIndex((inst) => inst.id === id)
    if (closedIndex === -1) return

    const nextInstances = instances.filter((inst) => inst.id !== id)
    endSession(instances[closedIndex])

    const nextActiveId =
      activeInstanceId !== id
        ? activeInstanceId
        : (nextInstances[Math.min(closedIndex, nextInstances.length - 1)]?.id ?? '')

    set({
      instances: nextInstances,
      activeInstanceId: nextActiveId,
      ...usagePanelsFor(nextInstances.find((inst) => inst.id === nextActiveId)),
      // Nothing left to show — collapse the chat panel instead of leaving
      // it open on an empty terminal. newSession()'s "+" click handler
      // already sets this back to true, so it reopens itself for free.
      ...(nextInstances.length === 0 ? { chatVisible: false } : {}),
    })
    persist(cwd, nextInstances)
  },

  closeAllInstances: (cwd) => {
    get().instances.forEach(endSession)
    set({ instances: [], activeInstanceId: '', chatVisible: false })
    persist(cwd, [])
  },

  closeOtherInstances: (cwd, keepId) => {
    const kept = get().instances.find((inst) => inst.id === keepId)
    if (!kept) return
    get().instances.filter((inst) => inst.id !== keepId).forEach(endSession)
    set({ instances: [kept], activeInstanceId: keepId, ...usagePanelsFor(kept) })
    persist(cwd, [kept])
  },

  compact: () => {
    if (selectActiveSession(get())?.kind === 'claude') window.api.claudeWrite(get().activeInstanceId, '/compact\r')
  },
  clearContext: () => {
    const active = selectActiveSession(get())
    if (!active) return
    if (active.kind === 'claude') window.api.claudeWrite(active.id, '/clear\r')
    else useBridgeStore.getState().clearConversation(active.id)
  },
  usage: () => {
    if (selectActiveSession(get())?.kind !== 'claude') return
    // Usage and Cost are mutually exclusive — opening one closes the other,
    // so at most one of these bottom panels is ever showing at a time.
    set((s) => {
      const usageOpen = !s.usageOpen
      return { usageOpen, costOpen: usageOpen ? false : s.costOpen }
    })
  },
  cost: () => {
    if (selectActiveSession(get())?.kind !== 'claude') return
    set((s) => {
      const costOpen = !s.costOpen
      return { costOpen, usageOpen: costOpen ? false : s.usageOpen }
    })
  },
}))
