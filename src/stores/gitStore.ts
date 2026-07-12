import { create } from 'zustand'
import type { GitStatus } from '@/types/index'

interface GitStore {
  branch: string | null
  status: GitStatus
  commitMessage: string
  commitError: string | null
  refresh: (cwd: string | null) => Promise<void>
  refreshStatus: (cwd: string | null) => Promise<void>
  stage: (cwd: string, path: string) => Promise<void>
  unstage: (cwd: string, path: string) => Promise<void>
  stageAll: (cwd: string) => Promise<void>
  unstageAll: (cwd: string) => Promise<void>
  setCommitMessage: (message: string) => void
  commit: (cwd: string) => Promise<void>
}

export const useGitStore = create<GitStore>((set, get) => ({
  branch: null,
  status: { staged: [], unstaged: [] },
  commitMessage: '',
  commitError: null,

  refresh: async (cwd) => {
    if (!cwd) {
      set({ branch: null, status: { staged: [], unstaged: [] } })
      return
    }
    const branch = await window.api.gitBranch(cwd)
    set({ branch })
    await get().refreshStatus(cwd)
  },

  refreshStatus: async (cwd) => {
    if (!cwd) {
      set({ status: { staged: [], unstaged: [] } })
      return
    }
    const status = await window.api.gitStatus(cwd)
    set({ status })
  },

  stage: async (cwd, path) => {
    await window.api.gitStage(cwd, [path])
    await get().refreshStatus(cwd)
  },

  unstage: async (cwd, path) => {
    await window.api.gitUnstage(cwd, [path])
    await get().refreshStatus(cwd)
  },

  stageAll: async (cwd) => {
    await window.api.gitStageAll(cwd)
    await get().refreshStatus(cwd)
  },

  unstageAll: async (cwd) => {
    await window.api.gitUnstageAll(cwd)
    await get().refreshStatus(cwd)
  },

  setCommitMessage: (message) => set({ commitMessage: message, commitError: null }),

  commit: async (cwd) => {
    const { commitMessage } = get()
    const result = await window.api.gitCommit(cwd, commitMessage)
    if (result.ok) {
      set({ commitMessage: '', commitError: null })
      await get().refresh(cwd)
    } else {
      set({ commitError: result.error })
    }
  },
}))
