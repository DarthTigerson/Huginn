import { create } from 'zustand'

interface ClaudeState {
  restartToken: number
  newSession: (cwd: string) => void
  previousSession: (cwd: string) => void
  compact: () => void
  clearContext: () => void
  usage: () => void
}

export const useClaudeStore = create<ClaudeState>((set) => ({
  restartToken: 0,

  newSession: (cwd: string) => {
    set((s) => ({ restartToken: s.restartToken + 1 }))
    window.api.claudeSpawn(cwd, 'new')
  },

  previousSession: (cwd: string) => {
    set((s) => ({ restartToken: s.restartToken + 1 }))
    window.api.claudeSpawn(cwd, 'continue')
  },

  compact: () => window.api.claudeWrite('/compact\r'),
  clearContext: () => window.api.claudeWrite('/clear\r'),
  usage: () => window.api.claudeWrite('/usage\r'),
}))
